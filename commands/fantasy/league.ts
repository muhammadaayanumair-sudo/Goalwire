import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { randomBytes } from "crypto";
import type { Command } from "../../types/discord";
import { FantasyLeague } from "../../database/models/FantasyLeague";
import { FantasyTeam } from "../../database/models/FantasyTeam";
import { rankingService, RankingError } from "../../services/fantasy/RankingService";
import { errorEmbed, fantasyEmbed, successEmbed } from "../../utils/embeds";
import { EMOJIS } from "../../config/constants";
import { formatPoints } from "../../utils/formatter";
import { logger } from "../../utils/logger";

const MAX_LEAGUE_NAME_LENGTH = 40;
const MIN_LEAGUE_NAME_LENGTH = 3;
const LEAGUE_CODE_LENGTH = 6;
const MAX_MEMBERS = 50;

function generateLeagueCode(): string {
  return randomBytes(4).toString("hex").slice(0, LEAGUE_CODE_LENGTH).toUpperCase();
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("league")
    .setDescription("Create or join a private fantasy mini-league")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new private league")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("League name")
            .setRequired(true)
            .setMinLength(MIN_LEAGUE_NAME_LENGTH)
            .setMaxLength(MAX_LEAGUE_NAME_LENGTH),
        )
        .addIntegerOption((option) =>
          option
            .setName("max_members")
            .setDescription("Maximum members allowed (default 20)")
            .setRequired(false)
            .setMinValue(2)
            .setMaxValue(MAX_MEMBERS),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("join")
        .setDescription("Join a league using its invite code")
        .addStringOption((option) =>
          option.setName("code").setDescription("League invite code").setRequired(true),
        ),
    )
    .addSubcommand((sub) => sub.setName("standings").setDescription("View your league's standings"))
    .addSubcommand((sub) => sub.setName("leave").setDescription("Leave your current league")) as SlashCommandBuilder,
  category: "fantasy",
  cooldown: 5,

  async execute(client, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    if (!interaction.guildId) {
      await interaction.editReply({
        embeds: [errorEmbed("This command can only be used inside a server.")],
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "create":
          await this.handleCreate(interaction);
          break;
        case "join":
          await this.handleJoin(interaction);
          break;
        case "standings":
          await this.handleStandings(interaction);
          break;
        case "leave":
          await this.handleLeave(interaction);
          break;
      }
    } catch (error) {
      logger.error("Error in /league command", { error, subcommand, userId: interaction.user.id });

      const message =
        error instanceof RankingError || error instanceof Error
          ? error.message
          : "Failed to process your league request.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },

  async handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
    const name = interaction.options.getString("name", true).trim();
    const maxMembers = interaction.options.getInteger("max_members") ?? 20;

    const team = await FantasyTeam.findOne({ discordId: interaction.user.id, guildId: interaction.guildId! });
    if (!team) {
      await interaction.editReply({
        embeds: [errorEmbed("You need a fantasy team before creating a league. Use `/create` first.")],
      });
      return;
    }

    if (team.leagueId) {
      await interaction.editReply({
        embeds: [errorEmbed("You're already in a league. Leave it first with `/league leave`.")],
      });
      return;
    }

    let code = generateLeagueCode();
    let attempts = 0;
    while ((await FantasyLeague.exists({ code })) && attempts < 5) {
      code = generateLeagueCode();
      attempts++;
    }

    const league = await FantasyLeague.create({
      name,
      guildId: interaction.guildId!,
      createdBy: interaction.user.id,
      code,
      members: [team._id],
      maxMembers,
    });

    team.leagueId = league._id;
    await team.save();

    const embed = fantasyEmbed({
      title: `${EMOJIS.TROPHY} League Created`,
      description: `**${name}** is ready! Share the invite code below with friends.`,
      fields: [
        { name: "Invite Code", value: `\`${code}\``, inline: true },
        { name: "Max Members", value: `${maxMembers}`, inline: true },
      ],
    });

    await interaction.editReply({ embeds: [embed] });
  },

  async handleJoin(interaction: ChatInputCommandInteraction): Promise<void> {
    const code = interaction.options.getString("code", true).trim().toUpperCase();

    const team = await FantasyTeam.findOne({ discordId: interaction.user.id, guildId: interaction.guildId! });
    if (!team) {
      await interaction.editReply({
        embeds: [errorEmbed("You need a fantasy team before joining a league. Use `/create` first.")],
      });
      return;
    }

    if (team.leagueId) {
      await interaction.editReply({
        embeds: [errorEmbed("You're already in a league. Leave it first with `/league leave`.")],
      });
      return;
    }

    const league = await FantasyLeague.findOne({ code, isActive: true });
    if (!league) {
      await interaction.editReply({
        embeds: [errorEmbed(`No active league found with code \`${code}\`.`)],
      });
      return;
    }

    if (league.members.length >= league.maxMembers) {
      await interaction.editReply({
        embeds: [errorEmbed(`**${league.name}** is full (${league.maxMembers} members max).`)],
      });
      return;
    }

    league.members.push(team._id);
    await league.save();

    team.leagueId = league._id;
    await team.save();

    await interaction.editReply({
      embeds: [successEmbed(`You've joined **${league.name}**! Use \`/league standings\` to see the table.`)],
    });
  },

  async handleStandings(interaction: ChatInputCommandInteraction): Promise<void> {
    const team = await FantasyTeam.findOne({ discordId: interaction.user.id, guildId: interaction.guildId! });

    if (!team?.leagueId) {
      await interaction.editReply({
        embeds: [errorEmbed("You're not in a league yet. Use `/league join <code>` or `/league create`.")],
      });
      return;
    }

    await rankingService.recalculateLeagueStandings(String(team.leagueId));
    const league = await FantasyLeague.findById(team.leagueId);

    if (!league) {
      await interaction.editReply({ embeds: [errorEmbed("League not found.")] });
      return;
    }

    const lines = league.standings.map((entry) => {
      const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `**${entry.rank}.**`;
      const isYou = entry.discordId === interaction.user.id ? " *(you)*" : "";
      return `${medal} <@${entry.discordId}>${isYou} — ${formatPoints(entry.totalPoints)}`;
    });

    const embed = fantasyEmbed({
      title: `${EMOJIS.TROPHY} ${league.name} Standings`,
      description: lines.join("\n") || "*No members yet*",
      footerText: `Invite code: ${league.code}`,
    });

    await interaction.editReply({ embeds: [embed] });
  },

  async handleLeave(interaction: ChatInputCommandInteraction): Promise<void> {
    const team = await FantasyTeam.findOne({ discordId: interaction.user.id, guildId: interaction.guildId! });

    if (!team?.leagueId) {
      await interaction.editReply({
        embeds: [errorEmbed("You're not currently in a league.")],
      });
      return;
    }

    await FantasyLeague.updateOne({ _id: team.leagueId }, { $pull: { members: team._id } });

    const previousLeagueId = team.leagueId;
    team.leagueId = undefined;
    await team.save();

    logger.info("User left fantasy league", { userId: interaction.user.id, leagueId: previousLeagueId });

    await interaction.editReply({
      embeds: [successEmbed("You've left your fantasy league.")],
    });
  },
};

export default command;

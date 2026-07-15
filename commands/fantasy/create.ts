import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { Command } from "../../types/discord";
import { fantasyService } from "../../services/fantasy/FantasyService";
import { successEmbed, errorEmbed, fantasyEmbed } from "../../utils/embeds";
import { User } from "../../database/models/User";
import { CUSTOM_IDS, EMOJIS } from "../../config/constants";
import { logger } from "../../utils/logger";

const MAX_TEAM_NAME_LENGTH = 30;
const MIN_TEAM_NAME_LENGTH = 3;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("create")
    .setDescription("Create your GoalX fantasy football team")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Your fantasy team name")
        .setRequired(true)
        .setMinLength(MIN_TEAM_NAME_LENGTH)
        .setMaxLength(MAX_TEAM_NAME_LENGTH),
    ) as SlashCommandBuilder,
  category: "fantasy",
  cooldown: 5,

  async execute(client, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const teamName = interaction.options.getString("name", true).trim();

    if (!interaction.guildId) {
      await interaction.editReply({
        embeds: [errorEmbed("This command can only be used inside a server.")],
      });
      return;
    }

    if (!/^[\w\s\-']+$/.test(teamName)) {
      await interaction.editReply({
        embeds: [errorEmbed("Team names can only contain letters, numbers, spaces, hyphens, and apostrophes.")],
      });
      return;
    }

    try {
      await User.findOneAndUpdate(
        { discordId: interaction.user.id },
        {
          $setOnInsert: {
            discordId: interaction.user.id,
            username: interaction.user.username,
          },
        },
        { upsert: true, new: true },
      );

      const team = await fantasyService.createTeam(
        interaction.user.id,
        interaction.guildId,
        teamName,
      );

      const embed = fantasyEmbed({
        title: `${EMOJIS.TROPHY} Fantasy Team Created`,
        description: `Welcome to GoalX Fantasy, **${teamName}**!`,
        fields: [
          { name: "Budget", value: `£${team.budget.toFixed(1)}m`, inline: true },
          { name: "Squad Size", value: "0 / 15", inline: true },
          { name: "Free Transfers", value: `${team.freeTransfers}`, inline: true },
        ],
        footerText: "Use /team to build your squad",
      });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(CUSTOM_IDS.FANTASY.MY_TEAM)
          .setLabel("My Team")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(CUSTOM_IDS.FANTASY.AI_SCOUT)
          .setLabel("AI Scout")
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      logger.error("Error in /create command", { error, userId: interaction.user.id });

      const message = error instanceof Error ? error.message : "Failed to create your fantasy team.";
      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { Command } from "../../types/discord";
import { challengeService, ChallengeError } from "../../services/fantasy/ChallengeService";
import { FantasyTeam } from "../../database/models/FantasyTeam";
import { errorEmbed, fantasyEmbed } from "../../utils/embeds";
import { EMOJIS } from "../../config/constants";
import { logger } from "../../utils/logger";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("challenge")
    .setDescription("Challenge another user's fantasy team head-to-head for this gameweek")
    .addUserOption((option) =>
      option.setName("opponent").setDescription("The user to challenge").setRequired(true),
    ) as SlashCommandBuilder,
  category: "challenge",
  cooldown: 10,

  async execute(client, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    if (!interaction.guildId) {
      await interaction.editReply({
        embeds: [errorEmbed("This command can only be used inside a server.")],
      });
      return;
    }

    const opponent = interaction.options.getUser("opponent", true);

    if (opponent.bot) {
      await interaction.editReply({
        embeds: [errorEmbed("You can't challenge a bot.")],
      });
      return;
    }

    try {
      const proposerTeam = await FantasyTeam.findOne({
        discordId: interaction.user.id,
        guildId: interaction.guildId,
      });

      if (!proposerTeam) {
        await interaction.editReply({
          embeds: [errorEmbed("You need a fantasy team before challenging anyone. Use `/create` first.")],
        });
        return;
      }

      const challenge = await challengeService.createChallenge(
        interaction.guildId,
        interaction.user.id,
        opponent.id,
        proposerTeam.currentGameweek,
      );

      const embed = fantasyEmbed({
        title: `${EMOJIS.FIRE} Fantasy Challenge`,
        description: `<@${interaction.user.id}> has challenged <@${opponent.id}> to a head-to-head fantasy showdown for **Gameweek ${challenge.gameweek}**!`,
        footerText: `Challenge ID: ${challenge.id}`,
      });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`challenge_accept_${challenge.id}`)
          .setLabel("Accept")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`challenge_decline_${challenge.id}`)
          .setLabel("Decline")
          .setStyle(ButtonStyle.Danger),
      );

      await interaction.editReply({
        content: `<@${opponent.id}>`,
        embeds: [embed],
        components: [row],
      });
    } catch (error) {
      logger.error("Error in /challenge command", { error, userId: interaction.user.id });

      const message =
        error instanceof ChallengeError || error instanceof Error
          ? error.message
          : "Failed to create that challenge.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

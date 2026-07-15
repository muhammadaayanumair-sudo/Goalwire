import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { challengeService, ChallengeError } from "../../services/fantasy/ChallengeService";
import { errorEmbed, fantasyEmbed, successEmbed } from "../../utils/embeds";
import { EMOJIS } from "../../config/constants";
import { logger } from "../../utils/logger";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("accept")
    .setDescription("Accept a pending fantasy challenge")
    .addStringOption((option) =>
      option
        .setName("challenge_id")
        .setDescription("The challenge ID (from the challenge message, or use /challenge to list yours)")
        .setRequired(false),
    ) as SlashCommandBuilder,
  category: "challenge",
  cooldown: 5,

  async execute(client, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    if (!interaction.guildId) {
      await interaction.editReply({
        embeds: [errorEmbed("This command can only be used inside a server.")],
      });
      return;
    }

    const providedId = interaction.options.getString("challenge_id");

    try {
      let challengeId = providedId;

      if (!challengeId) {
        const pending = await challengeService.getPendingChallengesFor(
          interaction.user.id,
          interaction.guildId,
        );

        if (pending.length === 0) {
          await interaction.editReply({
            embeds: [errorEmbed("You don't have any pending challenges to accept.")],
          });
          return;
        }

        if (pending.length > 1) {
          const list = pending
            .map((c) => `• From <@${c.proposerDiscordId}> — ID: \`${c.id}\``)
            .join("\n");

          await interaction.editReply({
            embeds: [
              errorEmbed(
                `You have multiple pending challenges. Specify one with \`challenge_id\`:\n\n${list}`,
              ),
            ],
          });
          return;
        }

        challengeId = pending[0].id;
      }

      const challenge = await challengeService.acceptChallenge(challengeId, interaction.user.id);

      const embed = fantasyEmbed({
        title: `${EMOJIS.CHECK} Challenge Accepted`,
        description: `<@${interaction.user.id}> accepted the challenge from <@${challenge.proposerDiscordId}> for **Gameweek ${challenge.gameweek}**!\n\nEither player can start it with \`/kickoff\` once ready.`,
        footerText: `Challenge ID: ${challenge.id}`,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error("Error in /accept command", { error, userId: interaction.user.id });

      const message =
        error instanceof ChallengeError || error instanceof Error
          ? error.message
          : "Failed to accept that challenge.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

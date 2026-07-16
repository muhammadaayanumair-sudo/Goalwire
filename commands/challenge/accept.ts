import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { isValidObjectId } from "mongoose";
import type { Command } from "../../types/discord";
import { challengeService, ChallengeError } from "../../services/fantasy/ChallengeService";
import { errorEmbed, fantasyEmbed } from "../../utils/embeds";
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

    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.editReply({
        embeds: [errorEmbed("This command can only be used inside a server.")],
      });
      return;
    }

    const providedId = interaction.options.getString("challenge_id");

    if (providedId && !isValidObjectId(providedId)) {
      await interaction.editReply({
        embeds: [errorEmbed("That doesn't look like a valid challenge ID. Copy it exactly from the challenge message.")],
      });
      return;
    }

    try {
      let resolvedChallengeId: string;

      if (providedId) {
        resolvedChallengeId = providedId;
      } else {
        const pending = await challengeService.getPendingChallengesFor(interaction.user.id, guildId);

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

        resolvedChallengeId = pending[0].id;
      }

      const challenge = await challengeService.acceptChallenge(resolvedChallengeId, interaction.user.id);

      const embed = fantasyEmbed({
        title: `${EMOJIS.CHECK} Challenge Accepted`,
        description: `<@${interaction.user.id}> accepted the challenge from <@${challenge.proposerDiscordId}> for **Gameweek ${challenge.gameweek}**!\n\nEither player can start it with \`/kickoff\` once ready.`,
        footerText: `Challenge ID: ${challenge.id}`,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error: unknown) {
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

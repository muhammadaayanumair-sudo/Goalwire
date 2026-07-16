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
    .setName("kickoff")
    .setDescription("Start an accepted fantasy challenge")
    .addStringOption((option) =>
      option
        .setName("challenge_id")
        .setDescription("The challenge ID (omit if you only have one accepted challenge)")
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
        const active = await challengeService.getActiveChallengesFor(interaction.user.id, guildId);
        const accepted = active.filter((c) => c.status === "accepted");

        if (accepted.length === 0) {
          await interaction.editReply({
            embeds: [
              errorEmbed(
                "You don't have any accepted challenges ready to start. Use `/accept` first, or check `/matchup` for pending ones.",
              ),
            ],
          });
          return;
        }

        if (accepted.length > 1) {
          const list = accepted
            .map((c) => {
              const opponentId =
                c.proposerDiscordId === interaction.user.id ? c.opponentDiscordId : c.proposerDiscordId;
              return `• vs <@${opponentId}> (GW${c.gameweek}) — ID: \`${c.id}\``;
            })
            .join("\n");

          await interaction.editReply({
            embeds: [
              errorEmbed(
                `You have multiple accepted challenges. Specify one with \`challenge_id\`:\n\n${list}`,
              ),
            ],
          });
          return;
        }

        resolvedChallengeId = accepted[0].id;
      }

      const challenge = await challengeService.startChallenge(resolvedChallengeId, interaction.user.id);

      const opponentId =
        challenge.proposerDiscordId === interaction.user.id
          ? challenge.opponentDiscordId
          : challenge.proposerDiscordId;

      const embed = fantasyEmbed({
        title: `${EMOJIS.FOOTBALL} Challenge Kicked Off`,
        description: `<@${challenge.proposerDiscordId}> vs <@${challenge.opponentDiscordId}> is now **live** for Gameweek ${challenge.gameweek}!\n\nScores will be settled from each team's gameweek points once the round finishes.`,
        footerText: `Challenge ID: ${challenge.id}`,
      });

      await interaction.editReply({
        content: `<@${opponentId}>`,
        embeds: [embed],
      });
    } catch (error: unknown) {
      logger.error("Error in /kickoff command", { error, userId: interaction.user.id });

      const message =
        error instanceof ChallengeError || error instanceof Error
          ? error.message
          : "Failed to start that challenge.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

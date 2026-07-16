import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { isValidObjectId } from "mongoose";
import type { Command } from "../../types/discord";
import { challengeService, ChallengeError } from "../../services/fantasy/ChallengeService";
import { errorEmbed, fantasyEmbed } from "../../utils/embeds";
import { EMOJIS } from "../../config/constants";
import { formatPoints } from "../../utils/formatter";
import { logger } from "../../utils/logger";
import type { IChallenge, ChallengeStatus } from "../../database/models/Challenge";

const STATUS_LABELS: Record<ChallengeStatus, string> = {
  pending: "⏳ Pending",
  accepted: "✅ Accepted — not started",
  active: "🔴 Live",
  completed: "🏁 Completed",
  declined: "❌ Declined",
  cancelled: "🚫 Cancelled",
};

function formatEntry(c: IChallenge, viewerId: string): string {
  const isProposer = c.proposerDiscordId === viewerId;
  const opponentId = isProposer ? c.opponentDiscordId : c.proposerDiscordId;
  return `• vs <@${opponentId}> — GW${c.gameweek} — ${STATUS_LABELS[c.status]} — ID: \`${c.id}\``;
}

async function showSingleMatchup(
  interaction: ChatInputCommandInteraction,
  challengeId: string,
): Promise<void> {
  const challenge = await challengeService.getChallenge(challengeId);

  if (!challenge) {
    await interaction.editReply({ embeds: [errorEmbed("That challenge no longer exists.")] });
    return;
  }

  const isParticipant =
    challenge.proposerDiscordId === interaction.user.id ||
    challenge.opponentDiscordId === interaction.user.id;

  if (!isParticipant) {
    await interaction.editReply({ embeds: [errorEmbed("You're not part of this challenge.")] });
    return;
  }

  const fields = [
    {
      name: `<@${challenge.proposerDiscordId}>`,
      value: challenge.status === "completed" ? formatPoints(challenge.proposerScore ?? 0) : "Score pending",
      inline: true,
    },
    {
      name: `<@${challenge.opponentDiscordId}>`,
      value: challenge.status === "completed" ? formatPoints(challenge.opponentScore ?? 0) : "Score pending",
      inline: true,
    },
  ];

  let resultLine = STATUS_LABELS[challenge.status];
  if (challenge.status === "completed") {
    resultLine = challenge.winnerDiscordId
      ? `🏁 Winner: <@${challenge.winnerDiscordId}>`
      : "🏁 Result: Draw";
  }

  const embed = fantasyEmbed({
    title: `${EMOJIS.FOOTBALL} Gameweek ${challenge.gameweek} Matchup`,
    description: resultLine,
    fields,
    footerText: `Challenge ID: ${challenge.id}`,
  });

  await interaction.editReply({ embeds: [embed] });
}

async function showAllMatchups(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const [pending, active] = await Promise.all([
    challengeService.getPendingChallengesFor(interaction.user.id, guildId),
    challengeService.getActiveChallengesFor(interaction.user.id, guildId),
  ]);

  if (pending.length === 0 && active.length === 0) {
    await interaction.editReply({
      embeds: [
        fantasyEmbed({
          title: `${EMOJIS.FOOTBALL} Your Matchups`,
          description: "You have no pending, accepted, or active challenges. Use `/challenge` to start one.",
        }),
      ],
    });
    return;
  }

  const fields = [];

  if (pending.length > 0) {
    fields.push({
      name: `Pending (${pending.length})`,
      value: pending.map((c) => formatEntry(c, interaction.user.id)).join("\n"),
      inline: false,
    });
  }

  if (active.length > 0) {
    fields.push({
      name: `Accepted / Live (${active.length})`,
      value: active.map((c) => formatEntry(c, interaction.user.id)).join("\n"),
      inline: false,
    });
  }

  const embed = fantasyEmbed({
    title: `${EMOJIS.FOOTBALL} Your Matchups`,
    fields,
    footerText: "Use /matchup <challenge_id> for details on a specific one",
  });

  await interaction.editReply({ embeds: [embed] });
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("matchup")
    .setDescription("View your fantasy challenge matchups")
    .addStringOption((option) =>
      option
        .setName("challenge_id")
        .setDescription("View a specific challenge by ID (omit to list all of yours)")
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
      if (providedId) {
        await showSingleMatchup(interaction, providedId);
        return;
      }

      await showAllMatchups(interaction, guildId);
    } catch (error: unknown) {
      logger.error("Error in /matchup command", { error, userId: interaction.user.id });

      const message =
        error instanceof ChallengeError || error instanceof Error
          ? error.message
          : "Failed to load matchup information.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { isValidObjectId } from "mongoose";
import type { Command } from "../../types/discord";
import { challengeService, ChallengeError } from "../../services/fantasy/ChallengeService";
import { FantasyTeam } from "../../database/models/FantasyTeam";
import { errorEmbed, fantasyEmbed } from "../../utils/embeds";
import { EMOJIS } from "../../config/constants";
import { formatPoints } from "../../utils/formatter";
import { logger } from "../../utils/logger";
import type { ChallengeStatus } from "../../database/models/Challenge";

const STATUS_LABELS: Record<ChallengeStatus, string> = {
  pending: "⏳ Pending",
  accepted: "✅ Accepted — not started",
  active: "🔴 Live",
  completed: "🏁 Completed",
  declined: "❌ Declined",
  cancelled: "🚫 Cancelled",
};

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

    if (!interaction.guildId) {
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
        await this.showSingleMatchup(interaction, providedId);
        return;
      }

      await this.showAllMatchups(interaction);
    } catch (error) {
      logger.error("Error in /matchup command", { error, userId: interaction.user.id });

      const message =
        error instanceof ChallengeError || error instanceof Error
          ? error.message
          : "Failed to load matchup information.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },

  async showSingleMatchup(interaction: ChatInputCommandInteraction, challengeId: string): Promise<void> {
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
        value:
          challenge.status === "completed"
            ? formatPoints(challenge.proposerScore ?? 0)
            : "Score pending",
        inline: true,
      },
      {
        name: `<@${challenge.opponentDiscordId}>`,
        value:
          challenge.status === "completed"
            ? formatPoints(challenge.opponentScore ?? 0)
            : "Score pending",
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
  },

  async showAllMatchups(interaction: ChatInputCommandInteraction): Promise<void> {
    const [pending, active] = await Promise.all([
      challengeService.getPendingChallengesFor(interaction.user.id, interaction.guildId!),
      challengeService.getActiveChallengesFor(interaction.user.id, interaction.guildId!),
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

    const formatEntry = (c: (typeof pending)[number]): string => {
      const isProposer = c.proposerDiscordId === interaction.user.id;
      const opponentId = isProposer ? c.opponentDiscordId : c.proposerDiscordId;
      return `• vs <@${opponentId}> — GW${c.gameweek} — ${STATUS_LABELS[c.status]} — ID: \`${c.id}\``;
    };

    const fields = [];

    if (pending.length > 0) {
      fields.push({
        name: `Pending (${pending.length})`,
        value: pending.map(formatEntry).join("\n"),
        inline: false,
      });
    }

    if (active.length > 0) {
      fields.push({
        name: `Accepted / Live (${active.length})`,
        value: active.map(formatEntry).join("\n"),
        inline: false,
      });
    }

    const embed = fantasyEmbed({
      title: `${EMOJIS.FOOTBALL} Your Matchups`,
      fields,
      footerText: "Use /matchup <challenge_id> for details on a specific one",
    });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;

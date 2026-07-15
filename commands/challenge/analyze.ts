import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { isValidObjectId } from "mongoose";
import type { Command } from "../../types/discord";
import { challengeService, ChallengeError } from "../../services/fantasy/ChallengeService";
import { FantasyTeam } from "../../database/models/FantasyTeam";
import { aiService, AIServiceError } from "../../services/ai/AIService";
import { errorEmbed, aiEmbed, loadingEmbed } from "../../utils/embeds";
import { EMOJIS } from "../../config/constants";
import { formatPoints } from "../../utils/formatter";
import { logger } from "../../utils/logger";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("analyze")
    .setDescription("Get an AI breakdown of a fantasy challenge matchup")
    .addStringOption((option) =>
      option
        .setName("challenge_id")
        .setDescription("The challenge ID (omit if you only have one active/accepted challenge)")
        .setRequired(false),
    ) as SlashCommandBuilder,
  category: "challenge",
  cooldown: 15,

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
      let challengeId = providedId;

      if (!challengeId) {
        const relevant = await challengeService.getActiveChallengesFor(
          interaction.user.id,
          interaction.guildId,
        );

        if (relevant.length === 0) {
          await interaction.editReply({
            embeds: [
              errorEmbed(
                "You don't have any accepted or active challenges to analyze. Use `/challenge` to start one.",
              ),
            ],
          });
          return;
        }

        if (relevant.length > 1) {
          const list = relevant
            .map((c) => {
              const opponentId =
                c.proposerDiscordId === interaction.user.id ? c.opponentDiscordId : c.proposerDiscordId;
              return `• vs <@${opponentId}> (GW${c.gameweek}, ${c.status}) — ID: \`${c.id}\``;
            })
            .join("\n");

          await interaction.editReply({
            embeds: [
              errorEmbed(`You have multiple challenges. Specify one with \`challenge_id\`:\n\n${list}`),
            ],
          });
          return;
        }

        challengeId = relevant[0].id;
      }

      const challenge = await challengeService.getChallenge(challengeId);

      if (!challenge) {
        await interaction.editReply({ embeds: [errorEmbed("That challenge no longer exists.")] });
        return;
      }

      const isParticipant =
        challenge.proposerDiscordId === interaction.user.id ||
        challenge.opponentDiscordId === interaction.user.id;

      if (!isParticipant) {
        await interaction.editReply({
          embeds: [errorEmbed("You're not part of this challenge.")],
        });
        return;
      }

      if (!challenge.opponentFantasyTeamId) {
        await interaction.editReply({
          embeds: [errorEmbed("This challenge hasn't been accepted yet, so there's no opponent team to compare.")],
        });
        return;
      }

      await interaction.editReply({ embeds: [loadingEmbed("Analyzing matchup...")] });

      const [proposerTeam, opponentTeam] = await Promise.all([
        FantasyTeam.findById(challenge.proposerFantasyTeamId),
        FantasyTeam.findById(challenge.opponentFantasyTeamId),
      ]);

      if (!proposerTeam || !opponentTeam) {
        await interaction.editReply({
          embeds: [errorEmbed("Could not load one or both fantasy teams for this challenge.")],
        });
        return;
      }

      const summarizeTeam = (team: typeof proposerTeam) => {
        const captain = team.players.find((p) => p.isCaptain);
        const starting = team.players.filter((p) => p.isStarting);
        return `${team.teamName}: ${starting.length} starters, ${formatPoints(team.totalPoints)} total, captain: ${captain?.name ?? "none set"}`;
      };

      const systemPrompt =
        "You are GoalX's fantasy football analyst. Compare two fantasy teams head-to-head and give a brief, balanced prediction of who has the edge and why. Keep it under 120 words, confident but not definitive, and avoid guaranteeing outcomes.";

      const prompt = `Team A (${challenge.proposerDiscordId}): ${summarizeTeam(proposerTeam)}\nTeam B (${challenge.opponentDiscordId}): ${summarizeTeam(opponentTeam)}\n\nWho has the edge for Gameweek ${challenge.gameweek} and why?`;

      let analysis: string;
      try {
        analysis = await aiService.generateText(prompt, { systemPrompt, maxTokens: 220 });
      } catch (aiError) {
        logger.warn("AI analysis failed for challenge, falling back to stats-only view", {
          error: aiError,
          challengeId,
        });
        analysis =
          "AI analysis is temporarily unavailable, so here's the raw comparison — check total points and captain picks above to judge the matchup yourself.";
      }

      const embed = aiEmbed({
        title: `${EMOJIS.ROBOT} Challenge Analysis`,
        description: analysis,
        fields: [
          { name: `<@${challenge.proposerDiscordId}>`, value: summarizeTeam(proposerTeam), inline: false },
          { name: `<@${challenge.opponentDiscordId}>`, value: summarizeTeam(opponentTeam), inline: false },
        ],
        footerText: `Gameweek ${challenge.gameweek} • Challenge ID: ${challenge.id}`,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error("Error in /analyze command", { error, userId: interaction.user.id });

      const message =
        error instanceof ChallengeError || error instanceof AIServiceError || error instanceof Error
          ? error.message
          : "Failed to analyze that challenge.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

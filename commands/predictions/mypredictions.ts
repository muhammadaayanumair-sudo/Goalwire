import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { predictionService } from "../../services/predictions/PredictionService";
import { Prediction } from "../../database/models/Prediction";
import { errorEmbed, fantasyEmbed } from "../../utils/embeds";
import { EMOJIS } from "../../config/constants";
import { logger } from "../../utils/logger";

const MAX_RECENT_DISPLAYED = 8;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("mypredictions")
    .setDescription("View your prediction history and accuracy") as SlashCommandBuilder,
  category: "predictions",
  cooldown: 5,

  async execute(client, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const stats = await predictionService.getUserPredictionStats(interaction.user.id);

      if (stats.total === 0) {
        await interaction.editReply({
          embeds: [
            fantasyEmbed({
              title: `${EMOJIS.ROBOT} Your Predictions`,
              description: "You haven't made any predictions yet. Use `/predict` on an upcoming fixture to get started.",
            }),
          ],
        });
        return;
      }

      const scoredTotal = stats.correctExact + stats.correctOutcome + stats.incorrect;
      const accuracy = scoredTotal > 0 ? Math.round(((stats.correctExact + stats.correctOutcome) / scoredTotal) * 100) : 0;

      const recent = await Prediction.find({ discordId: interaction.user.id, status: { $ne: "pending" } })
        .sort({ scoredAt: -1 })
        .limit(MAX_RECENT_DISPLAYED)
        .lean();

      const statusIcon = (status: string): string => {
        if (status === "correct_exact") return "🎯";
        if (status === "correct_outcome") return "✅";
        if (status === "void") return "🚫";
        return "❌";
      };

      const recentLines = recent
        .map(
          (p) =>
            `${statusIcon(p.status)} ${p.homeTeamName} ${p.predictedHomeScore}-${p.predictedAwayScore} ${p.awayTeamName} (actual: ${p.actualHomeScore ?? "?"}-${p.actualAwayScore ?? "?"})`,
        )
        .join("\n");

      const embed = fantasyEmbed({
        title: `${EMOJIS.ROBOT} Your Predictions`,
        fields: [
          { name: "Total Predictions", value: `${stats.total}`, inline: true },
          { name: "Accuracy", value: `${accuracy}%`, inline: true },
          { name: "Pending", value: `${stats.pending}`, inline: true },
          { name: "🎯 Exact Scores", value: `${stats.correctExact}`, inline: true },
          { name: "✅ Correct Outcomes", value: `${stats.correctOutcome}`, inline: true },
          { name: "❌ Incorrect", value: `${stats.incorrect}`, inline: true },
          ...(recentLines ? [{ name: "Recent Results", value: recentLines, inline: false }] : []),
        ],
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error("Error in /mypredictions command", { error, userId: interaction.user.id });
      await interaction.editReply({ embeds: [errorEmbed("Failed to load your prediction history.")] });
    }
  },
};

export default command;

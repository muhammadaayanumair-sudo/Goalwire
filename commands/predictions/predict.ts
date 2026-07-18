import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { predictionService, PredictionError } from "../../services/predictions/PredictionService";
import { errorEmbed, predictionEmbed } from "../../utils/embeds";
import { logger } from "../../utils/logger";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("predict")
    .setDescription("Predict the scoreline of an upcoming fixture")
    .addIntegerOption((option) =>
      option.setName("fixture_id").setDescription("The fixture ID to predict").setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("home_score")
        .setDescription("Your predicted home team score")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(20),
    )
    .addIntegerOption((option) =>
      option
        .setName("away_score")
        .setDescription("Your predicted away team score")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(20),
    ) as SlashCommandBuilder,
  category: "predictions",
  cooldown: 5,

  async execute(client, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    if (!interaction.guildId) {
      await interaction.editReply({
        embeds: [errorEmbed("This command can only be used inside a server.")],
      });
      return;
    }

    const fixtureId = interaction.options.getInteger("fixture_id", true);
    const homeScore = interaction.options.getInteger("home_score", true);
    const awayScore = interaction.options.getInteger("away_score", true);

    try {
      const prediction = await predictionService.createPrediction(
        interaction.user.id,
        interaction.guildId,
        fixtureId,
        homeScore,
        awayScore,
      );

      const embed = predictionEmbed({
        username: interaction.user.username,
        homeScore,
        awayScore,
        fixtureLabel: `${prediction.homeTeamName} vs ${prediction.awayTeamName}`,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error("Error in /predict command", { error, userId: interaction.user.id, fixtureId });

      const message =
        error instanceof PredictionError || error instanceof Error
          ? error.message
          : "Failed to save your prediction.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type { Command } from "../../types/discord";
import { predictionService, PredictionError } from "../../services/predictions/PredictionService";
import { matchService, MatchServiceError } from "../../services/football/MatchService";
import { errorEmbed, predictionEmbed, liveEmbed } from "../../utils/embeds";
import { formatDate } from "../../utils/formatter";
import { logger } from "../../utils/logger";
import type { FootballFixture } from "../../types/football";

const MAX_SEARCH_RESULTS = 5;
const SEARCH_COLLECTOR_TIMEOUT_MS = 60000;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function submitPrediction(
  interaction: ChatInputCommandInteraction,
  fixtureId: number,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  if (!interaction.guildId) return;

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

  await interaction.editReply({ embeds: [embed], components: [] });
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("predict")
    .setDescription("Predict the scoreline of an upcoming fixture")
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
    )
    .addIntegerOption((option) =>
      option
        .setName("fixture_id")
        .setDescription("Exact fixture ID, if you already know it (skips search)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("team")
        .setDescription("Search today's/upcoming fixtures by team name instead of using a fixture ID")
        .setRequired(false),
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

    const homeScore = interaction.options.getInteger("home_score", true);
    const awayScore = interaction.options.getInteger("away_score", true);
    const fixtureId = interaction.options.getInteger("fixture_id");
    const teamQuery = interaction.options.getString("team");

    try {
      if (fixtureId) {
        await submitPrediction(interaction, fixtureId, homeScore, awayScore);
        return;
      }

      if (!teamQuery) {
        await interaction.editReply({
          embeds: [
            errorEmbed(
              "Provide either `fixture_id` (if you know it) or `team` to search for an upcoming fixture to predict.",
            ),
          ],
        });
        return;
      }

      const today = todayIsoDate();
      const todayFixtures = await matchService.getFixturesByDate(today);

      const matches = todayFixtures.filter((fixture) => {
        const query = teamQuery.toLowerCase();
        return (
          fixture.teams.home.name.toLowerCase().includes(query) ||
          fixture.teams.away.name.toLowerCase().includes(query)
        );
      });

      const upcoming = matches.filter((fixture) => fixture.status.short === "NS").slice(0, MAX_SEARCH_RESULTS);

      if (upcoming.length === 0) {
        await interaction.editReply({
          embeds: [
            errorEmbed(
              `No upcoming (not-yet-started) fixtures today matching "${teamQuery}". Try \`/fixtures team_id:...\` to find a fixture ID on a different date, then use \`fixture_id\` directly.`,
            ),
          ],
        });
        return;
      }

      if (upcoming.length === 1) {
        await submitPrediction(interaction, upcoming[0].id, homeScore, awayScore);
        return;
      }

      const embed = liveEmbed({
        title: "Multiple Fixtures Found",
        description: `Found ${upcoming.length} upcoming fixtures matching "${teamQuery}" today. Pick one to predict ${homeScore}-${awayScore} on:`,
        fields: upcoming.map((fixture) => ({
          name: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
          value: `${formatDate(fixture.date)} • ${fixture.league.name}`,
          inline: false,
        })),
      });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...upcoming.map((fixture, index) =>
          new ButtonBuilder()
            .setCustomId(`predict_pick_${fixture.id}`)
            .setLabel(`${index + 1}`)
            .setStyle(ButtonStyle.Primary),
        ),
      );

      const message = await interaction.editReply({ embeds: [embed], components: [row] });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: SEARCH_COLLECTOR_TIMEOUT_MS,
        filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith("predict_pick_"),
        max: 1,
      });

      collector.on("collect", async (buttonInteraction) => {
        try {
          await buttonInteraction.deferUpdate();
          const chosenFixtureId = Number(buttonInteraction.customId.replace("predict_pick_", ""));
          await submitPrediction(interaction, chosenFixtureId, homeScore, awayScore);
        } catch (error) {
          logger.error("Error submitting prediction from fixture picker", { error, userId: interaction.user.id });

          const message =
            error instanceof PredictionError || error instanceof Error
              ? error.message
              : "Failed to save your prediction.";

          await interaction.editReply({ embeds: [errorEmbed(message)], components: [] });
        }
      });

      collector.on("end", async (collected) => {
        if (collected.size === 0) {
          try {
            await interaction.editReply({ components: [] });
          } catch (error) {
            logger.warn("Failed to clear fixture picker buttons on timeout", { error });
          }
        }
      });
    } catch (error) {
      logger.error("Error in /predict command", { error, userId: interaction.user.id, fixtureId, teamQuery });

      const message =
        error instanceof PredictionError || error instanceof MatchServiceError || error instanceof Error
          ? error.message
          : "Failed to save your prediction.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

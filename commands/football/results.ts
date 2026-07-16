import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { matchService, MatchServiceError } from "../../services/football/MatchService";
import { errorEmbed, liveEmbed } from "../../utils/embeds";
import { EMOJIS, LEAGUE_IDS } from "../../config/constants";
import { formatDate } from "../../utils/formatter";
import { logger } from "../../utils/logger";
import type { FootballFixture } from "../../types/football";

const LEAGUE_CHOICES = [
  { name: "Premier League", value: LEAGUE_IDS.PREMIER_LEAGUE },
  { name: "La Liga", value: LEAGUE_IDS.LA_LIGA },
  { name: "Bundesliga", value: LEAGUE_IDS.BUNDESLIGA },
  { name: "Serie A", value: LEAGUE_IDS.SERIE_A },
  { name: "Ligue 1", value: LEAGUE_IDS.LIGUE_1 },
  { name: "Champions League", value: LEAGUE_IDS.CHAMPIONS_LEAGUE },
];

const MAX_RESULTS_DISPLAYED = 10;
const DEFAULT_RESULT_COUNT = 5;
const MAX_RESULT_COUNT = 15;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("results")
    .setDescription("View recent match results")
    .addIntegerOption((option) =>
      option
        .setName("team_id")
        .setDescription("Show recent results for a specific team ID")
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName("league")
        .setDescription("Filter by league (only used without team_id)")
        .setRequired(false)
        .addChoices(...LEAGUE_CHOICES),
    )
    .addIntegerOption((option) =>
      option
        .setName("count")
        .setDescription(`Number of recent results to show (default ${DEFAULT_RESULT_COUNT})`)
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(MAX_RESULT_COUNT),
    ) as SlashCommandBuilder,
  category: "football",
  cooldown: 5,

  async execute(client, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const teamId = interaction.options.getInteger("team_id") ?? undefined;
    const leagueId = interaction.options.getInteger("league") ?? undefined;
    const count = interaction.options.getInteger("count") ?? DEFAULT_RESULT_COUNT;

    if (!teamId && !leagueId) {
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "Please specify at least a `team_id` or a `league` to see results — showing every result across all football would be too broad.",
          ),
        ],
      });
      return;
    }

    try {
      let fixtures: FootballFixture[];
      let contextLabel: string;

      if (teamId) {
        fixtures = await matchService.getRecentResults(teamId, count);
        contextLabel = `Recent results for team ID ${teamId}`;
      } else {
        const today = new Date();
        const fixturesByDate: FootballFixture[] = [];

        for (let i = 0; i < 7 && fixturesByDate.length < count; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateString = date.toISOString().slice(0, 10);

          const dayFixtures = await matchService.getFixturesByDate(dateString, leagueId);
          const finished = dayFixtures.filter(
            (f) => f.status.short === "FT" || f.status.short === "AET" || f.status.short === "PEN",
          );

          fixturesByDate.push(...finished);
        }

        fixtures = fixturesByDate.slice(0, count);
        contextLabel = "Recent results";
      }

      if (fixtures.length === 0) {
        await interaction.editReply({
          embeds: [
            liveEmbed({
              title: `${EMOJIS.FOOTBALL} Results`,
              description: teamId
                ? "No recent finished matches found for this team."
                : "No finished matches found in the last 7 days for this league.",
            }),
          ],
        });
        return;
      }

      const fields = fixtures.slice(0, MAX_RESULTS_DISPLAYED).map((fixture) => ({
        name: `${fixture.teams.home.name} ${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0} ${fixture.teams.away.name}`,
        value: `${formatDate(fixture.date, false)} • ${fixture.league.name}`,
        inline: false,
      }));

      const embed = liveEmbed({
        title: `${EMOJIS.FOOTBALL} ${contextLabel}`,
        fields,
        footerText:
          fixtures.length > MAX_RESULTS_DISPLAYED
            ? `Showing ${MAX_RESULTS_DISPLAYED} of ${fixtures.length} results`
            : undefined,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error("Error in /results command", { error, teamId, leagueId, count });

      const message = error instanceof MatchServiceError ? error.message : "Failed to load results.";
      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

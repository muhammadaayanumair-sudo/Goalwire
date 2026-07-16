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

const MAX_FIXTURES_DISPLAYED = 10;

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("fixtures")
    .setDescription("View upcoming fixtures")
    .addIntegerOption((option) =>
      option
        .setName("league")
        .setDescription("Filter to a specific league")
        .setRequired(false)
        .addChoices(...LEAGUE_CHOICES),
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("Date to check (YYYY-MM-DD, defaults to today)")
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName("team_id")
        .setDescription("Show upcoming fixtures for a specific team ID instead of by date")
        .setRequired(false),
    ) as SlashCommandBuilder,
  category: "football",
  cooldown: 5,

  async execute(client, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const leagueId = interaction.options.getInteger("league") ?? undefined;
    const dateOption = interaction.options.getString("date");
    const teamId = interaction.options.getInteger("team_id") ?? undefined;

    if (dateOption && !isValidDateString(dateOption)) {
      await interaction.editReply({
        embeds: [errorEmbed("Date must be in `YYYY-MM-DD` format, e.g. `2026-08-16`.")],
      });
      return;
    }

    try {
      let fixtures: FootballFixture[];
      let contextLabel: string;

      if (teamId) {
        fixtures = await matchService.getUpcomingFixtures(teamId, MAX_FIXTURES_DISPLAYED);
        contextLabel = `Upcoming fixtures for team ID ${teamId}`;
      } else {
        const targetDate = dateOption ?? todayIsoDate();
        fixtures = await matchService.getFixturesByDate(targetDate, leagueId);
        contextLabel = `Fixtures for ${targetDate}`;
      }

      if (fixtures.length === 0) {
        await interaction.editReply({
          embeds: [
            liveEmbed({
              title: `${EMOJIS.FOOTBALL} Fixtures`,
              description: `No fixtures found. ${teamId ? "This team may have no scheduled matches." : "Try a different date or league."}`,
            }),
          ],
        });
        return;
      }

      const fields = fixtures.slice(0, MAX_FIXTURES_DISPLAYED).map((fixture) => ({
        name: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
        value: `${formatDate(fixture.date)} • ${fixture.league.name}`,
        inline: false,
      }));

      const embed = liveEmbed({
        title: `${EMOJIS.FOOTBALL} ${contextLabel}`,
        fields,
        footerText:
          fixtures.length > MAX_FIXTURES_DISPLAYED
            ? `Showing ${MAX_FIXTURES_DISPLAYED} of ${fixtures.length} fixtures`
            : undefined,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error("Error in /fixtures command", { error, leagueId, dateOption, teamId });

      const message =
        error instanceof MatchServiceError
          ? error.message
          : "Failed to load fixtures.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

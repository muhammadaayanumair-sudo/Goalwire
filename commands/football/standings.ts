import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { matchService, MatchServiceError } from "../../services/football/MatchService";
import { errorEmbed, liveEmbed } from "../../utils/embeds";
import { EMOJIS, LEAGUE_IDS } from "../../config/constants";
import { logger } from "../../utils/logger";
import type { FootballStanding } from "../../types/football";

const LEAGUE_CHOICES = [
  { name: "Premier League", value: LEAGUE_IDS.PREMIER_LEAGUE },
  { name: "La Liga", value: LEAGUE_IDS.LA_LIGA },
  { name: "Bundesliga", value: LEAGUE_IDS.BUNDESLIGA },
  { name: "Serie A", value: LEAGUE_IDS.SERIE_A },
  { name: "Ligue 1", value: LEAGUE_IDS.LIGUE_1 },
];

const MAX_ROWS_DISPLAYED = 20;

function currentSeasonYear(): number {
  // Football seasons that span two calendar years (e.g. Aug 2026 - May 2027)
  // are conventionally referenced by their starting year in API-Football.
  const now = new Date();
  const month = now.getMonth() + 1;
  return month >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

function formatForm(form: string | null): string {
  if (!form) return "—";
  return form
    .split("")
    .slice(-5)
    .map((result) => {
      if (result === "W") return "🟢";
      if (result === "D") return "⚪";
      if (result === "L") return "🔴";
      return "—";
    })
    .join("");
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("standings")
    .setDescription("View a league table")
    .addIntegerOption((option) =>
      option
        .setName("league")
        .setDescription("Which league")
        .setRequired(true)
        .addChoices(...LEAGUE_CHOICES),
    )
    .addIntegerOption((option) =>
      option
        .setName("season")
        .setDescription("Season start year (defaults to current season)")
        .setRequired(false)
        .setMinValue(2000)
        .setMaxValue(2100),
    ) as SlashCommandBuilder,
  category: "football",
  cooldown: 5,

  async execute(client, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const leagueId = interaction.options.getInteger("league", true);
    const season = interaction.options.getInteger("season") ?? currentSeasonYear();
    const leagueName = LEAGUE_CHOICES.find((l) => l.value === leagueId)?.name ?? "League";

    try {
      const standings = await matchService.getStandings(leagueId, season);

      if (standings.length === 0) {
        await interaction.editReply({
          embeds: [
            errorEmbed(
              `No standings data found for ${leagueName} in the ${season}/${season + 1} season. It may not have started yet.`,
            ),
          ],
        });
        return;
      }

      const embed = this.buildStandingsEmbed(leagueName, season, standings);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error("Error in /standings command", { error, leagueId, season });

      const message = error instanceof MatchServiceError ? error.message : "Failed to load standings.";
      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },

  buildStandingsEmbed(leagueName: string, season: number, standings: FootballStanding[]) {
    const rows = standings.slice(0, MAX_ROWS_DISPLAYED);

    const header = "`#  Team                 P   W  D  L  GD  Pts  Form`";
    const lines = rows.map((row) => {
      const rank = String(row.rank).padEnd(2);
      const team = row.team.name.length > 18 ? `${row.team.name.slice(0, 17)}.` : row.team.name.padEnd(19);
      const played = String(row.all.played).padStart(2);
      const won = String(row.all.win).padStart(2);
      const drawn = String(row.all.draw).padStart(2);
      const lost = String(row.all.lose).padStart(2);
      const gd = String(row.goalsDiff >= 0 ? `+${row.goalsDiff}` : row.goalsDiff).padStart(3);
      const points = String(row.points).padStart(3);

      return `\`${rank} ${team} ${played}  ${won} ${drawn} ${lost} ${gd} ${points}\`  ${formatForm(row.form)}`;
    });

    return liveEmbed({
      title: `${EMOJIS.TROPHY} ${leagueName} — ${season}/${season + 1}`,
      description: [header, ...lines].join("\n"),
      footerText:
        standings.length > MAX_ROWS_DISPLAYED
          ? `Showing top ${MAX_ROWS_DISPLAYED} of ${standings.length} teams`
          : undefined,
    });
  },
};

export default command;

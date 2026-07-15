import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type { Command } from "../../types/discord";
import { liveService, LiveServiceError } from "../../services/football/LiveService";
import { errorEmbed, liveEmbed } from "../../utils/embeds";
import { CUSTOM_IDS, EMOJIS, LEAGUE_IDS } from "../../config/constants";
import { formatMatchTime, formatMatchStatus } from "../../utils/formatter";
import { logger } from "../../utils/logger";
import type { FootballFixture } from "../../types/football";

const REFRESH_COOLDOWN_MS = 15000;
const COLLECTOR_TIMEOUT_MS = 300000;

const LEAGUE_CHOICES = [
  { name: "Premier League", value: LEAGUE_IDS.PREMIER_LEAGUE },
  { name: "La Liga", value: LEAGUE_IDS.LA_LIGA },
  { name: "Bundesliga", value: LEAGUE_IDS.BUNDESLIGA },
  { name: "Serie A", value: LEAGUE_IDS.SERIE_A },
  { name: "Ligue 1", value: LEAGUE_IDS.LIGUE_1 },
  { name: "Champions League", value: LEAGUE_IDS.CHAMPIONS_LEAGUE },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("live")
    .setDescription("Show currently live football matches")
    .addIntegerOption((option) =>
      option
        .setName("league")
        .setDescription("Filter to a specific league")
        .setRequired(false)
        .addChoices(...LEAGUE_CHOICES),
    ) as SlashCommandBuilder,
  category: "football",
  cooldown: 5,

  async execute(client, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const leagueId = interaction.options.getInteger("league") ?? undefined;
    let lastRefresh = Date.now();

    try {
      const fixtures = await liveService.getLiveFixtures(leagueId);

      if (fixtures.length === 0) {
        await interaction.editReply({
          embeds: [
            liveEmbed({
              title: `${EMOJIS.FOOTBALL} Live Matches`,
              description: leagueId
                ? "No live matches in this league right now."
                : "No matches are live right now. Check back closer to kickoff.",
            }),
          ],
        });
        return;
      }

      const embed = this.buildLiveEmbed(fixtures);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(CUSTOM_IDS.MATCH.REFRESH)
          .setLabel("Refresh")
          .setEmoji("🔄")
          .setStyle(ButtonStyle.Primary),
      );

      const message = await interaction.editReply({ embeds: [embed], components: [row] });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: COLLECTOR_TIMEOUT_MS,
        filter: (i) => i.customId === CUSTOM_IDS.MATCH.REFRESH,
      });

      collector.on("collect", async (buttonInteraction) => {
        const timeSinceRefresh = Date.now() - lastRefresh;

        if (timeSinceRefresh < REFRESH_COOLDOWN_MS) {
          const waitSeconds = Math.ceil((REFRESH_COOLDOWN_MS - timeSinceRefresh) / 1000);
          await buttonInteraction.reply({
            embeds: [errorEmbed(`Please wait ${waitSeconds}s before refreshing again.`)],
            ephemeral: true,
          });
          return;
        }

        try {
          await buttonInteraction.deferUpdate();
          lastRefresh = Date.now();

          const refreshedFixtures = await liveService.getLiveFixtures(leagueId);

          if (refreshedFixtures.length === 0) {
            await interaction.editReply({
              embeds: [
                liveEmbed({
                  title: `${EMOJIS.FOOTBALL} Live Matches`,
                  description: "No matches are live anymore.",
                }),
              ],
              components: [],
            });
            collector.stop("no_more_live");
            return;
          }

          await interaction.editReply({
            embeds: [this.buildLiveEmbed(refreshedFixtures)],
            components: [row],
          });
        } catch (error) {
          logger.error("Error refreshing live matches", { error });
          await buttonInteraction.followUp({
            embeds: [errorEmbed("Failed to refresh live matches. Please try again shortly.")],
            ephemeral: true,
          });
        }
      });

      collector.on("end", async (_collected, reason) => {
        if (reason === "no_more_live") return;

        try {
          const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            ButtonBuilder.from(row.components[0]).setDisabled(true),
          );
          await interaction.editReply({ components: [disabledRow] });
        } catch (error) {
          logger.warn("Failed to disable refresh button on timeout", { error });
        }
      });
    } catch (error) {
      logger.error("Error in /live command", { error });

      const message =
        error instanceof LiveServiceError
          ? "Live match data is temporarily unavailable. Please try again shortly."
          : "Failed to load live matches.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },

  buildLiveEmbed(fixtures: FootballFixture[]) {
    const fields = fixtures.slice(0, 10).map((fixture) => {
      const timeDisplay =
        fixture.status.elapsed !== null
          ? formatMatchTime(fixture.status.elapsed)
          : formatMatchStatus(fixture.status.short);

      return {
        name: `${fixture.teams.home.name} ${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0} ${fixture.teams.away.name}`,
        value: `${timeDisplay} • ${fixture.league.name}`,
        inline: false,
      };
    });

    return liveEmbed({
      title: `${EMOJIS.FOOTBALL} Live Matches (${fixtures.length})`,
      fields,
      footerText:
        fixtures.length > 10 ? `Showing 10 of ${fixtures.length} live matches` : "Updates every refresh",
    });
  },
};

export default command;

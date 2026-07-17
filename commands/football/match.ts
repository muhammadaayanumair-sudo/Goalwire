import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/discord";
import { liveService, LiveServiceError } from "../../services/football/LiveService";
import { errorEmbed, liveEmbed } from "../../utils/embeds";
import { CUSTOM_IDS, EMOJIS } from "../../config/constants";
import { formatMatchTime, formatMatchStatus } from "../../utils/formatter";
import { logger } from "../../utils/logger";
import type { FootballFixture, FootballEvent, FootballLineup } from "../../types/football";

const COLLECTOR_TIMEOUT_MS = 300000;
const REFRESH_COOLDOWN_MS = 15000;

type ViewMode = "overview" | "stats" | "lineups" | "timeline";

function buildOverviewEmbed(fixture: FootballFixture): EmbedBuilder {
  const timeDisplay =
    fixture.status.elapsed !== null
      ? formatMatchTime(fixture.status.elapsed)
      : formatMatchStatus(fixture.status.short);

  return liveEmbed({
    title: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
    description: `**${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}**\n${timeDisplay}`,
    fields: [
      { name: "Competition", value: fixture.league.name, inline: true },
      { name: "Venue", value: fixture.venue.name ?? "Unknown", inline: true },
      { name: "Referee", value: fixture.referee ?? "TBD", inline: true },
    ],
  });
}

async function buildStatsEmbed(fixtureId: number, fixture: FootballFixture): Promise<EmbedBuilder> {
  try {
    const stats = await liveService.getFixtureStatistics(fixtureId);

    if (!stats || stats.length === 0) {
      return liveEmbed({
        title: `${EMOJIS.CHART} Match Statistics`,
        description: "No statistics available for this fixture yet.",
      });
    }

    const fields = stats.slice(0, 2).map((teamStats: unknown) => {
      const typed = teamStats as {
        team?: { name: string };
        statistics?: { type: string; value: string | number | null }[];
      };
      const lines = (typed.statistics ?? [])
        .slice(0, 8)
        .map((stat) => `${stat.type}: **${stat.value ?? "N/A"}**`)
        .join("\n");

      return { name: typed.team?.name ?? "Team", value: lines || "No data", inline: true };
    });

    return liveEmbed({
      title: `${EMOJIS.CHART} Match Statistics`,
      description: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
      fields,
    });
  } catch (error) {
    logger.error("Failed to build stats embed", { error, fixtureId });
    return errorEmbed("Failed to load match statistics.");
  }
}

async function buildLineupsEmbed(fixtureId: number, fixture: FootballFixture): Promise<EmbedBuilder> {
  try {
    const lineups = await liveService.getFixtureLineups(fixtureId);

    if (lineups.length === 0) {
      return liveEmbed({
        title: `${EMOJIS.FOOTBALL} Lineups`,
        description: "Lineups haven't been announced yet.",
      });
    }

    const fields = lineups.slice(0, 2).map((lineup: FootballLineup) => {
      const starters = lineup.startXI.map((p) => p.player.name).join("\n") || "Unavailable";
      return {
        name: `${lineup.team.name} (${lineup.formation || "N/A"})`,
        value: starters,
        inline: true,
      };
    });

    return liveEmbed({
      title: `${EMOJIS.FOOTBALL} Lineups`,
      description: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
      fields,
    });
  } catch (error) {
    logger.error("Failed to build lineups embed", { error, fixtureId });
    return errorEmbed("Failed to load lineups.");
  }
}

async function buildTimelineEmbed(fixtureId: number, fixture: FootballFixture): Promise<EmbedBuilder> {
  try {
    const events = await liveService.getFixtureEvents(fixtureId);

    if (events.length === 0) {
      return liveEmbed({
        title: `${EMOJIS.FOOTBALL} Match Timeline`,
        description: "No events recorded yet.",
      });
    }

    const eventIcon = (event: FootballEvent): string => {
      if (event.type === "Goal") return EMOJIS.GOAL;
      if (event.type === "Card" && event.detail.toLowerCase().includes("yellow")) return EMOJIS.CARD_YELLOW;
      if (event.type === "Card") return EMOJIS.CARD_RED;
      if (event.type === "subst") return EMOJIS.SUBSTITUTION;
      return "•";
    };

    const lines = events
      .slice(-15)
      .map((event) => {
        const time = formatMatchTime(event.time.elapsed, event.time.extra ?? undefined);
        const assist = event.assist.name ? ` (assist: ${event.assist.name})` : "";
        return `${time} ${eventIcon(event)} **${event.player.name}**${assist} — ${event.team.name}`;
      })
      .join("\n");

    return liveEmbed({
      title: `${EMOJIS.FOOTBALL} Match Timeline`,
      description: lines,
      footerText: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
    });
  } catch (error) {
    logger.error("Failed to build timeline embed", { error, fixtureId });
    return errorEmbed("Failed to load the match timeline.");
  }
}

function buildControlRows(
  fixtureId: number,
  view: ViewMode,
): ActionRowBuilder<ButtonBuilder>[] {
  const viewRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.MATCH.STATS)
      .setLabel("Stats")
      .setStyle(view === "stats" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.MATCH.LINEUPS)
      .setLabel("Lineups")
      .setStyle(view === "lineups" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.MATCH.TIMELINE)
      .setLabel("Timeline")
      .setStyle(view === "timeline" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.MATCH.REFRESH)
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Success),
  );

  const followRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_IDS.MATCH.FOLLOW}:${fixtureId}`)
      .setLabel("Follow")
      .setEmoji("🔔")
      .setStyle(ButtonStyle.Secondary),
  );

  return [viewRow, followRow];
}

async function buildViewPayload(
  fixtureId: number,
  fixture: FootballFixture,
  view: ViewMode,
): Promise<{ embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] }> {
  const rows = buildControlRows(fixtureId, view);

  switch (view) {
    case "stats":
      return { embed: await buildStatsEmbed(fixtureId, fixture), rows };
    case "lineups":
      return { embed: await buildLineupsEmbed(fixtureId, fixture), rows };
    case "timeline":
      return { embed: await buildTimelineEmbed(fixtureId, fixture), rows };
    default:
      return { embed: buildOverviewEmbed(fixture), rows };
  }
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("match")
    .setDescription("View details for a specific fixture")
    .addIntegerOption((option) =>
      option.setName("fixture_id").setDescription("The fixture ID").setRequired(true),
    ) as SlashCommandBuilder,
  category: "football",
  cooldown: 5,

  async execute(client, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const fixtureId = interaction.options.getInteger("fixture_id", true);
    let currentView: ViewMode = "overview";
    let lastRefresh = Date.now();

    try {
      const fixture = await liveService.getFixtureById(fixtureId);

      if (!fixture) {
        await interaction.editReply({
          embeds: [errorEmbed(`No fixture found with ID \`${fixtureId}\`.`)],
        });
        return;
      }

      const { embed, rows } = await buildViewPayload(fixtureId, fixture, currentView);
      const message = await interaction.editReply({ embeds: [embed], components: rows });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: COLLECTOR_TIMEOUT_MS,
        // Follow is per-user and intentionally NOT filtered to the original
        // requester — anyone viewing the match can follow it. Everything
        // else (view switching, refresh) stays requester-only.
        filter: (i) =>
          i.customId.startsWith(CUSTOM_IDS.MATCH.FOLLOW) || i.user.id === interaction.user.id,
      });

      collector.on("collect", async (buttonInteraction) => {
        try {
          if (buttonInteraction.customId.startsWith(CUSTOM_IDS.MATCH.FOLLOW)) {
            // Let the global componentHandler route this one — it needs its
            // own ephemeral reply, not a shared message edit, and is handled
            // by components/buttons/matchButtons.ts.
            return;
          }

          if (buttonInteraction.customId === CUSTOM_IDS.MATCH.REFRESH) {
            const timeSinceRefresh = Date.now() - lastRefresh;
            if (timeSinceRefresh < REFRESH_COOLDOWN_MS) {
              const waitSeconds = Math.ceil((REFRESH_COOLDOWN_MS - timeSinceRefresh) / 1000);
              await buttonInteraction.reply({
                embeds: [errorEmbed(`Please wait ${waitSeconds}s before refreshing again.`)],
                ephemeral: true,
              });
              return;
            }
            lastRefresh = Date.now();
          } else if (buttonInteraction.customId === CUSTOM_IDS.MATCH.STATS) {
            currentView = "stats";
          } else if (buttonInteraction.customId === CUSTOM_IDS.MATCH.LINEUPS) {
            currentView = "lineups";
          } else if (buttonInteraction.customId === CUSTOM_IDS.MATCH.TIMELINE) {
            currentView = "timeline";
          } else {
            return;
          }

          await buttonInteraction.deferUpdate();

          const freshFixture =
            buttonInteraction.customId === CUSTOM_IDS.MATCH.REFRESH
              ? await liveService.getFixtureById(fixtureId)
              : fixture;

          if (!freshFixture) {
            await interaction.editReply({
              embeds: [errorEmbed("This fixture is no longer available.")],
              components: [],
            });
            collector.stop("fixture_gone");
            return;
          }

          const { embed: updatedEmbed, rows: updatedRows } = await buildViewPayload(
            fixtureId,
            freshFixture,
            currentView,
          );

          await interaction.editReply({ embeds: [updatedEmbed], components: updatedRows });
        } catch (error) {
          logger.error("Error handling match view interaction", { error, fixtureId });
          await buttonInteraction.followUp({
            embeds: [errorEmbed("Failed to load that view. Please try again.")],
            ephemeral: true,
          });
        }
      });

      collector.on("end", async (_collected, reason) => {
        if (reason === "fixture_gone") return;

        try {
          const disabledRows = rows.map((row) =>
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              ...row.components.map((c) => ButtonBuilder.from(c as ButtonBuilder).setDisabled(true)),
            ),
          );
          await interaction.editReply({ components: disabledRows });
        } catch (error) {
          logger.warn("Failed to disable match view buttons on timeout", { error });
        }
      });
    } catch (error) {
      logger.error("Error in /match command", { error, fixtureId });

      const message =
        error instanceof LiveServiceError
          ? "Match data is temporarily unavailable. Please try again shortly."
          : "Failed to load that fixture.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

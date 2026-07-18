import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { GoalXClient } from "../../client/GoalXClient";
import type { ButtonComponent } from "../../types/discord";
import { fantasyService } from "../../services/fantasy/FantasyService";
import { rankingService } from "../../services/fantasy/RankingService";
import { economyService } from "../../services/economy/EconomyService";
import { errorEmbed, fantasyEmbed, successEmbed } from "../../utils/embeds";
import { CUSTOM_IDS, EMOJIS, FANTASY_POSITIONS } from "../../config/constants";
import { formatCurrency, formatPoints } from "../../utils/formatter";
import { logger } from "../../utils/logger";
import type { FantasyPosition } from "../../types/fantasy";
import {
  groupByPosition,
  validateFormation,
  autoPickStartingXI,
  buildLineupEmbed,
  buildPositionSelectRows,
} from "../../commands/fantasy/lineup";

const POSITION_ORDER: FantasyPosition[] = ["GK", "DEF", "MID", "FWD"];

function buildTeamNavigationRow(isLocked: boolean): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.FANTASY.TRANSFERS)
      .setLabel("Transfers")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isLocked),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.FANTASY.CAPTAIN)
      .setLabel("Captain")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.FANTASY.AI_SCOUT)
      .setLabel("AI Scout")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.FANTASY.LEADERBOARD)
      .setLabel("Leaderboard")
      .setStyle(ButtonStyle.Secondary),
  );
}

async function handleMyTeam(client: GoalXClient, interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  if (!interaction.guildId) return;

  try {
    const team = await fantasyService.getTeam(interaction.user.id, interaction.guildId);

    if (!team) {
      await interaction.editReply({
        embeds: [errorEmbed("You don't have a fantasy team yet. Use `/create` to get started.")],
        components: [],
      });
      return;
    }

    const fields = POSITION_ORDER.map((position) => {
      const players = team.players.filter((p) => p.position === position);
      const value =
        players.length > 0
          ? players
              .map((p) => {
                const tag = p.isCaptain ? " (C)" : p.isViceCaptain ? " (VC)" : "";
                const starting = p.isStarting ? "" : " *(bench)*";
                return `${p.name}${tag} — ${formatCurrency(p.price)}${starting}`;
              })
              .join("\n")
          : "*None selected*";

      return { name: `${FANTASY_POSITIONS[position]} (${players.length})`, value, inline: false };
    });

    const embed = fantasyEmbed({
      title: `${EMOJIS.TROPHY} ${team.teamName}`,
      description: `Total Points: **${team.totalPoints}** • Gameweek ${team.currentGameweek}: **${team.gameweekPoints}**`,
      fields: [
        ...fields,
        {
          name: "Budget",
          value: `${formatCurrency(team.remainingBudget)} remaining of ${formatCurrency(team.budget)}`,
          inline: true,
        },
        { name: "Free Transfers", value: `${team.freeTransfers}`, inline: true },
      ],
    });

    await interaction.editReply({ embeds: [embed], components: [buildTeamNavigationRow(team.isLocked)] });
  } catch (error) {
    logger.error("Error handling My Team button", { error, userId: interaction.user.id });
    await interaction.editReply({
      embeds: [errorEmbed("Failed to load your team.")],
      components: [],
    });
  }
}

async function handleAiScout(client: GoalXClient, interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  await interaction.editReply({
    embeds: [
      fantasyEmbed({
        title: `${EMOJIS.ROBOT} AI Scout`,
        description: "Run `/scout` to get fresh AI-powered player recommendations tailored to your squad and budget.",
      }),
    ],
    components: [],
  });
}

async function handleTransfers(client: GoalXClient, interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  await interaction.editReply({
    embeds: [
      fantasyEmbed({
        title: `${EMOJIS.TRANSFER} Transfers`,
        description: "Run `/transfer <player_out> <player_in>` to make a transfer — for example: `/transfer player_out: Salah player_in: Palmer`.",
      }),
    ],
    components: [],
  });
}

async function handleCaptain(client: GoalXClient, interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  if (!interaction.guildId) return;

  try {
    const team = await fantasyService.getTeam(interaction.user.id, interaction.guildId);

    if (!team) {
      await interaction.editReply({
        embeds: [errorEmbed("You don't have a fantasy team yet. Use `/create` to get started.")],
        components: [],
      });
      return;
    }

    const captain = team.players.find((p) => p.isCaptain);
    const viceCaptain = team.players.find((p) => p.isViceCaptain);

    await interaction.editReply({
      embeds: [
        fantasyEmbed({
          title: `${EMOJIS.CROWN} Captain & Vice-Captain`,
          description: [
            `Captain: ${captain ? `**${captain.name}** (×2 points)` : "*None set*"}`,
            `Vice-Captain: ${viceCaptain ? `**${viceCaptain.name}**` : "*None set*"}`,
            "",
            "Run `/captain` to change your selection.",
          ].join("\n"),
        }),
      ],
      components: [],
    });
  } catch (error) {
    logger.error("Error handling Captain button", { error, userId: interaction.user.id });
    await interaction.editReply({
      embeds: [errorEmbed("Failed to load captain info.")],
      components: [],
    });
  }
}

async function handleLeaderboard(client: GoalXClient, interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  if (!interaction.guildId) return;

  try {
    const page = await rankingService.getGlobalLeaderboard({ guildId: interaction.guildId, pageSize: 10 });

    if (page.totalEntries === 0) {
      await interaction.editReply({
        embeds: [errorEmbed("No fantasy teams have been created in this server yet.")],
        components: [],
      });
      return;
    }

    const lines = page.entries.map((entry) => {
      const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `**${entry.rank}.**`;
      return `${medal} ${entry.teamName} — ${formatPoints(entry.totalPoints)}`;
    });

    await interaction.editReply({
      embeds: [
        fantasyEmbed({
          title: `${EMOJIS.TROPHY} Fantasy Leaderboard`,
          description: lines.join("\n"),
          footerText: `Page 1 of ${page.totalPages} • Run /leaderboard to page through`,
        }),
      ],
      components: [],
    });
  } catch (error) {
    logger.error("Error handling Leaderboard button", { error, userId: interaction.user.id });
    await interaction.editReply({
      embeds: [errorEmbed("Failed to load the leaderboard.")],
      components: [],
    });
  }
}

async function handleBack(client: GoalXClient, interaction: ButtonInteraction): Promise<void> {
  await handleMyTeam(client, interaction);
}

async function handleLineupConfirm(client: GoalXClient, interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  if (!interaction.guildId) return;

  try {
    const team = await fantasyService.getTeam(interaction.user.id, interaction.guildId);

    if (!team) {
      await interaction.editReply({
        embeds: [errorEmbed("You don't have a fantasy team yet.")],
        components: [],
      });
      return;
    }

    const validation = validateFormation(team.players);

    if (!validation.isValid) {
      await interaction.editReply({
        embeds: [
          errorEmbed(
            `Your lineup isn't valid yet: ${validation.issues.join(" ")} Adjust your position selections and try again.`,
          ),
        ],
      });
      return;
    }

    const startingIds = team.players.filter((p) => p.isStarting).map((p) => p.playerId);
    await fantasyService.setStartingLineup(interaction.user.id, interaction.guildId, startingIds);

    let rewardLine = "";
    try {
      const reward = await economyService.award(interaction.user.id, interaction.user.username, "lineup_set");
      rewardLine = `\n\n+${reward.marketValueGained} Market Value, +${reward.tokensGained} Tokens`;
      if (reward.leveledUp) rewardLine += ` — ${EMOJIS.STAR} Level ${reward.newLevel}!`;
    } catch (economyError) {
      // Economy reward failing should never block the lineup itself from being confirmed.
      logger.warn("Failed to award economy reward for lineup confirm", { error: economyError });
    }

    await interaction.editReply({
      embeds: [
        successEmbed(
          `Your **${validation.formation}** lineup is locked in for Gameweek ${team.currentGameweek}. Good luck!${rewardLine}`,
          "Lineup Confirmed",
        ),
      ],
      components: [],
    });
  } catch (error) {
    logger.error("Error confirming lineup", { error, userId: interaction.user.id });

    const message = error instanceof Error ? error.message : "Failed to confirm your lineup.";
    await interaction.editReply({ embeds: [errorEmbed(message)], components: [] });
  }
}

async function handleLineupAutopick(client: GoalXClient, interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  if (!interaction.guildId) return;

  try {
    const team = await fantasyService.getTeam(interaction.user.id, interaction.guildId);

    if (!team) {
      await interaction.editReply({
        embeds: [errorEmbed("You don't have a fantasy team yet.")],
        components: [],
      });
      return;
    }

    if (team.isLocked) {
      await interaction.editReply({
        embeds: [errorEmbed("Your lineup is locked for this gameweek.")],
        components: [],
      });
      return;
    }

    const autoPicked = autoPickStartingXI(team.players);
    const startingIds = autoPicked.filter((p) => p.isStarting).map((p) => p.playerId);

    await fantasyService.setStartingLineup(interaction.user.id, interaction.guildId, startingIds);

    const grouped = groupByPosition(autoPicked);
    const validation = validateFormation(autoPicked);

    const embed = buildLineupEmbed(team.teamName, grouped, validation, true);
    const rows = buildPositionSelectRows(grouped);

    await interaction.editReply({ embeds: [embed], components: rows });
  } catch (error) {
    logger.error("Error auto-picking lineup", { error, userId: interaction.user.id });

    const message = error instanceof Error ? error.message : "Failed to auto-pick your lineup.";
    await interaction.editReply({ embeds: [errorEmbed(message)], components: [] });
  }
}

const fantasyButtons: ButtonComponent[] = [
  { customId: CUSTOM_IDS.FANTASY.MY_TEAM, execute: handleMyTeam },
  { customId: CUSTOM_IDS.FANTASY.AI_SCOUT, execute: handleAiScout },
  { customId: CUSTOM_IDS.FANTASY.TRANSFERS, execute: handleTransfers },
  { customId: CUSTOM_IDS.FANTASY.CAPTAIN, execute: handleCaptain },
  { customId: CUSTOM_IDS.FANTASY.LEADERBOARD, execute: handleLeaderboard },
  { customId: CUSTOM_IDS.FANTASY.BACK, execute: handleBack },
  { customId: CUSTOM_IDS.LINEUP.CONFIRM, execute: handleLineupConfirm },
  { customId: CUSTOM_IDS.LINEUP.AUTOPICK, execute: handleLineupAutopick },
];

export default fantasyButtons;

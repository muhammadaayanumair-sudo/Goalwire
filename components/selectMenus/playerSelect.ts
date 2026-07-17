import { AnySelectMenuInteraction, StringSelectMenuInteraction } from "discord.js";
import type { GoalXClient } from "../../client/GoalXClient";
import type { SelectMenuComponent } from "../../types/discord";
import { fantasyService, FantasyError } from "../../services/fantasy/FantasyService";
import { transferService, TransferError } from "../../services/fantasy/TransferService";
import { playerService } from "../../services/football/PlayerService";
import { errorEmbed, fantasyEmbed, warningEmbed } from "../../utils/embeds";
import { CUSTOM_IDS, EMOJIS } from "../../config/constants";
import { formatCurrency } from "../../utils/formatter";
import { logger } from "../../utils/logger";
import type { FantasyPlayerPool, FantasyPosition } from "../../types/fantasy";

const CURRENT_SEASON = new Date().getFullYear();

/**
 * lineup.ts renders one select menu PER position (select_player_gk,
 * select_player_def, etc.) so no single menu exceeds Discord's 25-option
 * cap. Each selection here only updates that position's starters in
 * memory-equivalent terms — the actual persisted lineup is written via
 * fantasyService.setStartingLineup once the user hits "Confirm Lineup"
 * (handled separately below), not on every single select-menu change.
 * This handler's job is just to acknowledge the pick and show the running
 * state back to the user.
 */
async function handlePlayerPositionSelect(
  client: GoalXClient,
  interaction: AnySelectMenuInteraction,
): Promise<void> {
  const select = interaction as StringSelectMenuInteraction;
  await select.deferUpdate();

  if (!interaction.guildId) return;

  try {
    const team = await fantasyService.getTeam(interaction.user.id, interaction.guildId);
    if (!team) return;

    const position = select.customId.replace(`${CUSTOM_IDS.SELECT.PLAYER}_`, "").toUpperCase() as FantasyPosition;
    const selectedIds = new Set(select.values.map(Number));

    team.players.forEach((player) => {
      if (player.position === position) {
        player.isStarting = selectedIds.has(player.playerId);
      }
    });

    await team.save();

    await select.followUp({
      embeds: [
        fantasyEmbed({
          title: `${EMOJIS.CHECK} ${position} Selection Updated`,
          description: `Updated. Run \`/lineup\` again to review your full XI, or hit **Confirm Lineup** if you're already viewing it.`,
        }),
      ],
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error handling player position select", { error, userId: interaction.user.id });
    await select.followUp({
      embeds: [errorEmbed("Failed to update your selection.")],
      ephemeral: true,
    });
  }
}

/**
 * transfer.ts's replacement-picker menu. customId format:
 * "\${CUSTOM_IDS.MODAL.TRANSFER}_confirm", values: ["<playerOutId>:<candidatePlayerId>"]
 */
async function handleTransferConfirmSelect(
  client: GoalXClient,
  interaction: AnySelectMenuInteraction,
): Promise<void> {
  const select = interaction as StringSelectMenuInteraction;
  await select.deferUpdate();

  if (!interaction.guildId) return;

  const [playerOutIdRaw, candidateIdRaw] = (select.values[0] ?? "").split(":");
  const playerOutId = Number(playerOutIdRaw);
  const candidateId = Number(candidateIdRaw);

  if (!playerOutIdRaw || !candidateIdRaw || Number.isNaN(playerOutId) || Number.isNaN(candidateId)) {
    await select.editReply({
      embeds: [errorEmbed("This selection is malformed. Please run `/transfer` again.")],
      components: [],
    });
    return;
  }

  try {
    const candidateResult = await playerService.getPlayerById(candidateId, CURRENT_SEASON);

    if (!candidateResult) {
      await select.editReply({
        embeds: [errorEmbed("Could not find that player's current data. Please try again.")],
        components: [],
      });
      return;
    }

    const stats = candidateResult.statistics[0];
    const position = mapApiPosition(stats?.games?.position);
    const goals = stats?.goals?.total ?? 0;
    const appearances = stats?.games?.appearences ?? 1;
    const price = Math.round((4.5 + Math.min((goals / Math.max(appearances, 1)) * 10, 8)) * 10) / 10;

    const playerIn: FantasyPlayerPool = {
      playerId: candidateResult.player.id,
      name: candidateResult.player.name,
      position,
      teamId: (stats as { team?: { id: number } })?.team?.id ?? 0,
      teamName: (stats as { team?: { name: string } })?.team?.name ?? "Unknown",
      price,
      totalPoints: 0,
      form: 5,
      injured: candidateResult.player.injured ?? false,
    };

    const result = await transferService.transferPlayer(
      interaction.user.id,
      interaction.guildId,
      playerOutId,
      playerIn,
    );

    const embed =
      result.costPoints > 0
        ? warningEmbed(
            `Transfer complete. **-${result.costPoints} points** deducted for using an extra transfer.\n\nFree transfers remaining: **${result.freeTransfersRemaining}**`,
            "Transfer Complete (Cost Applied)",
          )
        : fantasyEmbed({
            title: `${EMOJIS.CHECK} Transfer Complete`,
            description: `**${playerIn.name}** has joined your squad.\n\nFree transfers remaining: **${result.freeTransfersRemaining}**`,
          });

    await select.editReply({ embeds: [embed], components: [] });
  } catch (error) {
    logger.error("Error handling transfer confirm select", { error, userId: interaction.user.id });

    const message =
      error instanceof TransferError || error instanceof FantasyError || error instanceof Error
        ? error.message
        : "Failed to complete the transfer.";

    await select.editReply({ embeds: [errorEmbed(message)], components: [] });
  }
}

function mapApiPosition(position: string | undefined): FantasyPosition {
  const normalized = (position ?? "").toLowerCase();
  if (normalized.includes("goalkeeper")) return "GK";
  if (normalized.includes("defender")) return "DEF";
  if (normalized.includes("midfielder")) return "MID";
  return "FWD";
}

const playerSelect: SelectMenuComponent[] = [
  { customId: CUSTOM_IDS.SELECT.PLAYER, execute: handlePlayerPositionSelect },
  { customId: `${CUSTOM_IDS.MODAL.TRANSFER}_confirm`, execute: handleTransferConfirmSelect },
];

export default playerSelect;

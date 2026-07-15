import { FantasyTeam, IFantasyTeam, IFantasyPlayer } from "../../database/models/FantasyTeam";
import { config } from "../../config/config";
import { logger } from "../../utils/logger";
import type { FantasyPlayerPool } from "../../types/fantasy";
import { POSITION_LIMITS } from "../../config/constants";

export class TransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferError";
  }
}

interface TransferPair {
  playerOutId: number;
  playerIn: FantasyPlayerPool;
}

interface TransferOptions {
  useWildcard?: boolean;
  useFreeHit?: boolean;
}

interface TransferResult {
  team: IFantasyTeam;
  costPoints: number;
  transfersUsed: number;
  freeTransfersRemaining: number;
}

const MAX_OPTIMISTIC_RETRIES = 3;
const POINTS_PER_EXTRA_TRANSFER = 4;

export class TransferService {
  public async transferPlayer(
    discordId: string,
    guildId: string,
    playerOutId: number,
    playerIn: FantasyPlayerPool,
    options: TransferOptions = {},
  ): Promise<TransferResult> {
    return this.transferPlayers(discordId, guildId, [{ playerOutId, playerIn }], options);
  }

  public async transferPlayers(
    discordId: string,
    guildId: string,
    pairs: TransferPair[],
    options: TransferOptions = {},
  ): Promise<TransferResult> {
    if (pairs.length === 0) {
      throw new TransferError("No transfers were provided.");
    }

    const uniqueOutIds = new Set(pairs.map((p) => p.playerOutId));
    if (uniqueOutIds.size !== pairs.length) {
      throw new TransferError("Duplicate outgoing players in the same transfer request.");
    }

    const uniqueInIds = new Set(pairs.map((p) => p.playerIn.playerId));
    if (uniqueInIds.size !== pairs.length) {
      throw new TransferError("Duplicate incoming players in the same transfer request.");
    }

    for (let attempt = 0; attempt < MAX_OPTIMISTIC_RETRIES; attempt++) {
      const team = await FantasyTeam.findOne({ discordId, guildId });
      if (!team) throw new TransferError("You don't have a fantasy team yet.");

      if (team.isLocked && !options.useWildcard && !options.useFreeHit) {
        throw new TransferError("Transfers are locked for this gameweek.");
      }

      try {
        const { updatedPlayers, remainingBudget } = this.applyTransfers(team, pairs);

        const isChipActive = Boolean(options.useWildcard || options.useFreeHit);
        const transfersUsed = pairs.length;

        let costPoints = 0;
        let freeTransfersRemaining = team.freeTransfers;

        if (!isChipActive) {
          const freeUsed = Math.min(team.freeTransfers, transfersUsed);
          const paidTransfers = transfersUsed - freeUsed;
          costPoints = paidTransfers * POINTS_PER_EXTRA_TRANSFER;
          freeTransfersRemaining = team.freeTransfers - freeUsed;
        }

        team.players = updatedPlayers;
        team.remainingBudget = remainingBudget;
        team.transfersMade += transfersUsed;
        team.freeTransfers = freeTransfersRemaining;
        if (costPoints > 0) team.totalPoints -= costPoints;

        await team.save();

        logger.info("Transfer(s) completed", {
          discordId,
          guildId,
          transfersUsed,
          costPoints,
          wildcard: Boolean(options.useWildcard),
          freeHit: Boolean(options.useFreeHit),
        });

        return {
          team,
          costPoints,
          transfersUsed,
          freeTransfersRemaining,
        };
      } catch (error) {
        const isVersionConflict =
          error instanceof Error && error.name === "VersionError";

        if (isVersionConflict && attempt < MAX_OPTIMISTIC_RETRIES - 1) {
          logger.warn("Transfer version conflict, retrying", { discordId, guildId, attempt });
          continue;
        }

        if (error instanceof TransferError) throw error;

        logger.error("Failed to complete transfer", { error, discordId, guildId });
        throw new TransferError("Something went wrong processing your transfer.");
      }
    }

    throw new TransferError("Could not complete transfer due to a conflicting update. Please try again.");
  }

  private applyTransfers(
    team: IFantasyTeam,
    pairs: TransferPair[],
  ): { updatedPlayers: IFantasyPlayer[]; remainingBudget: number } {
    const players = [...team.players];
    let remainingBudget = team.remainingBudget;

    for (const { playerOutId, playerIn } of pairs) {
      const outIndex = players.findIndex((p) => p.playerId === playerOutId);
      if (outIndex === -1) {
        throw new TransferError(`Player with ID ${playerOutId} is not in your squad.`);
      }

      const playerOut = players[outIndex];

      if (players.some((p) => p.playerId === playerIn.playerId)) {
        throw new TransferError(`${playerIn.name} is already in your squad.`);
      }

      if (playerOut.position !== playerIn.position) {
        throw new TransferError(
          `Position mismatch: ${playerOut.name} is ${playerOut.position}, ${playerIn.name} is ${playerIn.position}.`,
        );
      }

      const budgetAfterSale = remainingBudget + playerOut.price;
      if (playerIn.price > budgetAfterSale) {
        throw new TransferError(
          `Insufficient budget for ${playerIn.name}. Costs £${playerIn.price}m, £${budgetAfterSale.toFixed(1)}m available.`,
        );
      }

      const sameTeamCount = players.filter(
        (p) => p.teamId === playerIn.teamId && p.playerId !== playerOutId,
      ).length;
      if (sameTeamCount >= config.fantasy.maxPlayersPerTeam) {
        throw new TransferError(
          `You can only have ${config.fantasy.maxPlayersPerTeam} players from ${playerIn.teamName}.`,
        );
      }

      players[outIndex] = {
        playerId: playerIn.playerId,
        name: playerIn.name,
        position: playerIn.position,
        teamId: playerIn.teamId,
        teamName: playerIn.teamName,
        price: playerIn.price,
        isCaptain: playerOut.isCaptain,
        isViceCaptain: playerOut.isViceCaptain,
        isStarting: playerOut.isStarting,
      };

      remainingBudget = budgetAfterSale - playerIn.price;
    }

    return { updatedPlayers: players, remainingBudget };
  }

  public async resetWeeklyFreeTransfers(): Promise<void> {
    try {
      const result = await FantasyTeam.updateMany(
        {},
        { $inc: { freeTransfers: config.fantasy.freeTransfersPerWeek } },
      );
      logger.info("Weekly free transfers reset", { matched: result.matchedCount });
    } catch (error) {
      logger.error("Failed to reset weekly free transfers", { error });
      throw error;
    }
  }

  public validatePositionSwap(outPosition: string, inPosition: string): boolean {
    return outPosition === inPosition && Object.keys(POSITION_LIMITS).includes(inPosition);
  }
}

export const transferService = new TransferService();

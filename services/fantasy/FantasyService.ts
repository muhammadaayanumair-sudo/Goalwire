import { FantasyTeam, IFantasyTeam } from "../../database/models/FantasyTeam";
import { User } from "../../database/models/User";
import { config } from "../../config/config";
import { logger } from "../../utils/logger";
import type { FantasyPlayerPool, FantasyPosition } from "../../types/fantasy";
import { POSITION_LIMITS } from "../../config/constants";

export class FantasyService {
  public async createTeam(
    discordId: string,
    guildId: string,
    teamName: string,
  ): Promise<IFantasyTeam> {
    const existing = await FantasyTeam.findOne({ discordId, guildId });
    if (existing) {
      throw new Error("You already have a fantasy team in this server.");
    }

    const user = await User.findOne({ discordId });
    if (!user) {
      throw new Error("User profile not found. Please try again.");
    }

    const team = await FantasyTeam.create({
      userId: user._id,
      discordId,
      guildId,
      teamName,
      budget: config.fantasy.startingBudget,
      remainingBudget: config.fantasy.startingBudget,
      players: [],
      freeTransfers: config.fantasy.freeTransfersPerWeek,
    });

    user.fantasyTeamId = team._id;
    await user.save();

    logger.info("Fantasy team created", { discordId, guildId, teamName });
    return team;
  }

  public async getTeam(discordId: string, guildId: string): Promise<IFantasyTeam | null> {
    return FantasyTeam.findOne({ discordId, guildId });
  }

  public async addPlayer(
    discordId: string,
    guildId: string,
    player: FantasyPlayerPool,
  ): Promise<IFantasyTeam> {
    const team = await FantasyTeam.findOne({ discordId, guildId });
    if (!team) throw new Error("You don't have a fantasy team yet. Use /create first.");

    if (team.isLocked) {
      throw new Error("Your team is locked for this gameweek.");
    }

    if (team.players.length >= config.fantasy.squadSize) {
      throw new Error(`Squad is full (max ${config.fantasy.squadSize} players).`);
    }

    if (team.players.some((p) => p.playerId === player.playerId)) {
      throw new Error(`${player.name} is already in your squad.`);
    }

    if (player.price > team.remainingBudget) {
      throw new Error(
        `Insufficient budget. ${player.name} costs £${player.price}m, you have £${team.remainingBudget.toFixed(1)}m left.`,
      );
    }

    const sameTeamCount = team.players.filter((p) => p.teamId === player.teamId).length;
    if (sameTeamCount >= config.fantasy.maxPlayersPerTeam) {
      throw new Error(
        `You can only have ${config.fantasy.maxPlayersPerTeam} players from ${player.teamName}.`,
      );
    }

    this.validatePositionLimit(team.players.map((p) => p.position), player.position, "add");

    team.players.push({
      playerId: player.playerId,
      name: player.name,
      position: player.position,
      teamId: player.teamId,
      teamName: player.teamName,
      price: player.price,
      isCaptain: false,
      isViceCaptain: false,
      isStarting: team.players.length < config.fantasy.startingXI,
    });

    team.remainingBudget -= player.price;
    await team.save();

    logger.info("Player added to fantasy team", { discordId, guildId, playerId: player.playerId });
    return team;
  }

  public async removePlayer(
    discordId: string,
    guildId: string,
    playerId: number,
  ): Promise<IFantasyTeam> {
    const team = await FantasyTeam.findOne({ discordId, guildId });
    if (!team) throw new Error("You don't have a fantasy team yet.");

    if (team.isLocked) {
      throw new Error("Your team is locked for this gameweek.");
    }

    const playerIndex = team.players.findIndex((p) => p.playerId === playerId);
    if (playerIndex === -1) {
      throw new Error("That player is not in your squad.");
    }

    const [removed] = team.players.splice(playerIndex, 1);
    team.remainingBudget += removed.price;
    await team.save();

    return team;
  }

  public async setCaptain(
    discordId: string,
    guildId: string,
    playerId: number,
  ): Promise<IFantasyTeam> {
    const team = await FantasyTeam.findOne({ discordId, guildId });
    if (!team) throw new Error("You don't have a fantasy team yet.");

    const player = team.players.find((p) => p.playerId === playerId);
    if (!player) throw new Error("That player is not in your squad.");

    team.players.forEach((p) => {
      p.isCaptain = p.playerId === playerId;
    });

    await team.save();
    return team;
  }

  public async setViceCaptain(
    discordId: string,
    guildId: string,
    playerId: number,
  ): Promise<IFantasyTeam> {
    const team = await FantasyTeam.findOne({ discordId, guildId });
    if (!team) throw new Error("You don't have a fantasy team yet.");

    const player = team.players.find((p) => p.playerId === playerId);
    if (!player) throw new Error("That player is not in your squad.");

    team.players.forEach((p) => {
      p.isViceCaptain = p.playerId === playerId;
    });

    await team.save();
    return team;
  }

  private validatePositionLimit(
    currentPositions: FantasyPosition[],
    newPosition: FantasyPosition,
    action: "add",
  ): void {
    if (action !== "add") return;

    const count = currentPositions.filter((pos) => pos === newPosition).length;
    const limit = POSITION_LIMITS[newPosition].max;

    if (count >= limit) {
      throw new Error(`You can only have ${limit} ${newPosition} players in your squad.`);
    }
  }

  public async lockTeam(discordId: string, guildId: string): Promise<void> {
    await FantasyTeam.updateOne({ discordId, guildId }, { isLocked: true });
  }

  public async unlockTeam(discordId: string, guildId: string): Promise<void> {
    await FantasyTeam.updateOne({ discordId, guildId }, { isLocked: false });
  }
}

export const fantasyService = new FantasyService();

import { FantasyTeam } from "../../database/models/FantasyTeam";
import { logger } from "../../utils/logger";
import type { FantasyGameweekResult, FantasyScoringRules } from "../../types/fantasy";

const SCORING_RULES: FantasyScoringRules = {
  goal: { GK: 6, DEF: 6, MID: 5, FWD: 4 },
  assist: 3,
  cleanSheet: { GK: 4, DEF: 4, MID: 1, FWD: 0 },
  yellowCard: -1,
  redCard: -3,
  penaltyMissed: -2,
  penaltySaved: 5,
  ownGoal: -2,
  minutesPlayed60Plus: 2,
  minutesPlayedLess60: 1,
  saves: 1,
};

interface MatchPlayerStats {
  playerId: number;
  position: "GK" | "DEF" | "MID" | "FWD";
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  penaltiesMissed: number;
  penaltiesSaved: number;
  saves: number;
  cleanSheet: boolean;
}

export class PointsService {
  public calculatePlayerPoints(stats: MatchPlayerStats): FantasyGameweekResult["breakdown"] & {
    total: number;
  } {
    const goalsPoints = stats.goals * SCORING_RULES.goal[stats.position];
    const assistsPoints = stats.assists * SCORING_RULES.assist;
    const cleanSheetPoints = stats.cleanSheet ? SCORING_RULES.cleanSheet[stats.position] : 0;

    let cardsPoints = 0;
    cardsPoints += stats.yellowCards * SCORING_RULES.yellowCard;
    cardsPoints += stats.redCards * SCORING_RULES.redCard;
    cardsPoints += stats.ownGoals * SCORING_RULES.ownGoal;
    cardsPoints += stats.penaltiesMissed * SCORING_RULES.penaltyMissed;

    let minutesPoints = 0;
    if (stats.minutesPlayed >= 60) {
      minutesPoints = SCORING_RULES.minutesPlayed60Plus;
    } else if (stats.minutesPlayed > 0) {
      minutesPoints = SCORING_RULES.minutesPlayedLess60;
    }

    const savesPoints =
      Math.floor(stats.saves / 3) + stats.penaltiesSaved * SCORING_RULES.penaltySaved;

    const bonusPoints = 0;

    const total =
      goalsPoints +
      assistsPoints +
      (stats.cleanSheet ? cleanSheetPoints : 0) +
      cardsPoints +
      minutesPoints +
      savesPoints +
      bonusPoints;

    return {
      goals: goalsPoints,
      assists: assistsPoints,
      cleanSheet: stats.cleanSheet,
      cardsPoints,
      minutesPoints,
      savesPoints,
      bonusPoints,
      total,
    };
  }

  public async applyGameweekPoints(
    gameweek: number,
    playerStatsMap: Map<number, MatchPlayerStats>,
  ): Promise<void> {
    try {
      const teams = await FantasyTeam.find({ isLocked: true });

      for (const team of teams) {
        let gameweekPoints = 0;

        for (const player of team.players) {
          const stats = playerStatsMap.get(player.playerId);
          if (!stats) continue;

          const result = this.calculatePlayerPoints(stats);
          let playerPoints = result.total;

          if (player.isCaptain) {
            playerPoints *= 2;
          }

          if (player.isStarting) {
            gameweekPoints += playerPoints;
          }
        }

        team.gameweekPoints = gameweekPoints;
        team.totalPoints += gameweekPoints;
        team.history.push({ gameweek, points: gameweekPoints });

        await team.save();
      }

      logger.info(`Applied gameweek ${gameweek} points to ${teams.length} teams`);
    } catch (error) {
      logger.error("Failed to apply gameweek points", { error, gameweek });
      throw error;
    }
  }
}

export const pointsService = new PointsService();

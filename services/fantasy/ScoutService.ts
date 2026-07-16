import { logger } from "../../utils/logger";
import type { FantasyPlayerPool, FantasyScoutRecommendation } from "../../types/fantasy";

export class ScoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoutError";
  }
}

interface ScoutCriteria {
  budget?: number;
  position?: FantasyPlayerPool["position"];
  excludePlayerIds?: number[];
}

interface AIRecommendationProvider {
  generateReasoning(player: FantasyPlayerPool, context: string): Promise<string>;
}

const FORM_WEIGHT = 0.45;
const POINTS_PER_PRICE_WEIGHT = 0.55;

export class ScoutService {
  constructor(private readonly aiProvider?: AIRecommendationProvider) {}

  public rankPlayerPool(
    pool: FantasyPlayerPool[],
    criteria: ScoutCriteria = {},
  ): FantasyPlayerPool[] {
    const excluded = new Set(criteria.excludePlayerIds ?? []);

    let candidates = pool.filter((player) => {
      if (excluded.has(player.playerId)) return false;
      if (player.injured) return false;
      if (criteria.position && player.position !== criteria.position) return false;
      if (criteria.budget !== undefined && player.price > criteria.budget) return false;
      return true;
    });

    if (candidates.length === 0) {
      throw new ScoutError("No eligible players match those criteria.");
    }

    candidates = candidates.sort((a, b) => this.computeScore(b) - this.computeScore(a));

    return candidates;
  }

  private computeScore(player: FantasyPlayerPool): number {
    const pointsPerPrice = player.price > 0 ? player.totalPoints / player.price : 0;

    return player.form * FORM_WEIGHT + pointsPerPrice * POINTS_PER_PRICE_WEIGHT;
  }

  public async getRecommendations(
    pool: FantasyPlayerPool[],
    criteria: ScoutCriteria = {},
    limit = 5,
  ): Promise<FantasyScoutRecommendation[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 25);
    const ranked = this.rankPlayerPool(pool, criteria).slice(0, safeLimit);

    const recommendations: FantasyScoutRecommendation[] = [];

    for (const player of ranked) {
      const confidenceScore = Math.min(100, Math.round(this.computeScore(player) * 10));
      const projectedPoints = this.projectNextGameweekPoints(player);

      let reason = this.buildHeuristicReason(player);

      if (this.aiProvider) {
        try {
          reason = await this.aiProvider.generateReasoning(
            player,
            `Form: ${player.form}, Price: £${player.price}m, Total points: ${player.totalPoints}`,
          );
        } catch (error) {
          logger.warn("AI reasoning generation failed, falling back to heuristic", {
            error,
            playerId: player.playerId,
          });
        }
      }

      recommendations.push({
        player,
        reason,
        confidenceScore,
        projectedPoints,
      });
    }

    return recommendations;
  }

  private buildHeuristicReason(player: FantasyPlayerPool): string {
    const parts: string[] = [];

    if (player.form >= 7) parts.push("excellent recent form");
    else if (player.form >= 4) parts.push("solid recent form");

    if (player.totalPoints / Math.max(player.price, 1) > 8) parts.push("strong value for price");

    if (parts.length === 0) parts.push("balanced overall profile");

    return `${player.name} is a recommendation due to ${parts.join(" and ")}.`;
  }

  private projectNextGameweekPoints(player: FantasyPlayerPool): number {
    const formFactor = player.form / 10;
    const basePoints = player.totalPoints > 0 ? player.totalPoints / 10 : 2;
    return Math.round((basePoints * (0.6 + formFactor)) * 10) / 10;
  }
}

export const scoutService = new ScoutService();

import { FantasyTeam, IFantasyTeam } from "../../database/models/FantasyTeam";
import { FantasyLeague, IFantasyLeague } from "../../database/models/FantasyLeague";
import { logger } from "../../utils/logger";
import type { FantasyLeaderboardEntry } from "../../types/fantasy";

export class RankingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RankingError";
  }
}

interface GlobalLeaderboardOptions {
  guildId?: string;
  page?: number;
  pageSize?: number;
}

interface LeaderboardPage {
  entries: FantasyLeaderboardEntry[];
  totalEntries: number;
  totalPages: number;
  currentPage: number;
}

export class RankingService {
  public async getGlobalLeaderboard(
    options: GlobalLeaderboardOptions = {},
  ): Promise<LeaderboardPage> {
    const page = Math.max(0, options.page ?? 0);
    const pageSize = Math.min(Math.max(options.pageSize ?? 10, 1), 25);

    try {
      const filter = options.guildId ? { guildId: options.guildId } : {};

      const totalEntries = await FantasyTeam.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
      const safePage = Math.min(page, totalPages - 1);

      const teams = await FantasyTeam.find(filter)
        .sort({ totalPoints: -1 })
        .skip(safePage * pageSize)
        .limit(pageSize)
        .lean();

      const entries: FantasyLeaderboardEntry[] = teams.map((team, index) => ({
        discordId: team.discordId,
        teamName: team.teamName,
        totalPoints: team.totalPoints,
        gameweekPoints: team.gameweekPoints,
        rank: safePage * pageSize + index + 1,
      }));

      return { entries, totalEntries, totalPages, currentPage: safePage };
    } catch (error) {
      logger.error("Failed to fetch global leaderboard", { error, options });
      throw new RankingError("Could not load the leaderboard right now.");
    }
  }

  public async getUserRank(
    discordId: string,
    guildId: string,
  ): Promise<{ rank: number; totalTeams: number; totalPoints: number } | null> {
    try {
      const team = await FantasyTeam.findOne({ discordId, guildId }).lean();
      if (!team) return null;

      const [rankPosition, totalTeams] = await Promise.all([
        FantasyTeam.countDocuments({
          guildId,
          totalPoints: { $gt: team.totalPoints },
        }),
        FantasyTeam.countDocuments({ guildId }),
      ]);

      return {
        rank: rankPosition + 1,
        totalTeams,
        totalPoints: team.totalPoints,
      };
    } catch (error) {
      logger.error("Failed to compute user rank", { error, discordId, guildId });
      throw new RankingError("Could not calculate your rank right now.");
    }
  }

  /**
   * Recalculates and persists standings for a league. Returns void rather than
   * the league document — the populated `members` field (IFantasyTeam[] at
   * runtime) is structurally incompatible with IFantasyLeague's schema type
   * for members (ObjectId[]), so returning it typed as IFantasyLeague is a
   * real type lie, not just a strictness nitpick. Callers that need the
   * standings after recalculating should call getLeagueStandings() next.
   */
  public async recalculateLeagueStandings(leagueId: string): Promise<void> {
    const league = await FantasyLeague.findById(leagueId).populate<{
      members: IFantasyTeam[];
    }>("members");

    if (!league) {
      throw new RankingError("Fantasy league not found.");
    }

    const sortedMembers = [...league.members].sort((a, b) => b.totalPoints - a.totalPoints);

    league.standings = sortedMembers.map((team, index) => ({
      fantasyTeamId: team._id,
      discordId: team.discordId,
      totalPoints: team.totalPoints,
      rank: index + 1,
    }));

    try {
      await league.save();
    } catch (error) {
      logger.error("Failed to save recalculated league standings", { error, leagueId });
      throw new RankingError("Could not update league standings.");
    }
  }

  public async getLeagueStandings(leagueId: string): Promise<IFantasyLeague["standings"]> {
    const league = await FantasyLeague.findById(leagueId).lean();
    if (!league) {
      throw new RankingError("Fantasy league not found.");
    }
    return league.standings;
  }

  public async getRankMovement(
    previousStandings: IFantasyLeague["standings"],
    currentStandings: IFantasyLeague["standings"],
  ): Promise<Map<string, number>> {
    const movement = new Map<string, number>();
    const previousMap = new Map(previousStandings.map((entry) => [entry.discordId, entry.rank]));

    for (const entry of currentStandings) {
      const previousRank = previousMap.get(entry.discordId);
      movement.set(entry.discordId, previousRank !== undefined ? previousRank - entry.rank : 0);
    }

    return movement;
  }
}

export const rankingService = new RankingService();

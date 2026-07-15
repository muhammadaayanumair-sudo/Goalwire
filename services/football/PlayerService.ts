import axios, { AxiosInstance, AxiosError } from "axios";
import { config } from "../../config/config";
import { logger } from "../../utils/logger";
import type { FootballPlayer, FootballPlayerStatistics, FootballTransfer } from "../../types/football";

export class PlayerServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "PlayerServiceError";
  }
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface PlayerSearchResult {
  player: FootballPlayer;
  statistics: FootballPlayerStatistics[];
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;
const PLAYER_CACHE_TTL_SECONDS = 3600;

export class PlayerService {
  private client: AxiosInstance;
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  constructor() {
    this.client = axios.create({
      baseURL: config.apis.apiFootball.baseUrl,
      timeout: 8000,
      headers: {
        "x-apisports-key": config.apis.apiFootball.key,
      },
    });
  }

  public async searchPlayers(name: string, season: number): Promise<PlayerSearchResult[]> {
    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      throw new PlayerServiceError("Search term must be at least 3 characters.");
    }

    const cacheKey = `search:${trimmedName.toLowerCase()}:${season}`;
    const cached = this.getFromCache<PlayerSearchResult[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.requestWithRetry<{ response: PlayerSearchResult[] }>(
        "/players",
        { search: trimmedName, season },
      );

      const results = response.response ?? [];
      this.setCache(cacheKey, results, PLAYER_CACHE_TTL_SECONDS);
      return results;
    } catch (error) {
      this.handleError(error, `Failed to search players matching "${trimmedName}"`);
    }
  }

  public async getPlayerById(
    playerId: number,
    season: number,
  ): Promise<PlayerSearchResult | null> {
    const cacheKey = `player:${playerId}:${season}`;
    const cached = this.getFromCache<PlayerSearchResult>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.requestWithRetry<{ response: PlayerSearchResult[] }>(
        "/players",
        { id: playerId, season },
      );

      const result = response.response?.[0] ?? null;
      if (result) {
        this.setCache(cacheKey, result, PLAYER_CACHE_TTL_SECONDS);
      }
      return result;
    } catch (error) {
      this.handleError(error, `Failed to fetch player ${playerId}`);
    }
  }

  public async getPlayersByTeam(
    teamId: number,
    season: number,
  ): Promise<PlayerSearchResult[]> {
    const cacheKey = `team-players:${teamId}:${season}`;
    const cached = this.getFromCache<PlayerSearchResult[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.requestWithRetry<{ response: PlayerSearchResult[] }>(
        "/players",
        { team: teamId, season },
      );

      const results = response.response ?? [];
      this.setCache(cacheKey, results, PLAYER_CACHE_TTL_SECONDS);
      return results;
    } catch (error) {
      this.handleError(error, `Failed to fetch players for team ${teamId}`);
    }
  }

  public async getTopScorers(leagueId: number, season: number): Promise<PlayerSearchResult[]> {
    const cacheKey = `topscorers:${leagueId}:${season}`;
    const cached = this.getFromCache<PlayerSearchResult[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.requestWithRetry<{ response: PlayerSearchResult[] }>(
        "/players/topscorers",
        { league: leagueId, season },
      );

      const results = response.response ?? [];
      this.setCache(cacheKey, results, config.cache.standingsTtlSeconds);
      return results;
    } catch (error) {
      this.handleError(error, `Failed to fetch top scorers for league ${leagueId}`);
    }
  }

  public async getRecentTransfers(playerId: number): Promise<FootballTransfer[]> {
    try {
      const response = await this.requestWithRetry<{
        response: { transfers: FootballTransfer[] }[];
      }>("/transfers", { player: playerId });

      return response.response?.[0]?.transfers ?? [];
    } catch (error) {
      this.handleError(error, `Failed to fetch transfers for player ${playerId}`);
    }
  }

  public comparePlayers(
    playerOne: PlayerSearchResult,
    playerTwo: PlayerSearchResult,
  ): {
    playerOne: PlayerSearchResult;
    playerTwo: PlayerSearchResult;
    comparison: Record<string, { playerOne: number; playerTwo: number; better: "playerOne" | "playerTwo" | "tie" }>;
  } {
    const statsOne = playerOne.statistics[0];
    const statsTwo = playerTwo.statistics[0];

    const buildMetric = (
      valueOne: number | null | undefined,
      valueTwo: number | null | undefined,
      higherIsBetter = true,
    ) => {
      const a = valueOne ?? 0;
      const b = valueTwo ?? 0;
      let better: "playerOne" | "playerTwo" | "tie" = "tie";

      if (a !== b) {
        const oneWins = higherIsBetter ? a > b : a < b;
        better = oneWins ? "playerOne" : "playerTwo";
      }

      return { playerOne: a, playerTwo: b, better };
    };

    return {
      playerOne,
      playerTwo,
      comparison: {
        goals: buildMetric(statsOne?.goals?.total, statsTwo?.goals?.total),
        assists: buildMetric(statsOne?.goals?.assists, statsTwo?.goals?.assists),
        appearances: buildMetric(statsOne?.games?.appearences, statsTwo?.games?.appearences),
        minutes: buildMetric(statsOne?.games?.minutes, statsTwo?.games?.minutes),
        yellowCards: buildMetric(statsOne?.cards?.yellow, statsTwo?.cards?.yellow, false),
        redCards: buildMetric(statsOne?.cards?.red, statsTwo?.cards?.red, false),
      },
    };
  }

  private async requestWithRetry<T>(
    path: string,
    params: Record<string, string | number>,
    attempt = 0,
  ): Promise<T> {
    try {
      const response = await this.client.get<T>(path, { params });
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const isRetryable = !status || status >= 500 || status === 429;

      if (isRetryable && attempt < MAX_RETRIES) {
        await this.delay(RETRY_DELAY_MS * (attempt + 1));
        return this.requestWithRetry<T>(path, params, attempt + 1);
      }

      throw error;
    }
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private handleError(error: unknown, message: string): never {
    const axiosError = error as AxiosError;
    const statusCode = axiosError.response?.status;

    logger.error(message, { error: axiosError.message, statusCode });
    throw new PlayerServiceError(message, statusCode);
  }
}

export const playerService = new PlayerService();

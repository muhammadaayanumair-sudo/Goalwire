import axios, { AxiosInstance, AxiosError } from "axios";
import { config } from "../../config/config";
import { logger } from "../../utils/logger";
import type { FootballTeam, FootballVenue, FootballFixture } from "../../types/football";

export class TeamServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "TeamServiceError";
  }
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface TeamSearchResult {
  team: FootballTeam;
  venue: FootballVenue;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;
const TEAM_CACHE_TTL_SECONDS = 3600;

export class TeamService {
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

  public async searchTeams(name: string): Promise<TeamSearchResult[]> {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      throw new TeamServiceError("Search term must be at least 2 characters.");
    }

    const cacheKey = `team-search:${trimmedName.toLowerCase()}`;
    const cached = this.getFromCache<TeamSearchResult[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.requestWithRetry<{ response: TeamSearchResult[] }>("/teams", {
        search: trimmedName,
      });

      const results = response.response ?? [];
      this.setCache(cacheKey, results, TEAM_CACHE_TTL_SECONDS);
      return results;
    } catch (error) {
      this.handleError(error, `Failed to search teams matching "${trimmedName}"`);
    }
  }

  public async getTeamById(teamId: number): Promise<TeamSearchResult | null> {
    const cacheKey = `team:${teamId}`;
    const cached = this.getFromCache<TeamSearchResult>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.requestWithRetry<{ response: TeamSearchResult[] }>("/teams", {
        id: teamId,
      });

      const result = response.response?.[0] ?? null;
      if (result) {
        this.setCache(cacheKey, result, TEAM_CACHE_TTL_SECONDS);
      }
      return result;
    } catch (error) {
      this.handleError(error, `Failed to fetch team ${teamId}`);
    }
  }

  public async getTeamsByLeague(
    leagueId: number,
    season: number,
  ): Promise<TeamSearchResult[]> {
    const cacheKey = `league-teams:${leagueId}:${season}`;
    const cached = this.getFromCache<TeamSearchResult[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.requestWithRetry<{ response: TeamSearchResult[] }>("/teams", {
        league: leagueId,
        season,
      });

      const results = response.response ?? [];
      this.setCache(cacheKey, results, TEAM_CACHE_TTL_SECONDS);
      return results;
    } catch (error) {
      this.handleError(error, `Failed to fetch teams for league ${leagueId}`);
    }
  }

  public async getTeamStatistics(
    teamId: number,
    leagueId: number,
    season: number,
  ): Promise<unknown> {
    const cacheKey = `team-stats:${teamId}:${leagueId}:${season}`;
    const cached = this.getFromCache<unknown>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.requestWithRetry<{ response: unknown }>(
        "/teams/statistics",
        { team: teamId, league: leagueId, season },
      );

      this.setCache(cacheKey, response.response, config.cache.standingsTtlSeconds);
      return response.response;
    } catch (error) {
      this.handleError(error, `Failed to fetch statistics for team ${teamId}`);
    }
  }

  public async getTeamFixtures(
    teamId: number,
    season: number,
  ): Promise<FootballFixture[]> {
    const cacheKey = `team-fixtures:${teamId}:${season}`;
    const cached = this.getFromCache<FootballFixture[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.requestWithRetry<{ response: FootballFixture[] }>(
        "/fixtures",
        { team: teamId, season },
      );

      const fixtures = response.response ?? [];
      this.setCache(cacheKey, fixtures, config.cache.fixturesTtlSeconds);
      return fixtures;
    } catch (error) {
      this.handleError(error, `Failed to fetch fixtures for team ${teamId}`);
    }
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
    throw new TeamServiceError(message, statusCode);
  }
}

export const teamService = new TeamService();

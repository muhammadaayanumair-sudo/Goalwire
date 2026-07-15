import axios, { AxiosInstance, AxiosError } from "axios";
import { config } from "../../config/config";
import { logger } from "../../utils/logger";
import type { FootballFixture, FootballStanding } from "../../types/football";

export class MatchServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "MatchServiceError";
  }
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

export class MatchService {
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

  public async getFixturesByDate(date: string, leagueId?: number): Promise<FootballFixture[]> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new MatchServiceError("Date must be in YYYY-MM-DD format.");
    }

    const cacheKey = `fixtures:${date}:${leagueId ?? "all"}`;
    const cached = this.getFromCache<FootballFixture[]>(cacheKey);
    if (cached) return cached;

    try {
      const params: Record<string, string | number> = { date };
      if (leagueId) params.league = leagueId;

      const response = await this.requestWithRetry<{ response: FootballFixture[] }>(
        "/fixtures",
        params,
      );

      const fixtures = response.response ?? [];
      this.setCache(cacheKey, fixtures, config.cache.fixturesTtlSeconds);
      return fixtures;
    } catch (error) {
      this.handleError(error, `Failed to fetch fixtures for ${date}`);
    }
  }

  public async getUpcomingFixtures(
    teamId: number,
    count = 5,
  ): Promise<FootballFixture[]> {
    const safeCount = Math.min(Math.max(count, 1), 20);
    const cacheKey = `upcoming:${teamId}:${safeCount}`;
    const cached = this.getFromCache<FootballFixture[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.requestWithRetry<{ response: FootballFixture[] }>(
        "/fixtures",
        { team: teamId, next: safeCount },
      );

      const fixtures = response.response ?? [];
      this.setCache(cacheKey, fixtures, config.cache.fixturesTtlSeconds);
      return fixtures;
    } catch (error) {
      this.handleError(error, `Failed to fetch upcoming fixtures for team ${teamId}`);
    }
  }

  public async getRecentResults(teamId: number, count = 5): Promise<FootballFixture[]> {
    const safeCount = Math.min(Math.max(count, 1), 20);
    const cacheKey = `recent:${teamId}:${safeCount}`;
    const cached = this.getFromCache<FootballFixture[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.requestWithRetry<{ response: FootballFixture[] }>(
        "/fixtures",
        { team: teamId, last: safeCount },
      );

      const fixtures = response.response ?? [];
      this.setCache(cacheKey, fixtures, config.cache.fixturesTtlSeconds);
      return fixtures;
    } catch (error) {
      this.handleError(error, `Failed to fetch recent results for team ${teamId}`);
    }
  }

  public async getHeadToHead(teamOneId: number, teamTwoId: number): Promise<FootballFixture[]> {
    const cacheKey = `h2h:${Math.min(teamOneId, teamTwoId)}-${Math.max(teamOneId, teamTwoId)}`;
    const cached = this.getFromCache<FootballFixture[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.requestWithRetry<{ response: FootballFixture[] }>(
        "/fixtures/headtohead",
        { h2h: `${teamOneId}-${teamTwoId}` },
      );

      const fixtures = response.response ?? [];
      this.setCache(cacheKey, fixtures, config.cache.fixturesTtlSeconds);
      return fixtures;
    } catch (error) {
      this.handleError(error, `Failed to fetch head-to-head for ${teamOneId} vs ${teamTwoId}`);
    }
  }

  public async getStandings(leagueId: number, season: number): Promise<FootballStanding[]> {
    const cacheKey = `standings:${leagueId}:${season}`;
    const cached = this.getFromCache<FootballStanding[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.requestWithRetry<{
        response: { league: { standings: FootballStanding[][] } }[];
      }>("/standings", { league: leagueId, season });

      const standings = response.response?.[0]?.league?.standings?.[0] ?? [];
      this.setCache(cacheKey, standings, config.cache.standingsTtlSeconds);
      return standings;
    } catch (error) {
      this.handleError(error, `Failed to fetch standings for league ${leagueId}`);
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
    throw new MatchServiceError(message, statusCode);
  }
}

export const matchService = new MatchService();

import axios, { AxiosInstance, AxiosError } from "axios";
import { config } from "../../config/config";
import { logger } from "../../utils/logger";
import type { FootballFixture, FootballEvent, FootballLineup } from "../../types/football";

export class LiveServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "LiveServiceError";
  }
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

export class LiveService {
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

  public async getLiveFixtures(leagueId?: number): Promise<FootballFixture[]> {
    const cacheKey = `live:${leagueId ?? "all"}`;
    const cached = this.getFromCache<FootballFixture[]>(cacheKey);
    if (cached) return cached;

    try {
      const params: Record<string, string | number> = { live: "all" };
      if (leagueId) params.league = leagueId;

      const response = await this.requestWithRetry<{ response: FootballFixture[] }>(
        "/fixtures",
        params,
      );

      const fixtures = response.response ?? [];
      this.setCache(cacheKey, fixtures, config.cache.liveMatchTtlSeconds);
      return fixtures;
    } catch (error) {
      this.handleError(error, "Failed to fetch live fixtures");
    }
  }

  public async getFixtureById(fixtureId: number): Promise<FootballFixture | null> {
    const cacheKey = `fixture:${fixtureId}`;
    const cached = this.getFromCache<FootballFixture>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.requestWithRetry<{ response: FootballFixture[] }>(
        "/fixtures",
        { id: fixtureId },
      );

      const fixture = response.response?.[0] ?? null;
      if (fixture) {
        this.setCache(cacheKey, fixture, config.cache.liveMatchTtlSeconds);
      }
      return fixture;
    } catch (error) {
      this.handleError(error, `Failed to fetch fixture ${fixtureId}`);
    }
  }

  public async getFixtureEvents(fixtureId: number): Promise<FootballEvent[]> {
    try {
      const response = await this.requestWithRetry<{ response: FootballEvent[] }>(
        "/fixtures/events",
        { fixture: fixtureId },
      );
      return response.response ?? [];
    } catch (error) {
      this.handleError(error, `Failed to fetch events for fixture ${fixtureId}`);
    }
  }

  public async getFixtureLineups(fixtureId: number): Promise<FootballLineup[]> {
    const cacheKey = `lineups:${fixtureId}`;
    const cached = this.getFromCache<FootballLineup[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.requestWithRetry<{ response: FootballLineup[] }>(
        "/fixtures/lineups",
        { fixture: fixtureId },
      );

      const lineups = response.response ?? [];
      this.setCache(cacheKey, lineups, config.cache.fixturesTtlSeconds);
      return lineups;
    } catch (error) {
      this.handleError(error, `Failed to fetch lineups for fixture ${fixtureId}`);
    }
  }

  public async getFixtureStatistics(fixtureId: number): Promise<unknown[]> {
    try {
      const response = await this.requestWithRetry<{ response: unknown[] }>(
        "/fixtures/statistics",
        { fixture: fixtureId },
      );
      return response.response ?? [];
    } catch (error) {
      this.handleError(error, `Failed to fetch statistics for fixture ${fixtureId}`);
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
    throw new LiveServiceError(message, statusCode);
  }
}

export const liveService = new LiveService();

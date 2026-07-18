import axios, { AxiosInstance, AxiosError } from "axios";
import { config } from "../../config/config";
import { logger } from "../../utils/logger";

export class OddsServiceError extends Error {
  constructor(
    message: string,
    public readonly provider?: string,
  ) {
    super(message);
    this.name = "OddsServiceError";
  }
}

export interface OddsOutcome {
  name: string;
  price: number;
}

export interface OddsMarket {
  key: string;
  outcomes: OddsOutcome[];
}

export interface BookmakerOdds {
  key: string;
  title: string;
  lastUpdate: string;
  markets: OddsMarket[];
}

export interface FixtureOdds {
  id: string;
  sportKey: string;
  sportTitle: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  bookmakers: BookmakerOdds[];
}

const LEAGUE_TO_SPORT_KEY: Record<number, string> = {
  39: "soccer_epl", // Premier League — confirmed against The Odds API docs
  140: "soccer_spain_la_liga", // pattern-matched, not independently confirmed
  78: "soccer_germany_bundesliga", // pattern-matched, not independently confirmed
  135: "soccer_italy_serie_a", // pattern-matched, not independently confirmed
  61: "soccer_france_ligue_one", // pattern-matched, not independently confirmed
  2: "soccer_uefa_champs_league", // pattern-matched, not independently confirmed
};

const DEFAULT_REGION = "uk";
const REQUEST_TIMEOUT_MS = 8000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class OddsService {
  private client: AxiosInstance | null = null;
  private cache: Map<string, CacheEntry<FixtureOdds[]>> = new Map();

  constructor() {
    if (config.apis.oddsApi.key) {
      this.client = axios.create({
        baseURL: config.apis.oddsApi.baseUrl,
        timeout: REQUEST_TIMEOUT_MS,
      });
    }
  }

  public isConfigured(): boolean {
    return this.client !== null;
  }

  public async getOddsForLeague(leagueId: number, region = DEFAULT_REGION): Promise<FixtureOdds[]> {
    if (!this.client) {
      throw new OddsServiceError(
        "Betting odds aren't configured for this bot yet. An admin needs to add an odds API key.",
        "the-odds-api",
      );
    }

    const sportKey = LEAGUE_TO_SPORT_KEY[leagueId];
    if (!sportKey) {
      throw new OddsServiceError(
        "Odds aren't available for this league yet — only major European leagues and the Champions League are currently supported.",
        "the-odds-api",
      );
    }

    const cacheKey = `${sportKey}:${region}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get<
        {
          id: string;
          sport_key: string;
          sport_title: string;
          commence_time: string;
          home_team: string;
          away_team: string;
          bookmakers: {
            key: string;
            title: string;
            last_update: string;
            markets: { key: string; outcomes: { name: string; price: number }[] }[];
          }[];
        }[]
      >(`/sports/${sportKey}/odds`, {
        params: {
          apiKey: config.apis.oddsApi.key,
          regions: region,
          markets: "h2h",
        },
      });

      const fixtures: FixtureOdds[] = response.data.map((fixture) => ({
        id: fixture.id,
        sportKey: fixture.sport_key,
        sportTitle: fixture.sport_title,
        commenceTime: fixture.commence_time,
        homeTeam: fixture.home_team,
        awayTeam: fixture.away_team,
        bookmakers: fixture.bookmakers.map((bm) => ({
          key: bm.key,
          title: bm.title,
          lastUpdate: bm.last_update,
          markets: bm.markets.map((m) => ({
            key: m.key,
            outcomes: m.outcomes.map((o) => ({ name: o.name, price: o.price })),
          })),
        })),
      }));

      this.setCache(cacheKey, fixtures);
      return fixtures;
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error("The Odds API request failed", {
        error: axiosError.message,
        status: axiosError.response?.status,
        sportKey,
      });
      throw new OddsServiceError("Failed to fetch odds right now. Please try again shortly.", "the-odds-api");
    }
  }

  public findBestOdds(fixture: FixtureOdds): Record<string, { price: number; bookmaker: string }> {
    const best: Record<string, { price: number; bookmaker: string }> = {};

    for (const bookmaker of fixture.bookmakers) {
      const h2hMarket = bookmaker.markets.find((m) => m.key === "h2h");
      if (!h2hMarket) continue;

      for (const outcome of h2hMarket.outcomes) {
        if (!best[outcome.name] || outcome.price > best[outcome.name].price) {
          best[outcome.name] = { price: outcome.price, bookmaker: bookmaker.title };
        }
      }
    }

    return best;
  }

  private getFromCache(key: string): FixtureOdds[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: FixtureOdds[]): void {
    this.cache.set(key, { data, expiresAt: Date.now() + config.cache.oddsTtlSeconds * 1000 });
  }
}

export const oddsService = new OddsService();

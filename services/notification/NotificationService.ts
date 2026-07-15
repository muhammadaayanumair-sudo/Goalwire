import axios, { AxiosInstance, AxiosError } from "axios";
import { config } from "../../config/config";
import { logger } from "../../utils/logger";

export class NewsServiceError extends Error {
  constructor(
    message: string,
    public readonly provider?: string,
  ) {
    super(message);
    this.name = "NewsServiceError";
  }
}

export interface NewsArticle {
  title: string;
  description: string | null;
  url: string;
  source: string;
  imageUrl: string | null;
  publishedAt: string;
}

type NewsProvider = "gnews" | "newsapi" | "newsdata";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const PROVIDER_FALLBACK_ORDER: NewsProvider[] = ["gnews", "newsapi", "newsdata"];
const DEFAULT_TIMEOUT_MS = 8000;

export class NewsService {
  private clients: Partial<Record<NewsProvider, AxiosInstance>> = {};
  private cache: Map<string, CacheEntry<NewsArticle[]>> = new Map();

  constructor() {
    if (config.apis.gnews.key) {
      this.clients.gnews = axios.create({
        baseURL: config.apis.gnews.baseUrl,
        timeout: DEFAULT_TIMEOUT_MS,
      });
    }

    if (config.apis.newsapi.key) {
      this.clients.newsapi = axios.create({
        baseURL: config.apis.newsapi.baseUrl,
        timeout: DEFAULT_TIMEOUT_MS,
        headers: { "X-Api-Key": config.apis.newsapi.key },
      });
    }

    if (config.apis.newsdata.key) {
      this.clients.newsdata = axios.create({
        baseURL: config.apis.newsdata.baseUrl,
        timeout: DEFAULT_TIMEOUT_MS,
      });
    }
  }

  public async getFootballNews(query = "football", limit = 10): Promise<NewsArticle[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 25);
    const cacheKey = `news:${query.toLowerCase()}:${safeLimit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const availableProviders = PROVIDER_FALLBACK_ORDER.filter((provider) => this.clients[provider]);
    if (availableProviders.length === 0) {
      throw new NewsServiceError("No news providers are configured.");
    }

    let lastError: unknown;

    for (const provider of availableProviders) {
      try {
        const articles = await this.fetchFromProvider(provider, query, safeLimit);
        this.setCache(cacheKey, articles);
        return articles;
      } catch (error) {
        lastError = error;
        logger.warn(`News provider ${provider} failed, trying next fallback`, {
          error: (error as Error).message,
        });
      }
    }

    logger.error("All news providers failed", { error: lastError, query });
    throw new NewsServiceError("All configured news providers failed to respond.");
  }

  public async getBreakingNews(limit = 5): Promise<NewsArticle[]> {
    return this.getFootballNews("breaking transfer football", limit);
  }

  public async getTransferNews(limit = 10): Promise<NewsArticle[]> {
    return this.getFootballNews("football transfer news", limit);
  }

  private async fetchFromProvider(
    provider: NewsProvider,
    query: string,
    limit: number,
  ): Promise<NewsArticle[]> {
    switch (provider) {
      case "gnews":
        return this.fetchGNews(query, limit);
      case "newsapi":
        return this.fetchNewsApi(query, limit);
      case "newsdata":
        return this.fetchNewsData(query, limit);
      default:
        throw new NewsServiceError(`Unknown provider: ${provider}`);
    }
  }

  private async fetchGNews(query: string, limit: number): Promise<NewsArticle[]> {
    try {
      const response = await this.clients.gnews!.get("/search", {
        params: {
          q: query,
          lang: "en",
          max: limit,
          apikey: config.apis.gnews.key,
        },
      });

      const articles = response.data?.articles ?? [];
      return articles.map((article: Record<string, unknown>) => ({
        title: String(article.title ?? ""),
        description: (article.description as string) ?? null,
        url: String(article.url ?? ""),
        source: String((article.source as { name?: string })?.name ?? "GNews"),
        imageUrl: (article.image as string) ?? null,
        publishedAt: String(article.publishedAt ?? new Date().toISOString()),
      }));
    } catch (error) {
      throw this.wrapError(error, "gnews");
    }
  }

  private async fetchNewsApi(query: string, limit: number): Promise<NewsArticle[]> {
    try {
      const response = await this.clients.newsapi!.get("/everything", {
        params: {
          q: query,
          language: "en",
          pageSize: limit,
          sortBy: "publishedAt",
        },
      });

      const articles = response.data?.articles ?? [];
      return articles.map((article: Record<string, unknown>) => ({
        title: String(article.title ?? ""),
        description: (article.description as string) ?? null,
        url: String(article.url ?? ""),
        source: String((article.source as { name?: string })?.name ?? "NewsAPI"),
        imageUrl: (article.urlToImage as string) ?? null,
        publishedAt: String(article.publishedAt ?? new Date().toISOString()),
      }));
    } catch (error) {
      throw this.wrapError(error, "newsapi");
    }
  }

  private async fetchNewsData(query: string, limit: number): Promise<NewsArticle[]> {
    try {
      const response = await this.clients.newsdata!.get("/news", {
        params: {
          q: query,
          language: "en",
          apikey: config.apis.newsdata.key,
        },
      });

      const articles = (response.data?.results ?? []).slice(0, limit);
      return articles.map((article: Record<string, unknown>) => ({
        title: String(article.title ?? ""),
        description: (article.description as string) ?? null,
        url: String(article.link ?? ""),
        source: String(article.source_id ?? "NewsData"),
        imageUrl: (article.image_url as string) ?? null,
        publishedAt: String(article.pubDate ?? new Date().toISOString()),
      }));
    } catch (error) {
      throw this.wrapError(error, "newsdata");
    }
  }

  private wrapError(error: unknown, provider: string): NewsServiceError {
    const axiosError = error as AxiosError;
    return new NewsServiceError(`${provider} request failed: ${axiosError.message}`, provider);
  }

  private getFromCache(key: string): NewsArticle[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: NewsArticle[]): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + config.cache.newsTtlSeconds * 1000,
    });
  }
}

export const newsService = new NewsService();

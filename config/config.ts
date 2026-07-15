import { env } from "./env";

export const config = {
  bot: {
    name: "GoalX",
    version: "1.0.0",
    environment: env.NODE_ENV,
    isProduction: env.NODE_ENV === "production",
  },

  discord: {
    token: env.DISCORD_TOKEN,
    clientId: env.DISCORD_CLIENT_ID,
    guildId: env.DISCORD_GUILD_ID,
    defaultCooldown: 3,
  },

  database: {
    mongoUri: env.MONGODB_URI,
    redisUrl: env.REDIS_URL,
  },

  apis: {
    apiFootball: {
      key: env.API_FOOTBALL_KEY,
      baseUrl: "https://v3.football.api-sports.io",
      dailyQuota: 100,
    },
    footballData: {
      key: env.FOOTBALL_DATA_KEY,
      baseUrl: "https://api.football-data.org/v4",
    },
    gemini: {
      key: env.GEMINI_API_KEY,
      model: "gemini-1.5-flash",
    },
    groq: {
      key: env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
    },
    mistral: {
      key: env.MISTRAL_API_KEY,
      model: "mistral-large-latest",
    },
    gnews: {
      key: env.GNEWS_API_KEY,
      baseUrl: "https://gnews.io/api/v4",
    },
    newsapi: {
      key: env.NEWSAPI_KEY,
      baseUrl: "https://newsapi.org/v2",
    },
    newsdata: {
      key: env.NEWSDATA_API_KEY,
      baseUrl: "https://newsdata.io/api/1",
    },
    pollinations: {
      key: env.POLLINATIONS_API_KEY,
      baseUrl: "https://image.pollinations.ai/prompt",
    },
  },

  fantasy: {
    startingBudget: 100.0,
    squadSize: 15,
    startingXI: 11,
    maxPlayersPerTeam: 3,
    transferWindowHours: 24,
    freeTransfersPerWeek: 1,
    captainMultiplier: 2,
    tripleCaptainMultiplier: 3,
  },

  cache: {
    liveMatchTtlSeconds: 30,
    fixturesTtlSeconds: 3600,
    standingsTtlSeconds: 1800,
    newsTtlSeconds: 900,
  },

  pagination: {
    itemsPerPage: 10,
    buttonTimeoutMs: 120000,
  },
} as const;

export type Config = typeof config;

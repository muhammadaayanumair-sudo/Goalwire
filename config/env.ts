import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  DISCORD_GUILD_ID: z.string().optional(),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  REDIS_URL: z.string().optional(),

  API_FOOTBALL_KEY: z.string().min(1, "API_FOOTBALL_KEY is required"),
  FOOTBALL_DATA_KEY: z.string().optional(),

  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),

  GNEWS_API_KEY: z.string().optional(),
  NEWSAPI_KEY: z.string().optional(),
  NEWSDATA_API_KEY: z.string().optional(),

  POLLINATIONS_API_KEY: z.string().optional(),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${missing}`);
  }

  return parsed.data;
}

export const env = loadEnv();

import "dotenv/config";
import { GatewayIntentBits, Partials } from "discord.js";
import { GoalXClient } from "./client/GoalXClient";
import { logger } from "./utils/logger";
import { connectDatabase } from "./database/mongo";
import { env } from "./config/env";
import { startLiveUpdater, stopLiveUpdater } from "./jobs/liveUpdater";
import { startPredictionSweep, stopPredictionSweep } from "./jobs/predictionSweep";

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error });
  process.exit(1);
});

async function bootstrap(): Promise<void> {
  try {
    logger.info("Starting GoalX...");

    await connectDatabase();
    logger.info("Database connected successfully");

    const client = new GoalXClient({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    await client.start(env.DISCORD_TOKEN);

    // Background jobs start only after the client has successfully logged
    // in — liveUpdater needs client.guilds/client.users to be populated,
    // which isn't reliable until Discord's READY event has actually fired
    // (client.start() awaits login, but READY-dependent caches warm up
    // shortly after; both jobs already guard missing guilds/channels
    // defensively, so starting right after login is safe even if caches
    // are still filling in for the first tick or two).
    startLiveUpdater(client);
    startPredictionSweep();
    logger.info("Background jobs started (liveUpdater, predictionSweep)");

    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        stopLiveUpdater();
        stopPredictionSweep();
        await client.destroy();
      } catch (error) {
        logger.error("Error during client shutdown", { error });
      } finally {
        process.exit(0);
      }
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    logger.error("Failed to bootstrap GoalX", { error });
    process.exit(1);
  }
}

void bootstrap();

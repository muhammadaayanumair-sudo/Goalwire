import "dotenv/config";
import { GoalXClient } from "./client/GoalXClient";
import { logger } from "./utils/logger";
import { connectDatabase } from "./database/mongo";
import { env } from "./config/env";

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

    const client = new GoalXClient();
    await client.start(env.DISCORD_TOKEN);

    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
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

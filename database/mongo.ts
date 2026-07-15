import mongoose from "mongoose";
import { env } from "../config/env";
import { logger } from "../utils/logger";

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) {
    logger.warn("Database already connected, skipping reconnect");
    return;
  }

  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => {
    isConnected = true;
    logger.info("Mongoose connection established");
  });

  mongoose.connection.on("error", (error) => {
    logger.error("Mongoose connection error", { error });
  });

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    logger.warn("Mongoose connection disconnected");
  });

  try {
    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
  } catch (error) {
    logger.error("Failed to connect to MongoDB", { error });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info("Disconnected from MongoDB");
  } catch (error) {
    logger.error("Error disconnecting from MongoDB", { error });
    throw error;
  }
}

export function getConnectionStatus(): boolean {
  return isConnected;
}

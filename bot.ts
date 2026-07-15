import { Client, GatewayIntentBits, Partials } from "discord.js";
import { GoalXClient } from "./client/GoalXClient";
import { CommandHandler } from "./client/CommandHandler";
import { EventHandler } from "./client/EventHandler";
import { ComponentHandler } from "./client/ComponentHandler";
import { CooldownManager } from "./client/CooldownManager";
import { logger } from "./utils/logger";

const baseClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

export const client = new GoalXClient(baseClient);

client.cooldowns = new CooldownManager();
client.commandHandler = new CommandHandler(client);
client.eventHandler = new EventHandler(client);
client.componentHandler = new ComponentHandler(client);

export async function initializeBot(): Promise<GoalXClient> {
  try {
    logger.info("Loading commands...");
    await client.commandHandler.loadCommands();

    logger.info("Loading components...");
    await client.componentHandler.loadComponents();

    logger.info("Loading events...");
    await client.eventHandler.loadEvents();

    logger.info("GoalX bot initialized successfully");
    return client;
  } catch (error) {
    logger.error("Failed to initialize GoalX bot", { error });
    throw error;
  }
}

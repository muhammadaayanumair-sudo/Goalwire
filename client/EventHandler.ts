import { readdirSync } from "fs";
import { join } from "path";
import type { GoalXClient } from "./GoalXClient";
import type { BotEvent } from "../types/discord";
import { logger } from "../utils/logger";

export class EventHandler {
  private client: GoalXClient;
  private readonly eventsPath = join(__dirname, "..", "events");

  constructor(client: GoalXClient) {
    this.client = client;
  }

  public async loadEvents(): Promise<void> {
    const eventFiles = readdirSync(this.eventsPath).filter(
      (file) => file.endsWith(".ts") || file.endsWith(".js"),
    );

    let loaded = 0;

    for (const file of eventFiles) {
      try {
        const filePath = join(this.eventsPath, file);
        const imported = await import(filePath);
        const event: BotEvent = imported.default ?? imported.event;

        if (!event?.name || !event?.execute) {
          logger.warn(`Skipping invalid event file: ${file}`);
          continue;
        }

        if (event.once) {
          this.client.once(event.name, (...args) => {
            void this.handleEvent(event, ...args);
          });
        } else {
          this.client.on(event.name, (...args) => {
            void this.handleEvent(event, ...args);
          });
        }

        loaded++;
      } catch (error) {
        logger.error(`Failed to load event ${file}`, { error });
      }
    }

    logger.info(`Loaded ${loaded} events`);
  }

  private async handleEvent(event: BotEvent, ...args: unknown[]): Promise<void> {
    try {
      await event.execute(this.client, ...args);
    } catch (error) {
      logger.error(`Error executing event ${event.name}`, { error });
    }
  }
}

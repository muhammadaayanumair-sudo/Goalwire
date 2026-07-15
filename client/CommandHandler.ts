import { REST, Routes, Collection } from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import type { GoalXClient } from "./GoalXClient";
import type { Command } from "../types/discord";
import { logger } from "../utils/logger";
import { env } from "../config/env";

export class CommandHandler {
  private client: GoalXClient;
  private readonly commandsPath = join(__dirname, "..", "commands");

  constructor(client: GoalXClient) {
    this.client = client;
  }

  public async loadCommands(): Promise<void> {
    this.client.commands = new Collection();
    const categories = readdirSync(this.commandsPath, { withFileTypes: true }).filter((d) =>
      d.isDirectory(),
    );

    for (const category of categories) {
      const categoryPath = join(this.commandsPath, category.name);
      const commandFiles = readdirSync(categoryPath).filter(
        (file) => file.endsWith(".ts") || file.endsWith(".js"),
      );

      for (const file of commandFiles) {
        try {
          const filePath = join(categoryPath, file);
          const imported = await import(filePath);
          const command: Command = imported.default ?? imported.command;

          if (!command?.data || !command?.execute) {
            logger.warn(`Skipping invalid command file: ${category.name}/${file}`);
            continue;
          }

          this.client.commands.set(command.data.name, command);
        } catch (error) {
          logger.error(`Failed to load command ${category.name}/${file}`, { error });
        }
      }
    }

    logger.info(`Loaded ${this.client.commands.size} commands`);
  }

  public async registerCommands(): Promise<void> {
    try {
      const rest = new REST().setToken(env.DISCORD_TOKEN);
      const body = this.client.commands.map((command) => command.data.toJSON());

      if (env.DISCORD_GUILD_ID) {
        await rest.put(
          Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID),
          { body },
        );
        logger.info(`Registered ${body.length} guild commands`);
      } else {
        await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
        logger.info(`Registered ${body.length} global commands`);
      }
    } catch (error) {
      logger.error("Failed to register slash commands", { error });
      throw error;
    }
  }

  public getCommand(name: string): Command | undefined {
    return this.client.commands.get(name);
  }
}

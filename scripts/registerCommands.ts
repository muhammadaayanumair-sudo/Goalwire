import "dotenv/config";
import { REST, Routes } from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import type { Command } from "../types/discord";

const commandsPath = join(__dirname, "..", "commands");

async function loadAllCommands(): Promise<Command[]> {
  const commands: Command[] = [];
  const categories = readdirSync(commandsPath, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const category of categories) {
    const categoryPath = join(commandsPath, category.name);
    const commandFiles = readdirSync(categoryPath).filter(
      (file) => file.endsWith(".ts") || file.endsWith(".js"),
    );

    for (const file of commandFiles) {
      try {
        const filePath = join(categoryPath, file);
        const imported = await import(filePath);
        const command: Command = imported.default ?? imported.command;

        if (!command?.data || !command?.execute) {
          logger.warn(`Skipping invalid command file during registration: ${category.name}/${file}`);
          continue;
        }

        commands.push(command);
      } catch (error) {
        logger.error(`Failed to load command for registration: ${category.name}/${file}`, { error });
      }
    }
  }

  return commands;
}

async function registerCommands(): Promise<void> {
  try {
    const commands = await loadAllCommands();

    if (commands.length === 0) {
      logger.error("No valid commands found to register. Aborting to avoid wiping the command list with nothing.");
      process.exit(1);
    }

    const body = commands.map((command) => command.data.toJSON());
    const rest = new REST().setToken(env.DISCORD_TOKEN);

    logger.info(`Registering ${body.length} commands...`, {
      commandNames: commands.map((c) => c.data.name),
    });

    if (env.DISCORD_GUILD_ID) {
      // Guild-scoped registration: updates instantly, ideal while testing.
      // This ONLY replaces commands for the one guild specified — old GLOBAL
      // commands from Replit (if any were registered globally) will NOT be
      // removed by this path. See the global branch below if that's the case.
      const result = await rest.put(
        Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID),
        { body },
      );
      logger.info(`Successfully registered ${(result as unknown[]).length} guild commands`, {
        guildId: env.DISCORD_GUILD_ID,
      });
    } else {
      // Global registration: replaces ALL global commands for this application,
      // which is what actually overwrites old Replit commands if they were
      // registered globally. Can take up to 1 hour to propagate to all servers.
      const result = await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
      logger.info(`Successfully registered ${(result as unknown[]).length} global commands`, {
        note: "Global commands can take up to 1 hour to appear/update in Discord clients.",
      });
    }

    logger.info("Command registration complete.");
    process.exit(0);
  } catch (error) {
    logger.error("Failed to register commands", { error });
    process.exit(1);
  }
}

void registerCommands();

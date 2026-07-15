import {
  Client,
  Collection,
  ClientOptions,
} from "discord.js";
import { CommandHandler } from "./CommandHandler";
import { EventHandler } from "./EventHandler";
import { ComponentHandler } from "./ComponentHandler";
import { CooldownManager } from "./CooldownManager";
import { logger } from "../utils/logger";
import type { Command } from "../types/discord";

export class GoalXClient extends Client {
  public commands: Collection<string, Command> = new Collection();
  public cooldowns!: CooldownManager;
  public commandHandler!: CommandHandler;
  public eventHandler!: EventHandler;
  public componentHandler!: ComponentHandler;

  constructor(options: ClientOptions) {
    super(options);
  }

  public async start(token: string): Promise<void> {
    try {
      this.cooldowns = new CooldownManager();
      this.commandHandler = new CommandHandler(this);
      this.eventHandler = new EventHandler(this);
      this.componentHandler = new ComponentHandler(this);

      await this.commandHandler.loadCommands();
      await this.componentHandler.loadComponents();
      await this.eventHandler.loadEvents();

      await this.login(token);
    } catch (error) {
      logger.error("Failed to start GoalX client", { error });
      throw error;
    }
  }

  public async destroy(): Promise<void> {
    try {
      logger.info("Destroying GoalX client...");
      await super.destroy();
    } catch (error) {
      logger.error("Error while destroying client", { error });
      throw error;
    }
  }
}

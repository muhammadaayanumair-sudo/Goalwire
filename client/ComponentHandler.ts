import { readdirSync, existsSync } from "fs";
import { join } from "path";
import { Collection, Interaction } from "discord.js";
import type { GoalXClient } from "./GoalXClient";
import type { ButtonComponent, SelectMenuComponent, ModalComponent } from "../types/discord";
import { logger } from "../utils/logger";

export class ComponentHandler {
  private client: GoalXClient;
  private readonly componentsPath = join(__dirname, "..", "components");

  public buttons: Collection<string, ButtonComponent> = new Collection();
  public selectMenus: Collection<string, SelectMenuComponent> = new Collection();
  public modals: Collection<string, ModalComponent> = new Collection();

  constructor(client: GoalXClient) {
    this.client = client;
  }

  public async loadComponents(): Promise<void> {
    await this.loadCategory("buttons", this.buttons);
    await this.loadCategory("selectMenus", this.selectMenus);
    await this.loadCategory("modals", this.modals);

    logger.info(
      `Loaded ${this.buttons.size} buttons, ${this.selectMenus.size} select menus, ${this.modals.size} modals`,
    );
  }

  private async loadCategory(
    folder: string,
    collection: Collection<string, ButtonComponent | SelectMenuComponent | ModalComponent>,
  ): Promise<void> {
    const folderPath = join(this.componentsPath, folder);

    if (!existsSync(folderPath)) {
      logger.warn(`Component folder "${folder}" does not exist yet — skipping (0 components loaded)`, {
        folderPath,
      });
      return;
    }

    let files: string[];
    try {
      files = readdirSync(folderPath).filter((file) => file.endsWith(".ts") || file.endsWith(".js"));
    } catch (error) {
      logger.error(`Failed to read component folder "${folder}"`, { error, folderPath });
      return;
    }

    if (files.length === 0) {
      logger.info(`Component folder "${folder}" is empty — 0 components loaded`);
      return;
    }

    for (const file of files) {
      try {
        const filePath = join(folderPath, file);
        const imported = await import(filePath);
        const items: Array<ButtonComponent | SelectMenuComponent | ModalComponent> =
          imported.default ?? imported.components;

        if (!Array.isArray(items)) {
          logger.warn(`Skipping invalid component file: ${folder}/${file}`);
          continue;
        }

        for (const item of items) {
          if (!item?.customId || !item?.execute) {
            logger.warn(`Skipping invalid component export in ${folder}/${file}`);
            continue;
          }
          collection.set(item.customId, item);
        }
      } catch (error) {
        logger.error(`Failed to load component ${folder}/${file}`, { error, folderPath });
      }
    }
  }

  public async routeInteraction(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isButton()) {
        const component = this.matchComponent(this.buttons, interaction.customId);
        if (component) await component.execute(this.client, interaction);
        return;
      }

      if (
        interaction.isStringSelectMenu() ||
        interaction.isUserSelectMenu() ||
        interaction.isRoleSelectMenu() ||
        interaction.isChannelSelectMenu()
      ) {
        const component = this.matchComponent(this.selectMenus, interaction.customId);
        if (component) await component.execute(this.client, interaction);
        return;
      }

      if (interaction.isModalSubmit()) {
        const component = this.matchComponent(this.modals, interaction.customId);
        if (component) await component.execute(this.client, interaction);
        return;
      }
    } catch (error) {
      logger.error("Error routing interaction", {
        error,
        customId: (interaction as { customId?: string }).customId,
      });
    }
  }

  private matchComponent<T>(collection: Collection<string, T>, customId: string): T | undefined {
    if (collection.has(customId)) return collection.get(customId);

    for (const [key, value] of collection) {
      if (customId.startsWith(key)) return value;
    }

    return undefined;
  }
}

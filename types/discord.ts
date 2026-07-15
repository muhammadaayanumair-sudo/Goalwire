import {
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  AnySelectMenuInteraction,
  ModalSubmitInteraction,
  PermissionResolvable,
} from "discord.js";
import type { GoalXClient } from "../client/GoalXClient";

export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder;
  category?: string;
  cooldown?: number;
  permissions?: PermissionResolvable[];
  partnerOnly?: boolean;
  execute: (client: GoalXClient, interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface BotEvent {
  name: string;
  once?: boolean;
  execute: (client: GoalXClient, ...args: unknown[]) => Promise<void>;
}

export interface ButtonComponent {
  customId: string;
  execute: (client: GoalXClient, interaction: ButtonInteraction) => Promise<void>;
}

export interface SelectMenuComponent {
  customId: string;
  execute: (client: GoalXClient, interaction: AnySelectMenuInteraction) => Promise<void>;
}

export interface ModalComponent {
  customId: string;
  execute: (client: GoalXClient, interaction: ModalSubmitInteraction) => Promise<void>;
}

export interface PaginationOptions {
  itemsPerPage?: number;
  timeoutMs?: number;
}

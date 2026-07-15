import {
  ChatInputCommandInteraction,
  PermissionsBitField,
  GuildMember,
  PermissionResolvable,
} from "discord.js";
import { Server } from "../database/models/Server";
import { PERMISSIONS_MESSAGES } from "../config/constants";
import { logger } from "./logger";

export function isAdministrator(member: GuildMember | null): boolean {
  if (!member) return false;
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

export function hasPermissions(
  member: GuildMember | null,
  permissions: PermissionResolvable[],
): boolean {
  if (!member) return false;
  return permissions.every((permission) => member.permissions.has(permission));
}

export async function requireAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const member = interaction.member as GuildMember | null;

  if (!isAdministrator(member)) {
    await interaction.reply({
      content: PERMISSIONS_MESSAGES.NO_ADMIN,
      ephemeral: true,
    });
    return false;
  }

  return true;
}

export async function requirePartnerServer(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!interaction.guildId) return false;

  try {
    const server = await Server.findOne({ guildId: interaction.guildId });

    if (!server?.isPartner) {
      await interaction.reply({
        content: PERMISSIONS_MESSAGES.NO_PARTNER,
        ephemeral: true,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error checking partner server status", { error, guildId: interaction.guildId });
    return false;
  }
}

export async function requireFantasyUnlocked(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!interaction.guildId) return false;

  try {
    const server = await Server.findOne({ guildId: interaction.guildId });

    if (server?.fantasyLocked) {
      await interaction.reply({
        content: PERMISSIONS_MESSAGES.FANTASY_LOCKED,
        ephemeral: true,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error checking fantasy lock status", { error, guildId: interaction.guildId });
    return false;
  }
}

import { Events, Interaction, GuildMember } from "discord.js";
import type { GoalXClient } from "../client/GoalXClient";
import type { BotEvent } from "../types/discord";
import { errorEmbed } from "../utils/embeds";
import { economyService } from "../services/economy/EconomyService";
import { logger } from "../utils/logger";

const event: BotEvent = {
  name: Events.InteractionCreate,
  once: false,

  async execute(client: GoalXClient, ...args: unknown[]): Promise<void> {
    const interaction = args[0] as Interaction;

    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commandHandler.getCommand(interaction.commandName);

        if (!command) {
          logger.warn("Received interaction for unknown command", {
            commandName: interaction.commandName,
          });
          await interaction.reply({
            embeds: [errorEmbed("This command is no longer available.")],
            ephemeral: true,
          });
          return;
        }

        const cooldownCheck = client.cooldowns.checkCooldown(
          interaction.commandName,
          interaction.user.id,
          command.cooldown,
        );

        if (cooldownCheck.onCooldown) {
          await interaction.reply({
            embeds: [
              errorEmbed(
                `Please wait ${cooldownCheck.timeLeft.toFixed(1)}s before using this command again.`,
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        if (command.permissions?.length) {
          const member = interaction.member as GuildMember | null;

          const hasAllPermissions =
            member instanceof GuildMember
              ? command.permissions.every((perm) => member.permissions.has(perm))
              : false;

          if (!hasAllPermissions) {
            await interaction.reply({
              embeds: [errorEmbed("You don't have permission to use this command.")],
              ephemeral: true,
            });
            return;
          }
        }

        await command.execute(client, interaction);

        // Broader-activity XP: any successfully executed command can award
        // command_used XP, gated by EconomyService's own 10-minute cooldown
        // (not this command's per-command cooldown) so users can't farm XP
        // by rotating between different commands rapidly. Runs after
        // command.execute() and is fire-and-forget from the user's
        // perspective — failures here must never surface as a user-facing
        // error for an otherwise-successful command.
        try {
          await economyService.awardCommandUsage(interaction.user.id, interaction.user.username);
        } catch (economyError) {
          logger.warn("Failed to award command-usage XP", {
            error: economyError,
            userId: interaction.user.id,
            commandName: interaction.commandName,
          });
        }

        return;
      }

      if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
        await client.componentHandler.routeInteraction(interaction);
        return;
      }
    } catch (error) {
      logger.error("Unhandled error in interactionCreate", {
        error,
        interactionType: interaction.type,
      });

      try {
        if (interaction.isRepliable()) {
          const errorPayload = { embeds: [errorEmbed("Something went wrong processing that.")], ephemeral: true };

          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorPayload);
          } else {
            await interaction.reply(errorPayload);
          }
        }
      } catch (replyError) {
        logger.error("Failed to send error response to user", { replyError });
      }
    }
  },
};

export default event;

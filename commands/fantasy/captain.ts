import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} from "discord.js";
import type { Command } from "../../types/discord";
import { fantasyService, FantasyError } from "../../services/fantasy/FantasyService";
import { errorEmbed, fantasyEmbed } from "../../utils/embeds";
import { CUSTOM_IDS, EMOJIS } from "../../config/constants";
import { formatCurrency } from "../../utils/formatter";
import { logger } from "../../utils/logger";
import type { IFantasyPlayer } from "../../database/models/FantasyTeam";

const SELECT_TIMEOUT_MS = 60000;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof FantasyError || error instanceof Error) return error.message;
  return fallback;
}

function buildSelectMenu(
  players: IFantasyPlayer[],
  customId: string,
  role: "captain" | "vice-captain",
  currentId?: number,
): StringSelectMenuBuilder {
  const options = players.slice(0, 25).map((p) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(p.name)
      .setDescription(`${p.position} • ${formatCurrency(p.price)} • ${p.teamName}`)
      .setValue(String(p.playerId))
      .setDefault(p.playerId === currentId)
      .setEmoji(role === "captain" ? "👑" : "🥈"),
  );

  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(`Choose your ${role}`)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(options);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("captain")
    .setDescription("Set your captain and vice-captain for this gameweek") as SlashCommandBuilder,
  category: "fantasy",
  cooldown: 5,

  async execute(client, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    if (!interaction.guildId) {
      await interaction.editReply({
        embeds: [errorEmbed("This command can only be used inside a server.")],
      });
      return;
    }

    try {
      const team = await fantasyService.getTeam(interaction.user.id, interaction.guildId);

      if (!team) {
        await interaction.editReply({
          embeds: [errorEmbed("You don't have a fantasy team yet. Use `/create` to get started.")],
        });
        return;
      }

      const starting = team.players.filter((p) => p.isStarting);

      if (starting.length === 0) {
        await interaction.editReply({
          embeds: [errorEmbed("You need a starting XI before setting a captain. Use `/lineup` first.")],
        });
        return;
      }

      const currentCaptain = starting.find((p) => p.isCaptain);
      const currentVice = starting.find((p) => p.isViceCaptain);

      const embed = fantasyEmbed({
        title: `${EMOJIS.CROWN} Set Captain & Vice-Captain`,
        description: [
          `Current Captain: ${currentCaptain ? `**${currentCaptain.name}** (×2 points)` : "*None set*"}`,
          `Current Vice-Captain: ${currentVice ? `**${currentVice.name}**` : "*None set*"}`,
          "",
          "Select your captain below. If your captain doesn't play, points auto-transfer to your vice-captain.",
        ].join("\n"),
      });

      const captainMenu = buildSelectMenu(starting, `${CUSTOM_IDS.FANTASY.CAPTAIN}_select`, "captain", currentCaptain?.playerId);
      const viceMenu = buildSelectMenu(starting, `${CUSTOM_IDS.FANTASY.CAPTAIN}_vice_select`, "vice-captain", currentVice?.playerId);

      const message = await interaction.editReply({
        embeds: [embed],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(captainMenu),
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(viceMenu),
        ],
      });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: SELECT_TIMEOUT_MS,
        filter: (i) => i.user.id === interaction.user.id,
      });

      collector.on("collect", async (selectInteraction) => {
        try {
          await selectInteraction.deferUpdate();
          const playerId = Number(selectInteraction.values[0]);
          const isVice = selectInteraction.customId.includes("vice");

          const updatedTeam = isVice
            ? await fantasyService.setViceCaptain(interaction.user.id, interaction.guildId!, playerId)
            : await fantasyService.setCaptain(interaction.user.id, interaction.guildId!, playerId);

          const newCaptain = updatedTeam.players.find((p) => p.isCaptain);
          const newVice = updatedTeam.players.find((p) => p.isViceCaptain);

          const confirmEmbed = fantasyEmbed({
            title: `${EMOJIS.CHECK} Captaincy Updated`,
            description: [
              `Captain: ${newCaptain ? `**${newCaptain.name}** (×2 points)` : "*None set*"}`,
              `Vice-Captain: ${newVice ? `**${newVice.name}**` : "*None set*"}`,
            ].join("\n"),
          });

          await interaction.editReply({ embeds: [confirmEmbed], components: [] });
          collector.stop("completed");
        } catch (error: unknown) {
          const message = getErrorMessage(error, "Failed to update captaincy.");
          logger.error("Error updating captaincy", { error, userId: interaction.user.id });
          await selectInteraction.followUp({ embeds: [errorEmbed(message)], ephemeral: true });
        }
      });

      collector.on("end", async (_collected, reason) => {
        if (reason === "completed") return;

        try {
          await interaction.editReply({ components: [] });
        } catch (error) {
          logger.warn("Failed to clear captain selection components on timeout", { error });
        }
      });
    } catch (error: unknown) {
      logger.error("Error in /captain command", { error, userId: interaction.user.id });
      const message = getErrorMessage(error, "Failed to load captaincy options.");
      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

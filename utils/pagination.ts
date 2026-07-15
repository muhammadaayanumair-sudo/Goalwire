import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  Message,
  ComponentType,
} from "discord.js";
import { CUSTOM_IDS } from "../config/constants";
import { config } from "../config/config";
import { logger } from "./logger";

interface PaginationOptions {
  interaction: ChatInputCommandInteraction;
  embeds: EmbedBuilder[];
  timeoutMs?: number;
  ephemeral?: boolean;
}

function buildPaginationRow(currentPage: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.PAGINATION.FIRST)
      .setEmoji("⏮️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.PAGINATION.PREV)
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.PAGINATION.NEXT)
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === totalPages - 1),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.PAGINATION.LAST)
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === totalPages - 1),
  );
}

export async function paginateEmbeds(options: PaginationOptions): Promise<void> {
  const { interaction, embeds, ephemeral = false } = options;
  const timeoutMs = options.timeoutMs ?? config.pagination.buttonTimeoutMs;

  if (embeds.length === 0) return;

  if (embeds.length === 1) {
    await interaction.editReply({ embeds: [embeds[0]], components: [] });
    return;
  }

  let currentPage = 0;
  const totalPages = embeds.length;

  embeds.forEach((embed, index) => {
    embed.setFooter({ text: `Page ${index + 1} of ${totalPages} • GoalX` });
  });

  const message = (await interaction.editReply({
    embeds: [embeds[currentPage]],
    components: [buildPaginationRow(currentPage, totalPages)],
  })) as Message;

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: timeoutMs,
    filter: (i: ButtonInteraction) => i.user.id === interaction.user.id,
  });

  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    try {
      switch (buttonInteraction.customId) {
        case CUSTOM_IDS.PAGINATION.FIRST:
          currentPage = 0;
          break;
        case CUSTOM_IDS.PAGINATION.PREV:
          currentPage = Math.max(0, currentPage - 1);
          break;
        case CUSTOM_IDS.PAGINATION.NEXT:
          currentPage = Math.min(totalPages - 1, currentPage + 1);
          break;
        case CUSTOM_IDS.PAGINATION.LAST:
          currentPage = totalPages - 1;
          break;
        default:
          return;
      }

      await buttonInteraction.update({
        embeds: [embeds[currentPage]],
        components: [buildPaginationRow(currentPage, totalPages)],
      });
    } catch (error) {
      logger.error("Error handling pagination interaction", { error });
    }
  });

  collector.on("end", async () => {
    try {
      const disabledRow = buildPaginationRow(currentPage, totalPages);
      disabledRow.components.forEach((btn) => btn.setDisabled(true));
      await interaction.editReply({ components: [disabledRow] });
    } catch (error) {
      logger.error("Error disabling pagination on timeout", { error, ephemeral });
    }
  });
}

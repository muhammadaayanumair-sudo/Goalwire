import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type { Command } from "../../types/discord";
import { rankingService, RankingError } from "../../services/fantasy/RankingService";
import { errorEmbed, fantasyEmbed } from "../../utils/embeds";
import { CUSTOM_IDS, EMOJIS } from "../../config/constants";
import { formatPoints, formatOrdinal } from "../../utils/formatter";
import { logger } from "../../utils/logger";

const PAGE_SIZE = 10;
const COLLECTOR_TIMEOUT_MS = 120000;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the fantasy leaderboard for this server") as SlashCommandBuilder,
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

    let currentPage = 0;

    try {
      const initialPage = await rankingService.getGlobalLeaderboard({
        guildId: interaction.guildId,
        page: currentPage,
        pageSize: PAGE_SIZE,
      });

      if (initialPage.totalEntries === 0) {
        await interaction.editReply({
          embeds: [errorEmbed("No fantasy teams have been created in this server yet. Be the first with `/create`!")],
        });
        return;
      }

      const userRank = await rankingService.getUserRank(interaction.user.id, interaction.guildId);

      const buildEmbed = (page: typeof initialPage) => {
        const lines = page.entries.map((entry) => {
          const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `**${entry.rank}.**`;
          return `${medal} ${entry.teamName} — ${formatPoints(entry.totalPoints)} *(GW: ${formatPoints(entry.gameweekPoints)})*`;
        });

        return fantasyEmbed({
          title: `${EMOJIS.TROPHY} Fantasy Leaderboard`,
          description: lines.join("\n"),
          fields: userRank
            ? [
                {
                  name: "Your Position",
                  value: `${formatOrdinal(userRank.rank)} of ${userRank.totalTeams} — ${formatPoints(userRank.totalPoints)}`,
                },
              ]
            : [],
          footerText: `Page ${page.currentPage + 1} of ${page.totalPages} • GoalX Fantasy`,
        });
      };

      const buildRow = (page: typeof initialPage) =>
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(CUSTOM_IDS.PAGINATION.PREV)
            .setEmoji("◀️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page.currentPage === 0),
          new ButtonBuilder()
            .setCustomId(CUSTOM_IDS.PAGINATION.NEXT)
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page.currentPage >= page.totalPages - 1),
        );

      const message = await interaction.editReply({
        embeds: [buildEmbed(initialPage)],
        components: initialPage.totalPages > 1 ? [buildRow(initialPage)] : [],
      });

      if (initialPage.totalPages <= 1) return;

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: COLLECTOR_TIMEOUT_MS,
        filter: (i) => i.user.id === interaction.user.id,
      });

      collector.on("collect", async (buttonInteraction) => {
        try {
          if (buttonInteraction.customId === CUSTOM_IDS.PAGINATION.NEXT) {
            currentPage += 1;
          } else if (buttonInteraction.customId === CUSTOM_IDS.PAGINATION.PREV) {
            currentPage = Math.max(0, currentPage - 1);
          }

          const nextPage = await rankingService.getGlobalLeaderboard({
            guildId: interaction.guildId!,
            page: currentPage,
            pageSize: PAGE_SIZE,
          });

          currentPage = nextPage.currentPage;

          await buttonInteraction.update({
            embeds: [buildEmbed(nextPage)],
            components: [buildRow(nextPage)],
          });
        } catch (error) {
          logger.error("Error paginating leaderboard", { error, guildId: interaction.guildId });
          await buttonInteraction.reply({
            embeds: [errorEmbed("Failed to load that page. Please try again.")],
            ephemeral: true,
          });
        }
      });

      collector.on("end", async () => {
        try {
          const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            ButtonBuilder.from(buildRow(initialPage).components[0]).setDisabled(true),
            ButtonBuilder.from(buildRow(initialPage).components[1]).setDisabled(true),
          );
          await interaction.editReply({ components: [disabledRow] });
        } catch (error) {
          logger.warn("Failed to disable leaderboard buttons on timeout", { error });
        }
      });
    } catch (error) {
      logger.error("Error in /leaderboard command", { error, guildId: interaction.guildId });

      const message =
        error instanceof RankingError || error instanceof Error
          ? error.message
          : "Failed to load the leaderboard.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

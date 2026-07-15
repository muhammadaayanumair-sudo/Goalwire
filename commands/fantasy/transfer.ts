import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { Command } from "../../types/discord";
import { fantasyService } from "../../services/fantasy/FantasyService";
import { transferService, TransferError } from "../../services/fantasy/TransferService";
import { playerService } from "../../services/football/PlayerService";
import { errorEmbed, fantasyEmbed, warningEmbed } from "../../utils/embeds";
import { CUSTOM_IDS, EMOJIS } from "../../config/constants";
import { formatCurrency } from "../../utils/formatter";
import { logger } from "../../utils/logger";
import type { FantasyPlayerPool, FantasyPosition } from "../../types/fantasy";

const CURRENT_SEASON = new Date().getFullYear();

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("transfer")
    .setDescription("Transfer a player out of your fantasy squad")
    .addStringOption((option) =>
      option
        .setName("player_out")
        .setDescription("Name of the player to transfer out")
        .setRequired(true)
        .setAutocomplete(false),
    )
    .addStringOption((option) =>
      option
        .setName("player_in")
        .setDescription("Name of the replacement player to search for")
        .setRequired(true),
    ) as SlashCommandBuilder,
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

    const playerOutName = interaction.options.getString("player_out", true).trim();
    const playerInQuery = interaction.options.getString("player_in", true).trim();

    try {
      const team = await fantasyService.getTeam(interaction.user.id, interaction.guildId);

      if (!team) {
        await interaction.editReply({
          embeds: [errorEmbed("You don't have a fantasy team yet. Use `/create` to get started.")],
        });
        return;
      }

      const playerOut = team.players.find(
        (p) => p.name.toLowerCase() === playerOutName.toLowerCase(),
      );

      if (!playerOut) {
        await interaction.editReply({
          embeds: [
            errorEmbed(
              `**${playerOutName}** is not in your squad. Check \`/team\` for exact player names.`,
            ),
          ],
        });
        return;
      }

      if (team.isLocked) {
        await interaction.editReply({
          embeds: [errorEmbed("Transfers are locked for this gameweek.")],
        });
        return;
      }

      const searchResults = await playerService.searchPlayers(playerInQuery, CURRENT_SEASON);

      const candidates = searchResults
        .filter((result) => this.mapApiPosition(result.statistics[0]?.games?.position) === playerOut.position)
        .slice(0, 25);

      if (candidates.length === 0) {
        await interaction.editReply({
          embeds: [
            errorEmbed(
              `No ${playerOut.position} players found matching "${playerInQuery}". Try a different search.`,
            ),
          ],
        });
        return;
      }

      if (candidates.length === 1) {
        await this.executeTransfer(interaction, playerOut.playerId, candidates[0], team.remainingBudget);
        return;
      }

      const embed = fantasyEmbed({
        title: `${EMOJIS.TRANSFER} Confirm Replacement`,
        description: `Transferring out **${playerOut.name}** (${playerOut.position}, ${formatCurrency(playerOut.price)}).\n\nSelect the replacement below:`,
        footerText: `Budget after sale: ${formatCurrency(team.remainingBudget + playerOut.price)}`,
      });

      const options = candidates.map((result) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(result.player.name)
          .setDescription(`${result.player.nationality} • Search: ${playerInQuery}`)
          .setValue(`${playerOut.playerId}:${result.player.id}`),
      );

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${CUSTOM_IDS.MODAL.TRANSFER}_confirm`)
        .setPlaceholder("Choose the replacement player")
        .addOptions(options);

      const cancelRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("transfer_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger),
      );

      await interaction.editReply({
        embeds: [embed],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu), cancelRow],
      });
    } catch (error) {
      logger.error("Error in /transfer command", { error, userId: interaction.user.id });

      const message =
        error instanceof TransferError || error instanceof Error
          ? error.message
          : "Failed to process your transfer.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },

  async executeTransfer(
    interaction: ChatInputCommandInteraction,
    playerOutId: number,
    candidate: { player: { id: number; name: string }; statistics: { team?: { id: number; name: string }; games?: { position: string } }[] },
    _remainingBudgetBeforeSale: number,
  ): Promise<void> {
    if (!interaction.guildId) return;

    const stats = candidate.statistics[0];
    const price = this.estimatePrice(stats);

    const playerIn: FantasyPlayerPool = {
      playerId: candidate.player.id,
      name: candidate.player.name,
      position: this.mapApiPosition(stats?.games?.position),
      teamId: (stats as { team?: { id: number } })?.team?.id ?? 0,
      teamName: (stats as { team?: { name: string } })?.team?.name ?? "Unknown",
      price,
      totalPoints: 0,
      form: 5,
      ownership: 0,
      injured: false,
    };

    const result = await transferService.transferPlayer(
      interaction.user.id,
      interaction.guildId,
      playerOutId,
      playerIn,
    );

    const embed =
      result.costPoints > 0
        ? warningEmbed(
            `Transfer complete. **-${result.costPoints} points** deducted for using an extra transfer.\n\nFree transfers remaining: **${result.freeTransfersRemaining}**`,
            "Transfer Complete (Cost Applied)",
          )
        : fantasyEmbed({
            title: `${EMOJIS.CHECK} Transfer Complete`,
            description: `**${playerIn.name}** has joined your squad.\n\nFree transfers remaining: **${result.freeTransfersRemaining}**`,
          });

    await interaction.editReply({ embeds: [embed], components: [] });
  },

  mapApiPosition(position: string | undefined): FantasyPosition {
    const normalized = (position ?? "").toLowerCase();
    if (normalized.includes("goalkeeper")) return "GK";
    if (normalized.includes("defender")) return "DEF";
    if (normalized.includes("midfielder")) return "MID";
    return "FWD";
  },

  estimatePrice(stats: { goals?: { total?: number | null }; games?: { appearences?: number } } | undefined): number {
    const goals = stats?.goals?.total ?? 0;
    const appearances = stats?.games?.appearences ?? 1;
    const basePrice = 4.5;
    const performanceBonus = Math.min((goals / Math.max(appearances, 1)) * 10, 8);
    return Math.round((basePrice + performanceBonus) * 10) / 10;
  },
};

export default command;

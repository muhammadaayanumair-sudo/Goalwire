import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import type { Command } from "../../types/discord";
import { fantasyService } from "../../services/fantasy/FantasyService";
import { errorEmbed, fantasyEmbed } from "../../utils/embeds";
import { CUSTOM_IDS, EMOJIS } from "../../config/constants";
import { formatCurrency } from "../../utils/formatter";
import { logger } from "../../utils/logger";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("lineup")
    .setDescription("Set your starting XI for the upcoming gameweek") as SlashCommandBuilder,
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

      if (team.isLocked) {
        await interaction.editReply({
          embeds: [errorEmbed("Your lineup is locked for this gameweek.")],
        });
        return;
      }

      if (team.players.length < 11) {
        await interaction.editReply({
          embeds: [
            errorEmbed(
              `You need at least 11 players in your squad to set a lineup. You currently have ${team.players.length}.`,
            ),
          ],
        });
        return;
      }

      const starting = team.players.filter((p) => p.isStarting);
      const bench = team.players.filter((p) => !p.isStarting);

      const embed = fantasyEmbed({
        title: `${EMOJIS.FOOTBALL} Set Your Lineup`,
        description: "Select up to 11 players to start this gameweek from the menu below.",
        fields: [
          {
            name: `Current Starting XI (${starting.length})`,
            value:
              starting.length > 0
                ? starting.map((p) => `${p.name} (${p.position}) — ${formatCurrency(p.price)}`).join("\n")
                : "*None selected*",
          },
          {
            name: `Bench (${bench.length})`,
            value:
              bench.length > 0
                ? bench.map((p) => `${p.name} (${p.position})`).join("\n")
                : "*Empty*",
          },
        ],
      });

      const options = team.players.slice(0, 25).map((p) => ({
        label: `${p.name} (${p.position})`,
        description: `${formatCurrency(p.price)} • ${p.teamName}`,
        value: String(p.playerId),
        default: p.isStarting,
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(CUSTOM_IDS.SELECT.PLAYER)
        .setPlaceholder("Select your starting XI (max 11)")
        .setMinValues(1)
        .setMaxValues(Math.min(11, options.length))
        .addOptions(options);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      logger.error("Error in /lineup command", { error, userId: interaction.user.id });

      const message = error instanceof Error ? error.message : "Failed to load your lineup.";
      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { fantasyService } from "../../services/fantasy/FantasyService";
import { errorEmbed, fantasyEmbed } from "../../utils/embeds";
import { EMOJIS } from "../../config/constants";
import { formatPoints, formatOrdinal } from "../../utils/formatter";
import { logger } from "../../utils/logger";

const MAX_DISPLAYED_GAMEWEEKS = 15;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription("View your gameweek-by-gameweek points history") as SlashCommandBuilder,
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

      if (team.history.length === 0) {
        await interaction.editReply({
          embeds: [
            fantasyEmbed({
              title: `${EMOJIS.CHART} ${team.teamName} — History`,
              description: "No gameweeks have been completed yet. Check back after the first gameweek finishes.",
            }),
          ],
        });
        return;
      }

      const sortedHistory = [...team.history].sort((a, b) => b.gameweek - a.gameweek);
      const displayed = sortedHistory.slice(0, MAX_DISPLAYED_GAMEWEEKS);

      const bestGameweek = [...team.history].sort((a, b) => b.points - a.points)[0];
      const worstGameweek = [...team.history].sort((a, b) => a.points - b.points)[0];
      const average = team.history.reduce((sum, h) => sum + h.points, 0) / team.history.length;

      let previousPoints: number | null = null;
      const lines = displayed.map((entry) => {
        let trend = "";
        if (previousPoints !== null) {
          trend = entry.points > previousPoints ? " 📈" : entry.points < previousPoints ? " 📉" : " ➡️";
        }
        previousPoints = entry.points;

        const rankText = entry.rank ? ` • ${formatOrdinal(entry.rank)}` : "";
        return `**GW${entry.gameweek}**: ${formatPoints(entry.points)}${rankText}${trend}`;
      });

      const embed = fantasyEmbed({
        title: `${EMOJIS.CHART} ${team.teamName} — History`,
        description: lines.join("\n"),
        fields: [
          { name: "Best Gameweek", value: `GW${bestGameweek.gameweek}: ${formatPoints(bestGameweek.points)}`, inline: true },
          { name: "Worst Gameweek", value: `GW${worstGameweek.gameweek}: ${formatPoints(worstGameweek.points)}`, inline: true },
          { name: "Average", value: formatPoints(Math.round(average * 10) / 10), inline: true },
        ],
        footerText:
          team.history.length > MAX_DISPLAYED_GAMEWEEKS
            ? `Showing last ${MAX_DISPLAYED_GAMEWEEKS} of ${team.history.length} gameweeks`
            : undefined,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error("Error in /history command", { error, userId: interaction.user.id });

      const message = error instanceof Error ? error.message : "Failed to load your history.";
      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

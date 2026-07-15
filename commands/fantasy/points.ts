import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { fantasyService, FantasyError } from "../../services/fantasy/FantasyService";
import { pointsService } from "../../services/fantasy/PointsService";
import { errorEmbed, fantasyEmbed } from "../../utils/embeds";
import { EMOJIS } from "../../config/constants";
import { formatPoints, formatOrdinal } from "../../utils/formatter";
import { logger } from "../../utils/logger";
import { FantasyTeam } from "../../database/models/FantasyTeam";

const MAX_HISTORY_DISPLAY = 6;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("points")
    .setDescription("View your fantasy points breakdown")
    .addIntegerOption((option) =>
      option
        .setName("gameweek")
        .setDescription("View a specific past gameweek (defaults to current)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(50),
    ) as SlashCommandBuilder,
  category: "fantasy",
  cooldown: 3,

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

      const requestedGameweek = interaction.options.getInteger("gameweek");
      const targetGameweek = requestedGameweek ?? team.currentGameweek;

      const historyEntry = team.history.find((h) => h.gameweek === targetGameweek);

      if (requestedGameweek && !historyEntry) {
        await interaction.editReply({
          embeds: [
            errorEmbed(
              `No recorded points for gameweek ${requestedGameweek}. You may not have had a team, or it hasn't been processed yet.`,
            ),
          ],
        });
        return;
      }

      const pointsThisGameweek = historyEntry?.points ?? team.gameweekPoints;

      const rankAbove = await FantasyTeam.countDocuments({
        guildId: interaction.guildId,
        totalPoints: { $gt: team.totalPoints },
      });
      const totalTeams = await FantasyTeam.countDocuments({ guildId: interaction.guildId });

      const captain = team.players.find((p) => p.isCaptain);
      const viceCaptain = team.players.find((p) => p.isViceCaptain);

      const recentHistory = [...team.history]
        .sort((a, b) => b.gameweek - a.gameweek)
        .slice(0, MAX_HISTORY_DISPLAY);

      const historyLines =
        recentHistory.length > 0
          ? recentHistory
              .map((h) => `GW${h.gameweek}: ${formatPoints(h.points)}${h.rank ? ` (${formatOrdinal(h.rank)})` : ""}`)
              .join("\n")
          : "*No gameweek history yet*";

      const embed = fantasyEmbed({
        title: `${EMOJIS.CHART} ${team.teamName} — Points`,
        description: `Overall rank: **${formatOrdinal(rankAbove + 1)}** of ${totalTeams} teams in this server`,
        fields: [
          {
            name: requestedGameweek ? `Gameweek ${targetGameweek}` : "Current Gameweek",
            value: formatPoints(pointsThisGameweek),
            inline: true,
          },
          { name: "Total Points", value: formatPoints(team.totalPoints), inline: true },
          {
            name: "Captain Bonus",
            value: captain ? `**${captain.name}** (×2)` : "*No captain set*",
            inline: true,
          },
          {
            name: "Vice-Captain",
            value: viceCaptain ? viceCaptain.name : "*Not set*",
            inline: true,
          },
          { name: "Recent Gameweeks", value: historyLines, inline: false },
        ],
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error("Error in /points command", { error, userId: interaction.user.id });

      const message =
        error instanceof FantasyError || error instanceof Error
          ? error.message
          : "Failed to load your points.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

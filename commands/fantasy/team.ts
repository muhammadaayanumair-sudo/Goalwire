import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { Command } from "../../types/discord";
import { fantasyService } from "../../services/fantasy/FantasyService";
import { errorEmbed, fantasyEmbed } from "../../utils/embeds";
import { CUSTOM_IDS, EMOJIS, FANTASY_POSITIONS } from "../../config/constants";
import { formatCurrency } from "../../utils/formatter";
import { logger } from "../../utils/logger";
import type { FantasyPosition } from "../../types/fantasy";

const POSITION_ORDER: FantasyPosition[] = ["GK", "DEF", "MID", "FWD"];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("team")
    .setDescription("View your GoalX fantasy team") as SlashCommandBuilder,
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

      const fields = POSITION_ORDER.map((position) => {
        const players = team.players.filter((p) => p.position === position);

        const value =
          players.length > 0
            ? players
                .map((p) => {
                  const tag = p.isCaptain ? " (C)" : p.isViceCaptain ? " (VC)" : "";
                  const starting = p.isStarting ? "" : " *(bench)*";
                  return `${p.name}${tag} — ${formatCurrency(p.price)}${starting}`;
                })
                .join("\n")
            : "*None selected*";

        return {
          name: `${FANTASY_POSITIONS[position]} (${players.length})`,
          value,
          inline: false,
        };
      });

      const embed = fantasyEmbed({
        title: `${EMOJIS.TROPHY} ${team.teamName}`,
        description: `Total Points: **${team.totalPoints}** • Gameweek ${team.currentGameweek}: **${team.gameweekPoints}**`,
        fields: [
          ...fields,
          {
            name: "Budget",
            value: `${formatCurrency(team.remainingBudget)} remaining of ${formatCurrency(team.budget)}`,
            inline: true,
          },
          { name: "Free Transfers", value: `${team.freeTransfers}`, inline: true },
          { name: "Status", value: team.isLocked ? `${EMOJIS.LOCK} Locked` : "🔓 Open", inline: true },
        ],
      });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(CUSTOM_IDS.FANTASY.TRANSFERS)
          .setLabel("Transfers")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(team.isLocked),
        new ButtonBuilder()
          .setCustomId(CUSTOM_IDS.FANTASY.CAPTAIN)
          .setLabel("Captain")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(CUSTOM_IDS.FANTASY.AI_SCOUT)
          .setLabel("AI Scout")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(CUSTOM_IDS.FANTASY.LEADERBOARD)
          .setLabel("Leaderboard")
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      logger.error("Error in /team command", { error, userId: interaction.user.id });

      const message = error instanceof Error ? error.message : "Failed to load your fantasy team.";
      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

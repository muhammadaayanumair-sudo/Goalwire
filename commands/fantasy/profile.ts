import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { fantasyService } from "../../services/fantasy/FantasyService";
import { rankingService, RankingError } from "../../services/fantasy/RankingService";
import { User } from "../../database/models/User";
import { errorEmbed, fantasyEmbed } from "../../utils/embeds";
import { EMOJIS } from "../../config/constants";
import { formatPoints, formatOrdinal, formatCurrency } from "../../utils/formatter";
import { logger } from "../../utils/logger";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View your GoalX fantasy profile")
    .addUserOption((option) =>
      option.setName("user").setDescription("View another user's profile").setRequired(false),
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

    const targetUser = interaction.options.getUser("user") ?? interaction.user;

    try {
      const [userProfile, team] = await Promise.all([
        User.findOne({ discordId: targetUser.id }),
        fantasyService.getTeam(targetUser.id, interaction.guildId),
      ]);

      if (!team) {
        const message =
          targetUser.id === interaction.user.id
            ? "You don't have a fantasy team yet. Use `/create` to get started."
            : `**${targetUser.username}** doesn't have a fantasy team in this server.`;

        await interaction.editReply({ embeds: [errorEmbed(message)] });
        return;
      }

      const userRank = await rankingService.getUserRank(targetUser.id, interaction.guildId);

      const predictionAccuracy =
        userProfile && userProfile.stats.predictionsMade > 0
          ? Math.round((userProfile.stats.predictionsCorrect / userProfile.stats.predictionsMade) * 100)
          : null;

      const embed = fantasyEmbed({
        title: `${EMOJIS.STAR} ${targetUser.username}'s GoalX Profile`,
        thumbnail: targetUser.displayAvatarURL(),
        fields: [
          { name: "Fantasy Team", value: team.teamName, inline: true },
          { name: "Total Points", value: formatPoints(team.totalPoints), inline: true },
          {
            name: "Server Rank",
            value: userRank ? `${formatOrdinal(userRank.rank)} of ${userRank.totalTeams}` : "Unranked",
            inline: true,
          },
          { name: "Squad Value", value: formatCurrency(team.budget - team.remainingBudget), inline: true },
          { name: "Free Transfers", value: `${team.freeTransfers}`, inline: true },
          {
            name: "Partner Status",
            value: userProfile?.isPartner ? `${EMOJIS.STAR} Partner` : "Standard",
            inline: true,
          },
          ...(predictionAccuracy !== null
            ? [
                {
                  name: "Prediction Accuracy",
                  value: `${predictionAccuracy}% (${userProfile!.stats.predictionsCorrect}/${userProfile!.stats.predictionsMade})`,
                  inline: true,
                },
                { name: "Best Streak", value: `${userProfile!.stats.bestStreak}`, inline: true },
              ]
            : []),
        ],
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error("Error in /profile command", { error, userId: targetUser.id });

      const message =
        error instanceof RankingError || error instanceof Error
          ? error.message
          : "Failed to load that profile.";

      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

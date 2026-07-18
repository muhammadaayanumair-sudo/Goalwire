import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economyService } from "../../services/economy/EconomyService";
import { User } from "../../database/models/User";
import { errorEmbed, fantasyEmbed } from "../../utils/embeds";
import { EMOJIS } from "../../config/constants";
import { logger } from "../../utils/logger";

function buildProgressBar(progress: number, length = 12): string {
  const filled = Math.round(Math.max(0, Math.min(1, progress)) * length);
  return "▰".repeat(filled) + "▱".repeat(length - filled);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("View your Market Value, tokens, and level progress")
    .addUserOption((option) =>
      option.setName("user").setDescription("View another user's wallet").setRequired(false),
    ) as SlashCommandBuilder,
  category: "economy",
  cooldown: 3,

  async execute(client, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser("user") ?? interaction.user;

    try {
      const userDoc = await User.findOne({ discordId: targetUser.id });

      if (!userDoc) {
        const message =
          targetUser.id === interaction.user.id
            ? "You don't have a GoalX profile yet. Use `/daily` or any command to get started."
            : `**${targetUser.username}** hasn't used GoalX yet.`;

        await interaction.editReply({ embeds: [errorEmbed(message)] });
        return;
      }

      const progress = economyService.getLevelProgress(userDoc.economy.marketValue);
      const tier = economyService.getMarketValueTier(userDoc.economy.marketValue);
      const pointsIntoLevel = userDoc.economy.marketValue - progress.currentThreshold;
      const pointsNeeded = progress.nextThreshold - progress.currentThreshold;

      const embed = fantasyEmbed({
        title: `${EMOJIS.STAR} ${targetUser.username}'s Wallet`,
        thumbnail: targetUser.displayAvatarURL(),
        description: `${tier.emoji} **${tier.name}**`,
        fields: [
          { name: "Level", value: `${progress.level}`, inline: true },
          { name: "Market Value", value: `${userDoc.economy.marketValue}`, inline: true },
          { name: "Tokens", value: `${userDoc.economy.tokens}`, inline: true },
          {
            name: `Progress to Level ${progress.level + 1}`,
            value: `${buildProgressBar(progress.progress)}\n${pointsIntoLevel} / ${pointsNeeded} MV`,
            inline: false,
          },
          {
            name: "Daily Streak",
            value: userDoc.economy.dailyStreak > 0 ? `🔥 ${userDoc.economy.dailyStreak} days` : "No active streak",
            inline: true,
          },
        ],
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error("Error in /wallet command", { error, userId: targetUser.id });
      await interaction.editReply({ embeds: [errorEmbed("Failed to load that wallet.")] });
    }
  },
};

export default command;

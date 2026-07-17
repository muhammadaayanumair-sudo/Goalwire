import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economyService, EconomyError } from "../../services/economy/EconomyService";
import { errorEmbed, successEmbed } from "../../utils/embeds";
import { EMOJIS } from "../../config/constants";
import { logger } from "../../utils/logger";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily Market Value and token reward") as SlashCommandBuilder,
  category: "economy",
  cooldown: 3,

  async execute(client, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const result = await economyService.claimDaily(interaction.user.id, interaction.user.username);

      const streakLine =
        result.streak > 1 ? `\n🔥 **${result.streak}-day streak!**` : "";
      const levelUpLine = result.leveledUp ? `\n${EMOJIS.STAR} You've reached **Level ${result.newLevel}**!` : "";

      await interaction.editReply({
        embeds: [
          successEmbed(
            `+${result.marketValueGained} Market Value\n+${result.tokensGained} Tokens${streakLine}${levelUpLine}`,
            "Daily Reward Claimed",
          ),
        ],
      });
    } catch (error) {
      logger.error("Error in /daily command", { error, userId: interaction.user.id });

      const message = error instanceof EconomyError ? error.message : "Failed to claim your daily reward.";
      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },
};

export default command;

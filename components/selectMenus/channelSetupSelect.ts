import { AnySelectMenuInteraction, ChannelSelectMenuInteraction, PermissionFlagsBits } from "discord.js";
import type { GoalXClient } from "../../client/GoalXClient";
import type { SelectMenuComponent } from "../../types/discord";
import { Server } from "../../database/models/Server";
import { errorEmbed, successEmbed } from "../../utils/embeds";
import { logger } from "../../utils/logger";

const VALID_CHANNEL_KEYS = ["live", "goals", "news", "transfers", "announcements", "fantasyUpdates"] as const;
type ChannelKey = (typeof VALID_CHANNEL_KEYS)[number];

async function handleChannelSetupSelect(
  client: GoalXClient,
  interaction: AnySelectMenuInteraction,
): Promise<void> {
  const select = interaction as ChannelSelectMenuInteraction;

  if (!select.guildId || !select.member) {
    await select.reply({ embeds: [errorEmbed("This can only be used inside a server.")], ephemeral: true });
    return;
  }

  const memberPermissions = select.memberPermissions;
  if (!memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await select.reply({
      embeds: [errorEmbed("You need Administrator permission to change GoalX's configuration.")],
      ephemeral: true,
    });
    return;
  }

  const channelKey = select.customId.replace("setup_channel_", "") as ChannelKey;

  if (!VALID_CHANNEL_KEYS.includes(channelKey)) {
    await select.reply({ embeds: [errorEmbed("Unknown configuration option.")], ephemeral: true });
    return;
  }

  await select.deferReply({ ephemeral: true });

  try {
    const selectedChannelId = select.values[0] ?? null;

    await Server.findOneAndUpdate(
      { guildId: select.guildId },
      {
        $setOnInsert: {
          guildId: select.guildId,
          guildName: select.guild?.name ?? "Unknown Server",
        },
        $set: { [`channels.${channelKey}`]: selectedChannelId },
      },
      { upsert: true, new: true },
    );

    const confirmationText = selectedChannelId
      ? `Updates for **${channelKey}** will now post to <#${selectedChannelId}>.`
      : `**${channelKey}** channel has been cleared — this feature is now disabled for this server.`;

    await select.editReply({
      embeds: [successEmbed(confirmationText, "Channel Configured")],
    });

    logger.info("Server channel configuration updated", {
      guildId: select.guildId,
      channelKey,
      selectedChannelId,
    });
  } catch (error) {
    logger.error("Error updating channel configuration", { error, guildId: select.guildId, channelKey });
    await select.editReply({ embeds: [errorEmbed("Failed to save that channel configuration.")] });
  }
}

const channelSetupSelect: SelectMenuComponent[] = VALID_CHANNEL_KEYS.map((key) => ({
  customId: `setup_channel_${key}`,
  execute: handleChannelSetupSelect,
}));

export default channelSetupSelect;

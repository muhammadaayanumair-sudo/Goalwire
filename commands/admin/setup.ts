import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";
import type { Command } from "../../types/discord";
import { Server } from "../../database/models/Server";
import { errorEmbed, successEmbed, fantasyEmbed } from "../../utils/embeds";
import { EMOJIS } from "../../config/constants";
import { logger } from "../../utils/logger";

type ChannelKey = "live" | "goals" | "news" | "transfers" | "announcements" | "fantasyUpdates";

const CHANNEL_PURPOSES: { key: ChannelKey; label: string; description: string }[] = [
  { key: "live", label: "Live Match Updates", description: "Goals, cards, kickoff/half-time/full-time" },
  { key: "goals", label: "Goal Alerts", description: "Goal-only alerts (falls back to Live if unset)" },
  { key: "news", label: "Football News", description: "Breaking news and articles" },
  { key: "transfers", label: "Transfer News", description: "Transfer announcements" },
  { key: "announcements", label: "Bot Announcements", description: "GoalX server-wide announcements" },
  { key: "fantasyUpdates", label: "Fantasy Updates", description: "Gameweek deadlines, points processed" },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure GoalX for this server (admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName("channels").setDescription("Configure which channels GoalX posts updates to"),
    )
    .addSubcommand((sub) =>
      sub.setName("roles").setDescription("Configure GoalX-related server roles"),
    )
    .addSubcommand((sub) =>
      sub.setName("notifications").setDescription("Configure which auto-post notifications are enabled"),
    )
    .addSubcommand((sub) =>
      sub.setName("view").setDescription("View current GoalX configuration for this server"),
    ) as SlashCommandBuilder,
  category: "admin",
  cooldown: 5,
  permissions: [PermissionFlagsBits.Administrator],

  async execute(client, interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    if (!interaction.guildId || !interaction.guild) {
      await interaction.editReply({
        embeds: [errorEmbed("This command can only be used inside a server.")],
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "channels":
          await handleChannelsSetup(interaction);
          break;
        case "roles":
          await handleRolesSetup(interaction);
          break;
        case "notifications":
          await handleNotificationsSetup(interaction);
          break;
        case "view":
          await handleView(interaction);
          break;
      }
    } catch (error) {
      logger.error("Error in /setup command", { error, subcommand, guildId: interaction.guildId });
      await interaction.editReply({ embeds: [errorEmbed("Failed to process setup. Please try again.")] });
    }
  },
};

async function handleChannelsSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = fantasyEmbed({
    title: `${EMOJIS.FOOTBALL} Configure Channels`,
    description: "Select a channel for each purpose below. Leave any unselected to disable that feature.",
    fields: CHANNEL_PURPOSES.map((p) => ({ name: p.label, value: p.description, inline: false })),
  });

  const firstBatch = CHANNEL_PURPOSES.slice(0, 5);
  const secondBatch = CHANNEL_PURPOSES.slice(5);

  const buildRow = (purpose: (typeof CHANNEL_PURPOSES)[number]) =>
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`setup_channel_${purpose.key}`)
        .setPlaceholder(`${purpose.label} channel`)
        .setChannelTypes(ChannelType.GuildText)
        .setMinValues(0)
        .setMaxValues(1),
    );

  await interaction.editReply({
    embeds: [embed],
    components: firstBatch.map(buildRow),
  });

  if (secondBatch.length > 0) {
    await interaction.followUp({
      embeds: [
        fantasyEmbed({
          title: "Configure Channels (continued)",
          description: "Remaining channel purposes:",
        }),
      ],
      components: secondBatch.map(buildRow),
    });
  }
}

async function handleRolesSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.editReply({
    embeds: [
      fantasyEmbed({
        title: `${EMOJIS.STAR} Role Configuration`,
        description: "Role setup (partner role, ping roles) is coming soon.",
      }),
    ],
  });
}

async function handleNotificationsSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.editReply({
    embeds: [
      fantasyEmbed({
        title: `${EMOJIS.CHECK} Notification Settings`,
        description: "Fine-grained notification toggles are coming soon. Channel configuration in `/setup channels` already controls what's active.",
      }),
    ],
  });
}

async function handleView(interaction: ChatInputCommandInteraction): Promise<void> {
  const server = await Server.findOne({ guildId: interaction.guildId! });

  if (!server) {
    await interaction.editReply({
      embeds: [
        errorEmbed("GoalX hasn't been configured for this server yet. Run `/setup channels` to get started."),
      ],
    });
    return;
  }

  const fields = CHANNEL_PURPOSES.map((p) => {
    const channelId = server.channels[p.key];
    return {
      name: p.label,
      value: channelId ? `<#${channelId}>` : "*Not set*",
      inline: true,
    };
  });

  await interaction.editReply({
    embeds: [
      fantasyEmbed({
        title: `${EMOJIS.FOOTBALL} GoalX Configuration — ${interaction.guild!.name}`,
        fields: [
          ...fields,
          { name: "Fantasy Enabled", value: server.fantasyEnabled ? "✅ Yes" : "❌ No", inline: true },
          { name: "Partner Server", value: server.isPartner ? "⭐ Yes" : "No", inline: true },
        ],
      }),
    ],
  });
}

export default command;

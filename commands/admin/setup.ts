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
import { errorEmbed, fantasyEmbed } from "../../utils/embeds";
import { EMOJIS, LEAGUE_IDS } from "../../config/constants";
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

const SETUP_LEAGUE_CHOICES = [
  { name: "Premier League", value: LEAGUE_IDS.PREMIER_LEAGUE },
  { name: "La Liga", value: LEAGUE_IDS.LA_LIGA },
  { name: "Bundesliga", value: LEAGUE_IDS.BUNDESLIGA },
  { name: "Serie A", value: LEAGUE_IDS.SERIE_A },
  { name: "Ligue 1", value: LEAGUE_IDS.LIGUE_1 },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure GoalX for this server (admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName("channels").setDescription("Configure which channels GoalX posts updates to"),
    )
    .addSubcommandGroup((group) =>
      group
        .setName("roles")
        .setDescription("Configure self-assign league/club roles")
        .addSubcommand((sub) =>
          sub
            .setName("league")
            .setDescription("Link a Discord role to a league for self-assignment")
            .addIntegerOption((option) =>
              option
                .setName("league")
                .setDescription("Which league")
                .setRequired(true)
                .addChoices(...SETUP_LEAGUE_CHOICES),
            )
            .addRoleOption((option) =>
              option.setName("role").setDescription("The role to assign for this league").setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("club")
            .setDescription("Link a Discord role to a club for self-assignment")
            .addStringOption((option) =>
              option.setName("club_name").setDescription("Club name (e.g. Arsenal)").setRequired(true),
            )
            .addIntegerOption((option) =>
              option.setName("club_id").setDescription("API-Football team ID for this club").setRequired(true),
            )
            .addRoleOption((option) =>
              option.setName("role").setDescription("The role to assign for this club").setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub.setName("publish").setDescription("Post/update the self-assign role picker in a channel"),
        ),
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

    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    try {
      if (group === "roles") {
        switch (subcommand) {
          case "league":
            await handleAddLeagueRole(interaction);
            break;
          case "club":
            await handleAddClubRole(interaction);
            break;
          case "publish":
            await handlePublishRolePicker(interaction);
            break;
        }
        return;
      }

      switch (subcommand) {
        case "channels":
          await handleChannelsSetup(interaction);
          break;
        case "notifications":
          await handleNotificationsSetup(interaction);
          break;
        case "view":
          await handleView(interaction);
          break;
      }
    } catch (error) {
      logger.error("Error in /setup command", { error, group, subcommand, guildId: interaction.guildId });
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

async function handleAddLeagueRole(interaction: ChatInputCommandInteraction): Promise<void> {
  const leagueId = interaction.options.getInteger("league", true);
  const role = interaction.options.getRole("role", true);
  const leagueName = SETUP_LEAGUE_CHOICES.find((l) => l.value === leagueId)?.name ?? "Unknown League";

  const server = await Server.findOneAndUpdate(
    { guildId: interaction.guildId! },
    {
      $setOnInsert: { guildId: interaction.guildId!, guildName: interaction.guild!.name },
      $pull: { leagueRoles: { leagueId } },
    },
    { upsert: true, new: true },
  );

  server.leagueRoles.push({ leagueId, leagueName, roleId: role.id });
  await server.save();

  await interaction.editReply({
    embeds: [
      fantasyEmbed({
        title: `${EMOJIS.CHECK} League Role Linked`,
        description: `**${leagueName}** is now linked to <@&${role.id}>. Run \`/setup roles publish\` in your target channel to post the picker.`,
      }),
    ],
  });
}

async function handleAddClubRole(interaction: ChatInputCommandInteraction): Promise<void> {
  const clubName = interaction.options.getString("club_name", true).trim();
  const clubId = interaction.options.getInteger("club_id", true);
  const role = interaction.options.getRole("role", true);

  const server = await Server.findOneAndUpdate(
    { guildId: interaction.guildId! },
    {
      $setOnInsert: { guildId: interaction.guildId!, guildName: interaction.guild!.name },
      $pull: { clubRoles: { clubId } },
    },
    { upsert: true, new: true },
  );

  server.clubRoles.push({ clubId, clubName, roleId: role.id });
  await server.save();

  await interaction.editReply({
    embeds: [
      fantasyEmbed({
        title: `${EMOJIS.CHECK} Club Role Linked`,
        description: `**${clubName}** is now linked to <@&${role.id}>. Run \`/setup roles publish\` in your target channel to post the picker.`,
      }),
    ],
  });
}

async function handlePublishRolePicker(interaction: ChatInputCommandInteraction): Promise<void> {
  const server = await Server.findOne({ guildId: interaction.guildId! });

  if (!server || (server.leagueRoles.length === 0 && server.clubRoles.length === 0)) {
    await interaction.editReply({
      embeds: [
        errorEmbed(
          "No roles linked yet. Use `/setup roles league` and `/setup roles club` to link roles first.",
        ),
      ],
    });
    return;
  }

  const { buildRolePickerComponents } = await import("../../components/buttons/rolePickerButtons");
  const { embed, components } = buildRolePickerComponents(server);

  const message = await interaction.editReply({ embeds: [embed], components });

  server.selfAssignMessageIds = {
    ...server.selfAssignMessageIds,
    league: server.leagueRoles.length > 0 ? message.id : server.selfAssignMessageIds?.league,
    club: server.clubRoles.length > 0 ? message.id : server.selfAssignMessageIds?.club,
  };
  await server.save();
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

  const roleSummary = [
    `**League roles:** ${server.leagueRoles.length > 0 ? server.leagueRoles.map((r) => r.leagueName).join(", ") : "*None linked*"}`,
    `**Club roles:** ${server.clubRoles.length > 0 ? server.clubRoles.map((r) => r.clubName).join(", ") : "*None linked*"}`,
  ].join("\n");

  await interaction.editReply({
    embeds: [
      fantasyEmbed({
        title: `${EMOJIS.FOOTBALL} GoalX Configuration — ${interaction.guild!.name}`,
        fields: [
          ...fields,
          { name: "Fantasy Enabled", value: server.fantasyEnabled ? "✅ Yes" : "❌ No", inline: true },
          { name: "Partner Server", value: server.isPartner ? "⭐ Yes" : "No", inline: true },
          { name: "Self-Assign Roles", value: roleSummary, inline: false },
        ],
      }),
    ],
  });
}

export default command;

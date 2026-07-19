import {
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  PermissionFlagsBits,
} from "discord.js";
import type { GoalXClient } from "../../client/GoalXClient";
import type { ButtonComponent } from "../../types/discord";
import { IServer } from "../../database/models/Server";
import { fantasyEmbed, errorEmbed, dividerField } from "../../utils/embeds";
import { EMOJIS } from "../../config/constants";
import { logger } from "../../utils/logger";

const MAX_BUTTONS_PER_ROW = 5;
const MAX_ROWS = 5;

export function buildRolePickerComponents(server: IServer): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const fields: { name: string; value: string; inline?: boolean }[] = [];
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  if (server.leagueRoles.length > 0) {
    fields.push({
      name: `${EMOJIS.TROPHY} Favorite League`,
      value: "Tap a button below to get pinged for your league. Tap again to remove it.",
      inline: false,
    });

    const leagueButtons = server.leagueRoles.slice(0, MAX_BUTTONS_PER_ROW * 2).map((mapping) =>
      new ButtonBuilder()
        .setCustomId(`role_toggle_league_${mapping.roleId}`)
        .setLabel(mapping.leagueName)
        .setStyle(ButtonStyle.Primary),
    );

    for (let i = 0; i < leagueButtons.length; i += MAX_BUTTONS_PER_ROW) {
      rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(leagueButtons.slice(i, i + MAX_BUTTONS_PER_ROW)));
    }
  }

  if (server.clubRoles.length > 0 && rows.length < MAX_ROWS) {
    fields.push(dividerField());
    fields.push({
      name: `${EMOJIS.STAR} Favorite Club`,
      value: "Tap a button below to rep your club's colours. Tap again to remove it.",
      inline: false,
    });

    const remainingRows = MAX_ROWS - rows.length;
    const clubButtons = server.clubRoles
      .slice(0, MAX_BUTTONS_PER_ROW * remainingRows)
      .map((mapping) =>
        new ButtonBuilder()
          .setCustomId(`role_toggle_club_${mapping.roleId}`)
          .setLabel(mapping.clubName)
          .setStyle(ButtonStyle.Secondary),
      );

    for (let i = 0; i < clubButtons.length; i += MAX_BUTTONS_PER_ROW) {
      if (rows.length >= MAX_ROWS) break;
      rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(clubButtons.slice(i, i + MAX_BUTTONS_PER_ROW)));
    }
  }

  const embed = fantasyEmbed({
    title: `${EMOJIS.FOOTBALL} Choose Your Colours`,
    description: "Self-assign roles below — no admin needed. You can pick more than one.",
    fields,
  });

  return { embed, components: rows };
}

async function handleRoleToggle(client: GoalXClient, interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !(interaction.member instanceof GuildMember)) {
    await interaction.reply({ embeds: [errorEmbed("This can only be used inside a server.")], ephemeral: true });
    return;
  }

  const roleId = interaction.customId.replace(/^role_toggle_(league|club)_/, "");
  const role = interaction.guild.roles.cache.get(roleId);

  if (!role) {
    await interaction.reply({
      embeds: [errorEmbed("That role no longer exists on this server. An admin may need to re-link it.")],
      ephemeral: true,
    });
    return;
  }

  const botMember = interaction.guild.members.me;

  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      embeds: [errorEmbed("GoalX doesn't have the Manage Roles permission on this server. Ask an admin to grant it.")],
      ephemeral: true,
    });
    return;
  }

  // Discord's real hierarchy rule: a bot can only manage roles strictly
  // below its own highest role. If an admin linked a role positioned
  // above GoalX's bot role, the API call will fail — surface that clearly
  // rather than let it throw an opaque error.
  if (role.position >= botMember.roles.highest.position) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          `GoalX can't assign **${role.name}** because it's positioned above GoalX's own role in this server's role list. An admin needs to move GoalX's role above it in Server Settings → Roles.`,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const member = interaction.member;
    const hasRole = member.roles.cache.has(roleId);

    if (hasRole) {
      await member.roles.remove(role);
      await interaction.editReply({
        embeds: [fantasyEmbed({ title: `${EMOJIS.CHECK} Role Removed`, description: `Removed **${role.name}**.` })],
      });
    } else {
      await member.roles.add(role);
      await interaction.editReply({
        embeds: [fantasyEmbed({ title: `${EMOJIS.CHECK} Role Added`, description: `You now have **${role.name}**!` })],
      });
    }
  } catch (error) {
    logger.error("Failed to toggle self-assign role", { error, guildId: interaction.guildId, roleId });
    await interaction.editReply({
      embeds: [errorEmbed("Failed to update your role. GoalX may be missing permissions for this specific role.")],
    });
  }
}

const rolePickerButtons: ButtonComponent[] = [
  { customId: "role_toggle_league", execute: handleRoleToggle },
  { customId: "role_toggle_club", execute: handleRoleToggle },
];

export default rolePickerButtons;

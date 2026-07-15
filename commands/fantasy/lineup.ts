import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { Command } from "../../types/discord";
import { fantasyService } from "../../services/fantasy/FantasyService";
import { errorEmbed, fantasyEmbed, warningEmbed } from "../../utils/embeds";
import { CUSTOM_IDS, EMOJIS } from "../../config/constants";
import { formatCurrency } from "../../utils/formatter";
import { logger } from "../../utils/logger";
import type { FantasyPosition } from "../../types/fantasy";
import type { IFantasyPlayer } from "../../database/models/FantasyTeam";

interface FormationRule {
  label: string;
  GK: number;
  DEF: number;
  MID: number;
  FWD: number;
}

const VALID_FORMATIONS: FormationRule[] = [
  { label: "3-4-3", GK: 1, DEF: 3, MID: 4, FWD: 3 },
  { label: "3-5-2", GK: 1, DEF: 3, MID: 5, FWD: 2 },
  { label: "4-3-3", GK: 1, DEF: 4, MID: 3, FWD: 3 },
  { label: "4-4-2", GK: 1, DEF: 4, MID: 4, FWD: 2 },
  { label: "4-5-1", GK: 1, DEF: 4, MID: 5, FWD: 1 },
  { label: "5-3-2", GK: 1, DEF: 5, MID: 3, FWD: 2 },
  { label: "5-4-1", GK: 1, DEF: 5, MID: 4, FWD: 1 },
];

const POSITION_SELECT_LIMITS: Record<FantasyPosition, { min: number; max: number }> = {
  GK: { min: 1, max: 1 },
  DEF: { min: 3, max: 5 },
  MID: { min: 2, max: 5 },
  FWD: { min: 1, max: 3 },
};

const MIN_SQUAD_SIZE = 11;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("lineup")
    .setDescription("Set your starting XI for the upcoming gameweek")
    .addBooleanOption((option) =>
      option
        .setName("autopick")
        .setDescription("Auto-pick your strongest valid XI based on form and price")
        .setRequired(false),
    ) as SlashCommandBuilder,
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

      if (team.isLocked) {
        await interaction.editReply({
          embeds: [errorEmbed("Your lineup is locked for this gameweek.")],
        });
        return;
      }

      if (team.players.length < MIN_SQUAD_SIZE) {
        await interaction.editReply({
          embeds: [
            errorEmbed(
              `You need at least ${MIN_SQUAD_SIZE} players in your squad to set a lineup. You currently have ${team.players.length}.`,
            ),
          ],
        });
        return;
      }

      const autopick = interaction.options.getBoolean("autopick") ?? false;

      const workingPlayers: IFantasyPlayer[] = autopick
        ? this.autoPickStartingXI(team.players)
        : team.players;

      if (autopick) {
        await fantasyService.setStartingLineup(
          interaction.user.id,
          interaction.guildId,
          workingPlayers.filter((p) => p.isStarting).map((p) => p.playerId),
        );
      }

      const grouped = this.groupByPosition(workingPlayers);
      const validation = this.validateFormation(workingPlayers);

      const embed = this.buildLineupEmbed(team.teamName, workingPlayers, grouped, validation, autopick);
      const rows = this.buildPositionSelectRows(grouped);

      const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_IDS.FANTASY.CAPTAIN}_lineup`)
          .setLabel("Set Captain")
          .setEmoji(EMOJIS.CROWN)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("lineup_confirm")
          .setLabel("Confirm Lineup")
          .setEmoji(EMOJIS.CHECK)
          .setStyle(ButtonStyle.Success)
          .setDisabled(!validation.isValid),
        new ButtonBuilder()
          .setCustomId("lineup_autopick")
          .setLabel("Auto-Pick Best XI")
          .setEmoji("🧠")
          .setStyle(ButtonStyle.Primary),
      );

      await interaction.editReply({
        embeds: [embed],
        components: [...rows, controlRow],
      });
    } catch (error) {
      logger.error("Error in /lineup command", { error, userId: interaction.user.id });

      const message = error instanceof Error ? error.message : "Failed to load your lineup.";
      await interaction.editReply({ embeds: [errorEmbed(message)] });
    }
  },

  groupByPosition(players: IFantasyPlayer[]): Record<FantasyPosition, IFantasyPlayer[]> {
    return {
      GK: players.filter((p) => p.position === "GK"),
      DEF: players.filter((p) => p.position === "DEF"),
      MID: players.filter((p) => p.position === "MID"),
      FWD: players.filter((p) => p.position === "FWD"),
    };
  },

  validateFormation(players: IFantasyPlayer[]): {
    isValid: boolean;
    formation: string | null;
    issues: string[];
    startingCount: number;
  } {
    const starting = players.filter((p) => p.isStarting);
    const issues: string[] = [];

    const counts: Record<FantasyPosition, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const player of starting) counts[player.position]++;

    if (starting.length !== MIN_SQUAD_SIZE) {
      issues.push(`Starting XI must have exactly ${MIN_SQUAD_SIZE} players (currently ${starting.length}).`);
    }

    for (const position of Object.keys(POSITION_SELECT_LIMITS) as FantasyPosition[]) {
      const { min, max } = POSITION_SELECT_LIMITS[position];
      if (counts[position] < min || counts[position] > max) {
        issues.push(`${position} count (${counts[position]}) must be between ${min} and ${max}.`);
      }
    }

    const matchedFormation = VALID_FORMATIONS.find(
      (f) => f.GK === counts.GK && f.DEF === counts.DEF && f.MID === counts.MID && f.FWD === counts.FWD,
    );

    return {
      isValid: issues.length === 0 && Boolean(matchedFormation),
      formation: matchedFormation?.label ?? null,
      issues,
      startingCount: starting.length,
    };
  },

  autoPickStartingXI(players: IFantasyPlayer[]): IFantasyPlayer[] {
    const clone = players.map((p) => ({ ...p, isStarting: false }));
    const byPosition = this.groupByPosition(clone as IFantasyPlayer[]);

    const sortByValue = (list: IFantasyPlayer[]) => [...list].sort((a, b) => b.price - a.price);

    const gk = sortByValue(byPosition.GK).slice(0, 1);
    let def = sortByValue(byPosition.DEF).slice(0, 4);
    let mid = sortByValue(byPosition.MID).slice(0, 4);
    let fwd = sortByValue(byPosition.FWD).slice(0, 2);

    let total = gk.length + def.length + mid.length + fwd.length;

    while (total < MIN_SQUAD_SIZE) {
      const extraDef = sortByValue(byPosition.DEF)[def.length];
      const extraMid = sortByValue(byPosition.MID)[mid.length];
      const extraFwd = sortByValue(byPosition.FWD)[fwd.length];

      if (extraMid && mid.length < POSITION_SELECT_LIMITS.MID.max) {
        mid.push(extraMid);
      } else if (extraDef && def.length < POSITION_SELECT_LIMITS.DEF.max) {
        def.push(extraDef);
      } else if (extraFwd && fwd.length < POSITION_SELECT_LIMITS.FWD.max) {
        fwd.push(extraFwd);
      } else {
        break;
      }

      total = gk.length + def.length + mid.length + fwd.length;
    }

    const startingIds = new Set([...gk, ...def, ...mid, ...fwd].map((p) => p.playerId));

    return clone.map((p) => ({ ...p, isStarting: startingIds.has(p.playerId) })) as IFantasyPlayer[];
  },

  buildLineupEmbed(
    teamName: string,
    players: IFantasyPlayer[],
    grouped: Record<FantasyPosition, IFantasyPlayer[]>,
    validation: ReturnType<typeof this.validateFormation>,
    autopicked: boolean,
  ) {
    const positionOrder: FantasyPosition[] = ["GK", "DEF", "MID", "FWD"];

    const fields = positionOrder.map((position) => {
      const list = grouped[position];
      const value =
        list.length > 0
          ? list
              .map((p) => {
                const marker = p.isStarting ? "🟢" : "⚪";
                const tag = p.isCaptain ? " (C)" : p.isViceCaptain ? " (VC)" : "";
                return `${marker} ${p.name}${tag} — ${formatCurrency(p.price)}`;
              })
              .join("\n")
          : "*None*";

      return { name: `${position} (${list.filter((p) => p.isStarting).length}/${list.length})`, value, inline: false };
    });

    const statusLine = validation.isValid
      ? `${EMOJIS.CHECK} Valid formation: **${validation.formation}**`
      : `${EMOJIS.WARNING} ${validation.issues.join(" ")}`;

    return fantasyEmbed({
      title: `${EMOJIS.FOOTBALL} ${teamName} — Lineup Builder`,
      description: `${autopicked ? "Auto-picked your strongest available XI.\n\n" : ""}${statusLine}`,
      fields,
      footerText: "🟢 Starting  •  ⚪ Bench  •  Use the menus below to adjust each position",
    });
  },

  buildPositionSelectRows(
    grouped: Record<FantasyPosition, IFantasyPlayer[]>,
  ): ActionRowBuilder<StringSelectMenuBuilder>[] {
    const positionOrder: FantasyPosition[] = ["GK", "DEF", "MID", "FWD"];

    return positionOrder
      .filter((position) => grouped[position].length > 0)
      .map((position) => {
        const list = grouped[position];
        const limits = POSITION_SELECT_LIMITS[position];
        const maxSelectable = Math.min(limits.max, list.length);

        const options = list.slice(0, 25).map((p) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${p.name}`)
            .setDescription(`${formatCurrency(p.price)} • ${p.teamName}`)
            .setValue(String(p.playerId))
            .setDefault(p.isStarting),
        );

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`${CUSTOM_IDS.SELECT.PLAYER}_${position.toLowerCase()}`)
          .setPlaceholder(`Select starting ${position} (${limits.min}-${maxSelectable})`)
          .setMinValues(Math.min(limits.min, list.length))
          .setMaxValues(maxSelectable)
          .addOptions(options);

        return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      });
  },
};

export default command;

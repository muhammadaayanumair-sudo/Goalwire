import { EmbedBuilder, ColorResolvable } from "discord.js";
import { COLORS } from "../config/colors";
import { EMBED_LIMITS, EMOJIS } from "../config/constants";

interface BaseEmbedOptions {
  title?: string;
  description?: string;
  color?: number;
  thumbnail?: string;
  image?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  footerText?: string;
  footerIcon?: string;
  timestamp?: boolean;
  author?: { name: string; iconURL?: string };
  url?: string;
}

const DEFAULT_FOOTER = "GoalX • Fantasy Football Assistant";

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

export function buildEmbed(options: BaseEmbedOptions): EmbedBuilder {
  const embed = new EmbedBuilder().setColor((options.color ?? COLORS.PRIMARY) as ColorResolvable);

  if (options.title) embed.setTitle(truncate(options.title, EMBED_LIMITS.TITLE_MAX_LENGTH));
  if (options.description) {
    embed.setDescription(truncate(options.description, EMBED_LIMITS.DESCRIPTION_MAX_LENGTH));
  }
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);
  if (options.author) embed.setAuthor(options.author);
  if (options.url) embed.setURL(options.url);

  if (options.fields?.length) {
    embed.addFields(
      options.fields.slice(0, EMBED_LIMITS.MAX_FIELDS).map((field) => ({
        name: truncate(field.name, EMBED_LIMITS.FIELD_NAME_MAX_LENGTH),
        value: truncate(field.value, EMBED_LIMITS.FIELD_VALUE_MAX_LENGTH),
        inline: field.inline ?? false,
      })),
    );
  }

  embed.setFooter({
    text: truncate(options.footerText ?? DEFAULT_FOOTER, EMBED_LIMITS.FOOTER_MAX_LENGTH),
    iconURL: options.footerIcon,
  });

  if (options.timestamp !== false) embed.setTimestamp();

  return embed;
}

export function successEmbed(description: string, title = "Success"): EmbedBuilder {
  return buildEmbed({ title: `✅ ${title}`, description, color: COLORS.SUCCESS });
}

export function errorEmbed(description: string, title = "Error"): EmbedBuilder {
  return buildEmbed({ title: `❌ ${title}`, description, color: COLORS.ERROR });
}

export function warningEmbed(description: string, title = "Warning"): EmbedBuilder {
  return buildEmbed({ title: `⚠️ ${title}`, description, color: COLORS.WARNING });
}

export function loadingEmbed(description = "Fetching data..."): EmbedBuilder {
  return buildEmbed({ title: "⏳ Loading", description, color: COLORS.LOADING, timestamp: false });
}

export function fantasyEmbed(options: BaseEmbedOptions): EmbedBuilder {
  return buildEmbed({ ...options, color: options.color ?? COLORS.FANTASY });
}

export function liveEmbed(options: BaseEmbedOptions): EmbedBuilder {
  return buildEmbed({ ...options, color: options.color ?? COLORS.LIVE });
}

export function aiEmbed(options: BaseEmbedOptions): EmbedBuilder {
  return buildEmbed({ ...options, color: options.color ?? COLORS.AI });
}

export function newsEmbed(options: BaseEmbedOptions): EmbedBuilder {
  return buildEmbed({ ...options, color: options.color ?? COLORS.NEWS });
}

export function partnerEmbed(options: BaseEmbedOptions): EmbedBuilder {
  return buildEmbed({ ...options, color: options.color ?? COLORS.PARTNER });
}

export function announcementEmbed(options: BaseEmbedOptions & { emoji?: string }): EmbedBuilder {
  const emoji = options.emoji ?? "🎉";
  return buildEmbed({
    ...options,
    title: options.title ? `${emoji} ${options.title}` : undefined,
    color: options.color ?? COLORS.SUCCESS,
  });
}

interface GoalScorer {
  minute: string;
  player: string;
  team: string;
  assist?: string;
  isPenalty?: boolean;
  isOwnGoal?: boolean;
}

interface MatchEventBase {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  competition: string;
}

/** ⚽ Goal notification — fired the moment a goal event comes through the live poller. */
export function goalEmbed(
  options: MatchEventBase & {
    scorerName: string;
    scorerTeam: string;
    minute: string;
    assistName?: string;
    isPenalty?: boolean;
    isOwnGoal?: boolean;
  },
): EmbedBuilder {
  const { scorerName, scorerTeam, minute, assistName, isPenalty, isOwnGoal, ...match } = options;

  const goalTag = isOwnGoal ? " (Own Goal)" : isPenalty ? " (Penalty)" : "";
  const assistLine = assistName ? `\nAssist: **${assistName}**` : "";

  return buildEmbed({
    title: `${EMOJIS.GOAL} GOAL! ${scorerTeam}`,
    description: [
      `**${scorerName}**${goalTag} scores at \`${minute}\`${assistLine}`,
      "",
      `**${match.homeTeam}** \`${match.homeScore}\` - \`${match.awayScore}\` **${match.awayTeam}**`,
    ].join("\n"),
    color: COLORS.GOAL,
    footerText: `${match.competition} • GoalX Live`,
  });
}

/** 🟨🟥 Card notification. */
export function cardEmbed(
  options: MatchEventBase & {
    playerName: string;
    playerTeam: string;
    minute: string;
    cardType: "yellow" | "red" | "second_yellow";
  },
): EmbedBuilder {
  const { playerName, playerTeam, minute, cardType, ...match } = options;

  const cardLabel =
    cardType === "yellow" ? `${EMOJIS.CARD_YELLOW} Yellow Card` : cardType === "second_yellow" ? `${EMOJIS.CARD_YELLOW}${EMOJIS.CARD_YELLOW} Second Yellow — Sent Off` : `${EMOJIS.CARD_RED} Red Card`;

  return buildEmbed({
    title: cardLabel,
    description: [
      `**${playerName}** (${playerTeam}) at \`${minute}\``,
      "",
      `**${match.homeTeam}** \`${match.homeScore}\` - \`${match.awayScore}\` **${match.awayTeam}**`,
    ].join("\n"),
    color: cardType === "yellow" ? COLORS.YELLOW_CARD : COLORS.RED_CARD,
    footerText: `${match.competition} • GoalX Live`,
  });
}

/** 🔁 Substitution notification. */
export function substitutionEmbed(
  options: MatchEventBase & {
    playerOut: string;
    playerIn: string;
    team: string;
    minute: string;
  },
): EmbedBuilder {
  const { playerOut, playerIn, team, minute, ...match } = options;

  return buildEmbed({
    title: `${EMOJIS.SUBSTITUTION} Substitution — ${team}`,
    description: [
      `\`${minute}\` **${playerIn}** replaces **${playerOut}**`,
      "",
      `**${match.homeTeam}** \`${match.homeScore}\` - \`${match.awayScore}\` **${match.awayTeam}**`,
    ].join("\n"),
    color: COLORS.INFO,
    footerText: `${match.competition} • GoalX Live`,
  });
}

/** 🩹 Injury / VAR review notification. */
export function matchAlertEmbed(
  options: MatchEventBase & {
    alertType: "injury" | "var" | "penalty_awarded" | "penalty_missed";
    detail: string;
    minute: string;
  },
): EmbedBuilder {
  const { alertType, detail, minute, ...match } = options;

  const titleMap: Record<typeof alertType, string> = {
    injury: `${EMOJIS.INJURY} Injury Stoppage`,
    var: "📺 VAR Review",
    penalty_awarded: "⚽ Penalty Awarded",
    penalty_missed: "❌ Penalty Missed",
  };

  return buildEmbed({
    title: titleMap[alertType],
    description: [
      `\`${minute}\` ${detail}`,
      "",
      `**${match.homeTeam}** \`${match.homeScore}\` - \`${match.awayScore}\` **${match.awayTeam}**`,
    ].join("\n"),
    color: COLORS.WARNING,
    footerText: `${match.competition} • GoalX Live`,
  });
}

/** 🏁 Kickoff / Half-time / Full-time status embeds, with full goal-scorer breakdown. */
export function matchStatusEmbed(
  options: MatchEventBase & {
    status: "kickoff" | "halftime" | "fulltime";
    goalScorers?: GoalScorer[];
    venue?: string;
  },
): EmbedBuilder {
  const { status, goalScorers, venue, ...match } = options;

  const titleMap: Record<typeof status, string> = {
    kickoff: `${EMOJIS.FOOTBALL} KICK-OFF!`,
    halftime: "⏸️ HALF-TIME",
    fulltime: "🔴 FULL-TIME",
  };

  const fields: { name: string; value: string; inline?: boolean }[] = [];

  if (goalScorers && goalScorers.length > 0) {
    fields.push({
      name: `${EMOJIS.GOAL} Goals`,
      value: goalScorers
        .map((g) => {
          const tag = g.isOwnGoal ? " (OG)" : g.isPenalty ? " (P)" : "";
          const assist = g.assist ? ` — assist: ${g.assist}` : "";
          return `\`${g.minute}\` **${g.player}**${tag} (${g.team})${assist}`;
        })
        .join("\n"),
      inline: false,
    });
  }

  if (venue) {
    fields.push({ name: "Venue", value: venue, inline: true });
  }

  return buildEmbed({
    title: titleMap[status],
    description: `**${match.homeTeam}** \`${match.homeScore}\` - \`${match.awayScore}\` **${match.awayTeam}**`,
    fields,
    color: status === "fulltime" ? COLORS.SECONDARY : status === "halftime" ? COLORS.INFO : COLORS.LIVE,
    footerText: `${match.competition} • GoalX Live`,
  });
}

/** Legacy alias kept for backward compatibility with existing callers. */
export function matchEventEmbed(options: {
  headline: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  competition: string;
  minuteLabel?: string;
  goalScorers?: { minute: string; player: string; team: string }[];
  isFullTime?: boolean;
}): EmbedBuilder {
  const { headline, minuteLabel, goalScorers, isFullTime, ...match } = options;

  const fields: { name: string; value: string; inline?: boolean }[] = [];
  if (goalScorers && goalScorers.length > 0) {
    fields.push({
      name: `${EMOJIS.GOAL} Goals`,
      value: goalScorers.map((g) => `\`${g.minute}\` **${g.player}** (${g.team})`).join("\n"),
      inline: false,
    });
  }

  return buildEmbed({
    title: headline,
    description: [
      `**${match.homeTeam}** \`${match.homeScore}\` - \`${match.awayScore}\` **${match.awayTeam}**`,
      minuteLabel ? `\n${minuteLabel}` : "",
    ].join(""),
    fields,
    color: isFullTime ? COLORS.SECONDARY : COLORS.LIVE,
    footerText: `${match.competition} • GoalX Live`,
  });
}

/** 🔮 Score prediction card — user locks in a scoreline prediction. */
export function predictionEmbed(options: {
  username: string;
  homeScore: number;
  awayScore: number;
  fixtureLabel: string;
}): EmbedBuilder {
  return announcementEmbed({
    emoji: "🔮",
    title: "Prediction Locked In",
    description: [
      `**${options.username}** predicts:`,
      `Home \`${options.homeScore}\` - \`${options.awayScore}\` Away`,
      "",
      options.fixtureLabel,
    ].join("\n"),
    color: COLORS.AI,
  });
}

/** 🚨 Transfer news card. */
export function transferNewsEmbed(options: {
  headline: string;
  summary: string;
  source: string;
  imageUrl?: string;
  sourceUrl?: string;
}): EmbedBuilder {
  return buildEmbed({
    title: `🚨 ${options.headline}`,
    description: options.summary,
    image: options.imageUrl,
    url: options.sourceUrl,
    color: COLORS.NEWS,
    footerText: `Source: ${options.source} • GoalX News`,
  });
}

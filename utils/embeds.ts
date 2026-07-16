import { EmbedBuilder, ColorResolvable } from "discord.js";
import { COLORS } from "../config/colors";
import { EMBED_LIMITS } from "../config/constants";

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

/**
 * Base builder. Every category-specific embed (fantasyEmbed, liveEmbed, etc.)
 * wraps this — the left-hand color bar Discord renders comes from setColor,
 * so consistent category colors (config/colors.ts) are what create the
 * "branded accent bar" look across every GoalX embed.
 */
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

/**
 * Announcement-style embed for milestone/creation events —
 * e.g. "A new fantasy team has been created", partner activations.
 * Bold emoji-led title + short celebratory description, matching the
 * "🎉 A new team has been created!" pattern from polished football bots,
 * but in GoalX's own voice and color.
 */
export function announcementEmbed(options: BaseEmbedOptions & { emoji?: string }): EmbedBuilder {
  const emoji = options.emoji ?? "🎉";
  return buildEmbed({
    ...options,
    title: options.title ? `${emoji} ${options.title}` : undefined,
    color: options.color ?? COLORS.SUCCESS,
  });
}

/**
 * Goal/full-time style match event embed — bold headline, structured
 * scoreline, and a goal-scorer breakdown field. Used by live match
 * notifications and the /match command's overview view.
 */
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
  const {
    headline,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    competition,
    minuteLabel,
    goalScorers,
    isFullTime,
  } = options;

  const fields: { name: string; value: string; inline?: boolean }[] = [];

  if (goalScorers && goalScorers.length > 0) {
    fields.push({
      name: "⚽ Goals",
      value: goalScorers.map((g) => `\`${g.minute}\` **${g.player}** (${g.team})`).join("\n"),
      inline: false,
    });
  }

  return buildEmbed({
    title: headline,
    description: [
      `**${homeTeam}** \`${homeScore}\` - \`${awayScore}\` **${awayTeam}**`,
      minuteLabel ? `\n${minuteLabel}` : "",
    ].join(""),
    fields,
    color: isFullTime ? COLORS.SECONDARY : COLORS.LIVE,
    footerText: `${competition} • GoalX Live`,
  });
}

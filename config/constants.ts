export const COLORS_PLACEHOLDER = null;

export const EMBED_LIMITS = {
  TITLE_MAX_LENGTH: 256,
  DESCRIPTION_MAX_LENGTH: 4096,
  FIELD_NAME_MAX_LENGTH: 256,
  FIELD_VALUE_MAX_LENGTH: 1024,
  MAX_FIELDS: 25,
  FOOTER_MAX_LENGTH: 2048,
  TOTAL_MAX_LENGTH: 6000,
} as const;

export const EMOJIS = {
  FOOTBALL: "⚽",
  TROPHY: "🏆",
  ROBOT: "🤖",
  FIRE: "🔥",
  CHART: "📊",
  CROWN: "👑",
  ARROW_LEFT: "◀️",
  ARROW_RIGHT: "▶️",
  REFRESH: "🔄",
  CHECK: "✅",
  CROSS: "❌",
  WARNING: "⚠️",
  LOCK: "🔒",
  STAR: "⭐",
  GOAL: "🥅",
  CARD_YELLOW: "🟨",
  CARD_RED: "🟥",
  SUBSTITUTION: "🔁",
  LOADING: "⏳",
  INJURY: "🩹",
  TRANSFER: "🔀",
} as const;

export const CUSTOM_IDS = {
  FANTASY: {
    MY_TEAM: "fantasy_my_team",
    TRANSFERS: "fantasy_transfers",
    CAPTAIN: "fantasy_captain",
    AI_SCOUT: "fantasy_ai_scout",
    LEADERBOARD: "fantasy_leaderboard",
    BACK: "fantasy_back",
  },
  MATCH: {
    STATS: "match_stats",
    LINEUPS: "match_lineups",
    TIMELINE: "match_timeline",
    REFRESH: "match_refresh",
    FOLLOW: "match_follow",
  },
  PAGINATION: {
    FIRST: "page_first",
    PREV: "page_prev",
    NEXT: "page_next",
    LAST: "page_last",
  },
  SELECT: {
    PLAYER: "select_player",
    TEAM: "select_team",
    LEAGUE: "select_league",
  },
  MODAL: {
    SEARCH: "modal_search",
    TRANSFER: "modal_transfer",
  },
} as const;

export const COOLDOWNS = {
  DEFAULT: 3,
  AI_COMMAND: 15,
  TRANSFER: 5,
  ADMIN: 2,
} as const;

export const PERMISSIONS_MESSAGES = {
  NO_ADMIN: "You need Administrator permission to use this command.",
  NO_PARTNER: "This feature is only available to GoalX partner servers.",
  FANTASY_LOCKED: "Fantasy actions are currently locked for this gameweek.",
} as const;

export const LEAGUE_IDS = {
  PREMIER_LEAGUE: 39,
  LA_LIGA: 140,
  BUNDESLIGA: 78,
  SERIE_A: 135,
  LIGUE_1: 61,
  CHAMPIONS_LEAGUE: 2,
  EUROPA_LEAGUE: 3,
} as const;

export const FANTASY_POSITIONS = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
} as const;

export const POSITION_LIMITS = {
  GK: { min: 1, max: 1 },
  DEF: { min: 3, max: 5 },
  MID: { min: 3, max: 5 },
  FWD: { min: 1, max: 3 },
} as const;

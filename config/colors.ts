export const COLORS = {
  PRIMARY: 0x1e90ff,
  SECONDARY: 0x0a2540,
  SUCCESS: 0x2ecc71,
  ERROR: 0xe74c3c,
  WARNING: 0xf39c12,
  INFO: 0x3498db,
  LOADING: 0x95a5a6,

  FANTASY: 0xffd700,
  LIVE: 0xff4444,
  AI: 0x9b59b6,
  NEWS: 0x1abc9c,
  PARTNER: 0xe67e22,
  ADMIN: 0x34495e,

  DARK_BG: 0x0b0e14,

  GOAL: 0x2ecc71,
  RED_CARD: 0xe74c3c,
  YELLOW_CARD: 0xf1c40f,
} as const;

export type ColorKey = keyof typeof COLORS;

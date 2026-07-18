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

  // Economy accents
  ECONOMY_MV: 0x8e44ad,
  ECONOMY_TOKENS: 0xf1c40f,
  LEVEL_UP: 0xffd700,

  // Prediction accents
  PREDICTION: 0x6c5ce7,
  PREDICTION_CORRECT: 0x00b894,
  PREDICTION_EXACT: 0xfdcb6e,

  // Tier accents (matches MARKET_VALUE_TIERS in EconomyService)
  TIER_BRONZE: 0xcd7f32,
  TIER_SILVER: 0xa8a9ad,
  TIER_GOLD: 0xffd700,
  TIER_DIAMOND: 0x00d4ff,

  // Challenge accents
  CHALLENGE_PENDING: 0xf39c12,
  CHALLENGE_LIVE: 0xe74c3c,
  CHALLENGE_WON: 0x2ecc71,
} as const;

export type ColorKey = keyof typeof COLORS;

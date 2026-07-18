import { User, IUser } from "../../database/models/User";
import { logger } from "../../utils/logger";

export class EconomyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EconomyError";
  }
}

export type EarnSource =
  | "daily_login"
  | "lineup_set"
  | "transfer_made"
  | "challenge_won"
  | "prediction_correct"
  | "prediction_perfect"
  | "weekly_challenge"
  | "command_used";

interface EarnAmount {
  marketValue: number;
  tokens: number;
}

/**
 * Reward scale adopted from a user-provided design doc, not reverse
 * engineered from any competitor's real numbers (those aren't public).
 * These are GoalX's own chosen values at this scale — easy to retune again
 * once real usage data exists.
 */
const EARN_AMOUNTS: Record<EarnSource, EarnAmount> = {
  daily_login: { marketValue: 50, tokens: 20 },
  lineup_set: { marketValue: 30, tokens: 15 },
  transfer_made: { marketValue: 20, tokens: 10 },
  challenge_won: { marketValue: 150, tokens: 100 },
  prediction_correct: { marketValue: 200, tokens: 100 },
  prediction_perfect: { marketValue: 400, tokens: 250 },
  weekly_challenge: { marketValue: 1000, tokens: 500 },
  command_used: { marketValue: 50, tokens: 0 },
};

const DAILY_STREAK_BONUS: EarnAmount = { marketValue: 500, tokens: 200 };
const DAILY_STREAK_BONUS_THRESHOLD_DAYS = 7;
const DAILY_COOLDOWN_HOURS = 20;

// Command-XP abuse guard: a user can only earn command_used XP once per this
// window, regardless of how many commands they run in between. Prevents
// spamming any single command (or hopping between commands) to farm XP.
const COMMAND_XP_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const commandXpCooldowns = new Map<string, number>();

interface MarketValueTier {
  name: string;
  emoji: string;
  minMarketValue: number;
}

/**
 * GoalX's own tier system — a deliberate design choice, not copied from any
 * competitor. Tiers are cosmetic/status only right now (shown on /wallet);
 * they don't yet unlock mechanical bonuses (better daily rewards, etc.) —
 * that would be a separate, later feature, not silently included here.
 */
const MARKET_VALUE_TIERS: MarketValueTier[] = [
  { name: "Bronze Scout", emoji: "🥉", minMarketValue: 0 },
  { name: "Rising Analyst", emoji: "🥈", minMarketValue: 10000 },
  { name: "Elite Scout", emoji: "🥇", minMarketValue: 50000 },
  { name: "Football Expert", emoji: "💎", minMarketValue: 150000 },
];

function calculateLevel(marketValue: number): number {
  let level = 1;
  let threshold = 100;

  while (marketValue >= threshold) {
    level += 1;
    threshold += level * 100;
  }

  return level;
}

export class EconomyService {
  public async getOrCreateUser(discordId: string, username: string): Promise<IUser> {
    return User.findOneAndUpdate(
      { discordId },
      { $setOnInsert: { discordId, username } },
      { upsert: true, new: true },
    );
  }

  public async award(
    discordId: string,
    username: string,
    source: EarnSource,
    multiplier = 1,
  ): Promise<{ marketValueGained: number; tokensGained: number; leveledUp: boolean; newLevel: number }> {
    const amounts = EARN_AMOUNTS[source];
    const marketValueGained = Math.round(amounts.marketValue * multiplier);
    const tokensGained = Math.round(amounts.tokens * multiplier);

    const user = await this.getOrCreateUser(discordId, username);
    const previousLevel = calculateLevel(user.economy.marketValue);

    user.economy.marketValue += marketValueGained;
    user.economy.tokens += tokensGained;

    const newLevel = calculateLevel(user.economy.marketValue);
    user.economy.level = newLevel;

    await user.save();

    return {
      marketValueGained,
      tokensGained,
      leveledUp: newLevel > previousLevel,
      newLevel,
    };
  }

  /**
   * Awards command_used XP, but only once per COMMAND_XP_COOLDOWN_MS window
   * per user — regardless of which command or how many were run in between.
   * Returns null (no reward) if the user is still on cooldown, so callers
   * can silently skip showing a reward line rather than award repeatedly.
   */
  public async awardCommandUsage(
    discordId: string,
    username: string,
  ): Promise<{ marketValueGained: number; tokensGained: number; leveledUp: boolean; newLevel: number } | null> {
    const lastAward = commandXpCooldowns.get(discordId);
    const now = Date.now();

    if (lastAward && now - lastAward < COMMAND_XP_COOLDOWN_MS) {
      return null;
    }

    commandXpCooldowns.set(discordId, now);
    return this.award(discordId, username, "command_used");
  }

  public async claimDaily(
    discordId: string,
    username: string,
  ): Promise<{
    tokensGained: number;
    marketValueGained: number;
    streak: number;
    streakBonusApplied: boolean;
    leveledUp: boolean;
    newLevel: number;
  }> {
    const user = await this.getOrCreateUser(discordId, username);

    const now = new Date();
    const lastClaim = user.economy.lastDailyClaim;

    if (lastClaim) {
      const hoursSinceLastClaim = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastClaim < DAILY_COOLDOWN_HOURS) {
        const hoursRemaining = Math.ceil(DAILY_COOLDOWN_HOURS - hoursSinceLastClaim);
        throw new EconomyError(`You've already claimed your daily reward. Try again in ${hoursRemaining}h.`);
      }

      const streakBroken = hoursSinceLastClaim > 48;
      user.economy.dailyStreak = streakBroken ? 1 : user.economy.dailyStreak + 1;
    } else {
      user.economy.dailyStreak = 1;
    }

    const base = EARN_AMOUNTS.daily_login;
    const streakBonusApplied = user.economy.dailyStreak > 0 && user.economy.dailyStreak % DAILY_STREAK_BONUS_THRESHOLD_DAYS === 0;

    const marketValueGained = base.marketValue + (streakBonusApplied ? DAILY_STREAK_BONUS.marketValue : 0);
    const tokensGained = base.tokens + (streakBonusApplied ? DAILY_STREAK_BONUS.tokens : 0);

    const previousLevel = calculateLevel(user.economy.marketValue);

    user.economy.marketValue += marketValueGained;
    user.economy.tokens += tokensGained;
    user.economy.lastDailyClaim = now;

    const newLevel = calculateLevel(user.economy.marketValue);
    user.economy.level = newLevel;

    await user.save();

    return {
      tokensGained,
      marketValueGained,
      streak: user.economy.dailyStreak,
      streakBonusApplied,
      leveledUp: newLevel > previousLevel,
      newLevel,
    };
  }

  public async spendTokens(discordId: string, amount: number): Promise<IUser> {
    if (amount <= 0) {
      throw new EconomyError("Spend amount must be positive.");
    }

    const user = await User.findOne({ discordId });
    if (!user) {
      throw new EconomyError("User profile not found.");
    }

    if (user.economy.tokens < amount) {
      throw new EconomyError(
        `Insufficient tokens. You have ${user.economy.tokens}, this costs ${amount}.`,
      );
    }

    user.economy.tokens -= amount;
    await user.save();

    return user;
  }

  public getLevelProgress(marketValue: number): {
    level: number;
    currentThreshold: number;
    nextThreshold: number;
    progress: number;
  } {
    let level = 1;
    let threshold = 0;
    let nextThreshold = 100;

    while (marketValue >= nextThreshold) {
      level += 1;
      threshold = nextThreshold;
      nextThreshold += level * 100;
    }

    const progress = (marketValue - threshold) / (nextThreshold - threshold);

    return { level, currentThreshold: threshold, nextThreshold, progress };
  }

  public getMarketValueTier(marketValue: number): MarketValueTier {
    let currentTier = MARKET_VALUE_TIERS[0];

    for (const tier of MARKET_VALUE_TIERS) {
      if (marketValue >= tier.minMarketValue) {
        currentTier = tier;
      }
    }

    return currentTier;
  }

  public async getLeaderboard(
    metric: "marketValue" | "tokens",
    limit = 10,
  ): Promise<{ discordId: string; username: string; value: number; rank: number }[]> {
    try {
      const sortField = metric === "marketValue" ? "economy.marketValue" : "economy.tokens";

      const users = await User.find({})
        .sort({ [sortField]: -1 })
        .limit(Math.min(Math.max(limit, 1), 25))
        .lean();

      return users.map((user, index) => ({
        discordId: user.discordId,
        username: user.username,
        value: metric === "marketValue" ? user.economy.marketValue : user.economy.tokens,
        rank: index + 1,
      }));
    } catch (error) {
      logger.error("Failed to fetch economy leaderboard", { error, metric });
      throw new EconomyError("Could not load the leaderboard right now.");
    }
  }
}

export const economyService = new EconomyService();

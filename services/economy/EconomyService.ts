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
  | "command_used";

const EARN_AMOUNTS: Record<EarnSource, { marketValue: number; tokens: number }> = {
  daily_login: { marketValue: 10, tokens: 25 },
  lineup_set: { marketValue: 5, tokens: 5 },
  transfer_made: { marketValue: 3, tokens: 0 },
  challenge_won: { marketValue: 20, tokens: 50 },
  prediction_correct: { marketValue: 15, tokens: 30 },
  command_used: { marketValue: 1, tokens: 0 },
};

const DAILY_STREAK_BONUS_TOKENS_PER_DAY = 5;
const MAX_DAILY_STREAK_BONUS_DAYS = 10;
const DAILY_COOLDOWN_HOURS = 20; // slightly under 24h so timezone drift doesn't lock users out

/**
 * Level curve: each level requires progressively more Market Value than the
 * last (simple quadratic curve). This is GoalX's own formula, not reverse
 * engineered from any competitor — the exact numbers are a starting point,
 * easy to retune later once real usage data exists.
 */
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

  public async claimDaily(
    discordId: string,
    username: string,
  ): Promise<{ tokensGained: number; marketValueGained: number; streak: number; leveledUp: boolean; newLevel: number }> {
    const user = await this.getOrCreateUser(discordId, username);

    const now = new Date();
    const lastClaim = user.economy.lastDailyClaim;

    if (lastClaim) {
      const hoursSinceLastClaim = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastClaim < DAILY_COOLDOWN_HOURS) {
        const hoursRemaining = Math.ceil(DAILY_COOLDOWN_HOURS - hoursSinceLastClaim);
        throw new EconomyError(`You've already claimed your daily reward. Try again in ${hoursRemaining}h.`);
      }

      // Streak continues if claimed within 48h of the last claim, otherwise resets.
      const streakBroken = hoursSinceLastClaim > 48;
      user.economy.dailyStreak = streakBroken ? 1 : user.economy.dailyStreak + 1;
    } else {
      user.economy.dailyStreak = 1;
    }

    const streakDays = Math.min(user.economy.dailyStreak, MAX_DAILY_STREAK_BONUS_DAYS);
    const base = EARN_AMOUNTS.daily_login;
    const streakBonusTokens = streakDays * DAILY_STREAK_BONUS_TOKENS_PER_DAY;

    const marketValueGained = base.marketValue;
    const tokensGained = base.tokens + streakBonusTokens;

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

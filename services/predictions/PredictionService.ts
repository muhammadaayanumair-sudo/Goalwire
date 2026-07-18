import { Prediction, IPrediction, PredictionOutcome } from "../../database/models/Prediction";
import { liveService, LiveServiceError } from "../football/LiveService";
import { economyService } from "../economy/EconomyService";
import { logger } from "../../utils/logger";

export class PredictionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PredictionError";
  }
}

const MAX_PENDING_PREDICTIONS_PER_USER = 15;

export class PredictionService {
  public async createPrediction(
    discordId: string,
    guildId: string,
    fixtureId: number,
    predictedHomeScore: number,
    predictedAwayScore: number,
  ): Promise<IPrediction> {
    if (predictedHomeScore < 0 || predictedAwayScore < 0) {
      throw new PredictionError("Predicted scores can't be negative.");
    }

    if (!Number.isInteger(predictedHomeScore) || !Number.isInteger(predictedAwayScore)) {
      throw new PredictionError("Predicted scores must be whole numbers.");
    }

    const existing = await Prediction.findOne({ discordId, fixtureId });
    if (existing) {
      throw new PredictionError("You've already predicted this fixture. Predictions can't be changed once made.");
    }

    const pendingCount = await Prediction.countDocuments({ discordId, status: "pending" });
    if (pendingCount >= MAX_PENDING_PREDICTIONS_PER_USER) {
      throw new PredictionError(
        `You have ${MAX_PENDING_PREDICTIONS_PER_USER} pending predictions already. Wait for some to be scored first.`,
      );
    }

    let fixture;
    try {
      fixture = await liveService.getFixtureById(fixtureId);
    } catch (error) {
      if (error instanceof LiveServiceError) {
        throw new PredictionError("Could not verify that fixture right now. Please try again shortly.");
      }
      throw error;
    }

    if (!fixture) {
      throw new PredictionError(`No fixture found with ID \`${fixtureId}\`.`);
    }

    const isAlreadyFinished =
      fixture.status.short === "FT" || fixture.status.short === "AET" || fixture.status.short === "PEN";
    const isLive = fixture.status.elapsed !== null && !isAlreadyFinished;

    if (isAlreadyFinished) {
      throw new PredictionError("This fixture has already finished — predictions must be made before kickoff.");
    }

    if (isLive) {
      throw new PredictionError("This fixture has already kicked off — predictions must be made before kickoff.");
    }

    try {
      const prediction = await Prediction.create({
        discordId,
        guildId,
        fixtureId,
        homeTeamName: fixture.teams.home.name,
        awayTeamName: fixture.teams.away.name,
        predictedHomeScore,
        predictedAwayScore,
      });

      logger.info("Prediction created", { discordId, fixtureId, predictedHomeScore, predictedAwayScore });
      return prediction;
    } catch (error) {
      const isDuplicateKey = (error as { code?: number }).code === 11000;
      if (isDuplicateKey) {
        throw new PredictionError("You've already predicted this fixture.");
      }
      logger.error("Failed to create prediction", { error, discordId, fixtureId });
      throw new PredictionError("Something went wrong saving your prediction.");
    }
  }

  /**
   * Scores every pending prediction for a fixture once it's known to be
   * final. Called reactively from jobs/liveUpdater.ts when a fixture
   * transitions to FT/AET/PEN — NOT from a separate scheduled job. This
   * means a fixture GoalX's live poller never picks up as "live" (e.g. an
   * obscure league nobody's tracking) will never trigger scoring here, even
   * if users predicted it. That's a real, known limitation of reactive
   * scoring, not an oversight — a fully general solution would need its own
   * periodic "check all fixtures with pending predictions" job instead.
   */
  public async scoreFixturePredictions(
    fixtureId: number,
    actualHomeScore: number,
    actualAwayScore: number,
  ): Promise<{ scoredCount: number }> {
    const pending = await Prediction.find({ fixtureId, status: "pending" });

    if (pending.length === 0) {
      return { scoredCount: 0 };
    }

    const actualOutcome = this.deriveOutcome(actualHomeScore, actualAwayScore);

    for (const prediction of pending) {
      const isExactMatch =
        prediction.predictedHomeScore === actualHomeScore && prediction.predictedAwayScore === actualAwayScore;
      const isOutcomeMatch = prediction.predictedOutcome === actualOutcome;

      prediction.actualHomeScore = actualHomeScore;
      prediction.actualAwayScore = actualAwayScore;
      prediction.scoredAt = new Date();

      if (isExactMatch) {
        prediction.status = "correct_exact";
      } else if (isOutcomeMatch) {
        prediction.status = "correct_outcome";
      } else {
        prediction.status = "incorrect";
      }

      await prediction.save();

      if (isExactMatch || isOutcomeMatch) {
        try {
          await economyService.award(
            prediction.discordId,
            prediction.discordId,
            isExactMatch ? "prediction_perfect" : "prediction_correct",
          );
        } catch (economyError) {
          logger.warn("Failed to award economy reward for prediction", {
            error: economyError,
            discordId: prediction.discordId,
            fixtureId,
          });
        }
      }
    }

    logger.info("Scored fixture predictions", { fixtureId, scoredCount: pending.length });
    return { scoredCount: pending.length };
  }

  public async voidFixturePredictions(fixtureId: number): Promise<void> {
    await Prediction.updateMany({ fixtureId, status: "pending" }, { status: "void" });
  }

  public async getUserPredictionStats(
    discordId: string,
  ): Promise<{ total: number; correctExact: number; correctOutcome: number; incorrect: number; pending: number }> {
    const [total, correctExact, correctOutcome, incorrect, pending] = await Promise.all([
      Prediction.countDocuments({ discordId }),
      Prediction.countDocuments({ discordId, status: "correct_exact" }),
      Prediction.countDocuments({ discordId, status: "correct_outcome" }),
      Prediction.countDocuments({ discordId, status: "incorrect" }),
      Prediction.countDocuments({ discordId, status: "pending" }),
    ]);

    return { total, correctExact, correctOutcome, incorrect, pending };
  }

  private deriveOutcome(homeScore: number, awayScore: number): PredictionOutcome {
    if (homeScore > awayScore) return "home";
    if (homeScore < awayScore) return "away";
    return "draw";
  }
}

export const predictionService = new PredictionService();

import { Prediction } from "../database/models/Prediction";
import { predictionService } from "../services/predictions/PredictionService";
import { liveService, LiveServiceError } from "../services/football/LiveService";
import { logger } from "../utils/logger";

const SWEEP_INTERVAL_MS = 3 * 60 * 60 * 1000; // every 3 hours
const VOIDABLE_STATUSES = new Set(["PST", "CANC", "ABD", "SUSP"]);
const REQUEST_STAGGER_MS = 500; // small delay between calls to avoid bursting the API

let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let isSweeping = false;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Periodic sweep for predictions on fixtures that were never picked up by
 * jobs/liveUpdater.ts's reactive scoring — specifically, fixtures postponed
 * or cancelled BEFORE ever going live. liveUpdater.ts only sees a fixture
 * once it appears in getLiveFixtures(); a match called off the day before
 * kickoff never enters that list at all, so its pending predictions would
 * be stuck forever without this separate check.
 *
 * This does NOT duplicate liveUpdater.ts's job of scoring finished matches
 * or detecting postponement of already-live fixtures — this only exists to
 * catch the gap liveUpdater.ts structurally cannot see.
 */
export function startPredictionSweep(): void {
  if (isRunning) {
    logger.warn("Prediction sweep already running, refusing to start a second instance");
    return;
  }

  isRunning = true;
  scheduleNextSweep(SWEEP_INTERVAL_MS);
  logger.info("Prediction sweep job started", { intervalMs: SWEEP_INTERVAL_MS });
}

export function stopPredictionSweep(): void {
  isRunning = false;

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
  }

  logger.info("Prediction sweep job stopped");
}

function scheduleNextSweep(delayMs: number): void {
  if (!isRunning) return;

  timeoutHandle = setTimeout(() => {
    void runSweep();
  }, delayMs);
}

async function runSweep(): Promise<void> {
  if (isSweeping) {
    logger.debug("Skipping prediction sweep tick — previous sweep still running");
    scheduleNextSweep(SWEEP_INTERVAL_MS);
    return;
  }

  isSweeping = true;

  try {
    const distinctFixtureIds: number[] = await Prediction.distinct("fixtureId", { status: "pending" });

    if (distinctFixtureIds.length === 0) {
      logger.debug("Prediction sweep: no pending predictions to check");
      return;
    }

    logger.info(`Prediction sweep: checking ${distinctFixtureIds.length} distinct pending fixture(s)`);

    let voidedCount = 0;
    let scoredCount = 0;

    for (const fixtureId of distinctFixtureIds) {
      try {
        const fixture = await liveService.getFixtureById(fixtureId);

        if (!fixture) {
          // Fixture no longer resolvable at all (e.g. removed from the API) —
          // treat as void rather than leave predictions stuck indefinitely.
          await predictionService.voidFixturePredictions(fixtureId);
          voidedCount++;
          continue;
        }

        const statusShort = fixture.status.short;

        if (VOIDABLE_STATUSES.has(statusShort)) {
          await predictionService.voidFixturePredictions(fixtureId);
          voidedCount++;
          continue;
        }

        const isFinished = statusShort === "FT" || statusShort === "AET" || statusShort === "PEN";

        if (isFinished) {
          // This fixture finished without liveUpdater.ts ever catching it live
          // (e.g. the bot was restarted mid-match, or polling missed the
          // window). Score it here as a fallback.
          const result = await predictionService.scoreFixturePredictions(
            fixtureId,
            fixture.goals.home ?? 0,
            fixture.goals.away ?? 0,
          );
          scoredCount += result.scoredCount;
        }
      } catch (error) {
        if (error instanceof LiveServiceError) {
          logger.warn("Prediction sweep: failed to check fixture, will retry next sweep", {
            error: error.message,
            fixtureId,
          });
        } else {
          logger.error("Prediction sweep: unexpected error checking fixture", { error, fixtureId });
        }
      }

      await delay(REQUEST_STAGGER_MS);
    }

    logger.info("Prediction sweep complete", {
      checked: distinctFixtureIds.length,
      voided: voidedCount,
      scoredFallback: scoredCount,
    });
  } catch (error) {
    logger.error("Prediction sweep tick failed", { error });
  } finally {
    isSweeping = false;
    scheduleNextSweep(SWEEP_INTERVAL_MS);
  }
}

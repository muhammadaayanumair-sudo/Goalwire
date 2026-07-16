import { logger } from "../../utils/logger";

export type MatchEventType = "shot" | "shot_on_target" | "tackle" | "cross" | "save" | "near_miss" | "goal" | "kickoff" | "halftime" | "fulltime";

export interface SimulatedEvent {
  minute: number;
  type: MatchEventType;
  team: "home" | "away";
  commentary: string;
  isGoal: boolean;
}

export interface SimulatedTickResult {
  minute: number;
  totalMinutes: number;
  homeScore: number;
  awayScore: number;
  event: SimulatedEvent | null;
  isComplete: boolean;
}

const TOTAL_SIMULATED_MINUTES = 90;
const TICKS_PER_MATCH = 10;
const MINUTES_PER_TICK = Math.ceil(TOTAL_SIMULATED_MINUTES / TICKS_PER_MATCH);

const GOAL_CHANCE_PER_TICK = 0.16;

const BANTER_LINES: Record<Exclude<MatchEventType, "kickoff" | "halftime" | "fulltime">, string[]> = {
  shot: [
    "{team} crosses the midfield and lets one fly — miles over the bar!",
    "{team} tries a speculative effort from range... straight into the stands.",
    "{team} winds up for a shot but scuffs it well wide.",
  ],
  shot_on_target: [
    "{team} drives forward and forces a save from the keeper!",
    "{team} tests the goalkeeper with a low, stinging shot.",
  ],
  tackle: [
    "{team} puts in a crunching tackle to win the ball back.",
    "{team} reads the pass perfectly and intercepts.",
  ],
  cross: [
    "{team} whips a dangerous ball into the box... but nobody's there to meet it.",
    "{team} swings in a cross that just evades everyone.",
  ],
  save: [
    "What a save! The keeper for {team} denies a certain goal.",
    "{team}'s goalkeeper is equal to it — brilliant reflexes!",
  ],
  near_miss: [
    "{team} comes agonisingly close — that rattles the post!",
    "{team} thought that was in — the crossbar says otherwise!",
  ],
  goal: [
    "GOAL! {team} finds the back of the net!",
    "GOAL! {team} breaks the deadlock with a clinical finish!",
    "GOAL! A stunning strike from {team}!",
  ],
};

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickTeam(): "home" | "away" {
  return Math.random() < 0.5 ? "home" : "away";
}

/**
 * Runs a lightweight, clearly-fictional match simulation for arcade-style
 * challenge kickoffs. This does NOT use real fixture data — event minutes,
 * commentary, and outcomes are randomly generated per tick, purely for
 * engagement between two fantasy-team owners' challenge.
 */
export class MatchSimulator {
  private homeScore = 0;
  private awayScore = 0;
  private currentTick = 0;

  public getTotalTicks(): number {
    return TICKS_PER_MATCH;
  }

  public getCurrentMinute(): number {
    return Math.min(this.currentTick * MINUTES_PER_TICK, TOTAL_SIMULATED_MINUTES);
  }

  public tick(homeTeamLabel: string, awayTeamLabel: string): SimulatedTickResult {
    this.currentTick += 1;
    const minute = this.getCurrentMinute();
    const isComplete = this.currentTick >= TICKS_PER_MATCH;

    let event: SimulatedEvent | null = null;

    try {
      const isGoal = Math.random() < GOAL_CHANCE_PER_TICK;
      const team = pickTeam();
      const teamLabel = team === "home" ? homeTeamLabel : awayTeamLabel;

      const eventType: MatchEventType = isGoal
        ? "goal"
        : pickRandom<Exclude<MatchEventType, "goal" | "kickoff" | "halftime" | "fulltime">>([
            "shot",
            "shot_on_target",
            "tackle",
            "cross",
            "save",
            "near_miss",
          ]);

      if (isGoal) {
        if (team === "home") this.homeScore += 1;
        else this.awayScore += 1;
      }

      const template = pickRandom(BANTER_LINES[eventType]);
      const commentary = template.replace("{team}", `**${teamLabel}**`);

      event = { minute, type: eventType, team, commentary, isGoal };
    } catch (error) {
      logger.error("Match simulation tick failed to generate an event", { error });
    }

    return {
      minute,
      totalMinutes: TOTAL_SIMULATED_MINUTES,
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      event,
      isComplete,
    };
  }

  public getFinalScore(): { homeScore: number; awayScore: number } {
    return { homeScore: this.homeScore, awayScore: this.awayScore };
  }
}

export function buildProgressBar(minute: number, totalMinutes: number, length = 10): string {
  const filledCount = Math.round((minute / totalMinutes) * length);
  const clampedFilled = Math.max(0, Math.min(length, filledCount));
  return "▰".repeat(clampedFilled) + "▱".repeat(length - clampedFilled);
}

export type FantasyPosition = "GK" | "DEF" | "MID" | "FWD";

export interface FantasyPlayerPool {
  playerId: number;
  name: string;
  position: FantasyPosition;
  teamId: number;
  teamName: string;
  price: number;
  totalPoints: number;
  form: number;
  photo?: string;
  injured: boolean;
}

export interface FantasyScoringRules {
  goal: Record<FantasyPosition, number>;
  assist: number;
  cleanSheet: Record<FantasyPosition, number>;
  yellowCard: number;
  redCard: number;
  penaltyMissed: number;
  penaltySaved: number;
  ownGoal: number;
  minutesPlayed60Plus: number;
  minutesPlayedLess60: number;
  saves: number;
}

export interface FantasyGameweekResult {
  gameweek: number;
  playerId: number;
  points: number;
  breakdown: {
    goals: number;
    assists: number;
    cleanSheet: boolean;
    cardsPoints: number;
    minutesPoints: number;
    savesPoints: number;
    bonusPoints: number;
  };
}

export interface FantasyTransferRequest {
  fantasyTeamId: string;
  playerOutId: number;
  playerInId: number;
  gameweek: number;
}

export interface FantasyLeaderboardEntry {
  discordId: string;
  teamName: string;
  totalPoints: number;
  gameweekPoints: number;
  rank: number;
  previousRank?: number;
}

export interface FantasyScoutRecommendation {
  player: FantasyPlayerPool;
  reason: string;
  confidenceScore: number;
  projectedPoints: number;
}

export interface FantasyCaptainChoice {
  fantasyTeamId: string;
  playerId: number;
  isTripleCaptain: boolean;
}

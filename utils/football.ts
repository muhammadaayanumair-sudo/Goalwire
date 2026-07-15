export interface FootballLeague {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag?: string;
  season: number;
}

export interface FootballTeam {
  id: number;
  name: string;
  code?: string;
  country: string;
  logo: string;
  founded?: number;
}

export interface FootballVenue {
  id?: number;
  name?: string;
  city?: string;
}

export interface FootballFixtureStatus {
  long: string;
  short: string;
  elapsed: number | null;
}

export interface FootballFixture {
  id: number;
  referee?: string;
  timezone: string;
  date: string;
  timestamp: number;
  venue: FootballVenue;
  status: FootballFixtureStatus;
  league: FootballLeague;
  teams: {
    home: FootballTeam & { winner: boolean | null };
    away: FootballTeam & { winner: boolean | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

export interface FootballEvent {
  time: { elapsed: number; extra: number | null };
  team: FootballTeam;
  player: { id: number; name: string };
  assist: { id: number | null; name: string | null };
  type: "Goal" | "Card" | "subst" | "Var";
  detail: string;
  comments: string | null;
}

export interface FootballLineupPlayer {
  player: {
    id: number;
    name: string;
    number: number;
    pos: string;
    grid: string | null;
  };
}

export interface FootballLineup {
  team: FootballTeam;
  formation: string;
  startXI: FootballLineupPlayer[];
  substitutes: FootballLineupPlayer[];
  coach: { id: number; name: string };
}

export interface FootballPlayerStatistics {
  games: {
    appearences: number;
    lineups: number;
    minutes: number;
    position: string;
    rating: string | null;
  };
  goals: {
    total: number | null;
    assists: number | null;
    conceded?: number | null;
    saves?: number | null;
  };
  cards: {
    yellow: number;
    yellowred: number;
    red: number;
  };
}

export interface FootballPlayer {
  id: number;
  name: string;
  firstname: string;
  lastname: string;
  age: number;
  nationality: string;
  photo: string;
  injured: boolean;
}

export interface FootballStanding {
  rank: number;
  team: FootballTeam;
  points: number;
  goalsDiff: number;
  form: string;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
}

export interface FootballTransfer {
  player: { id: number; name: string };
  date: string;
  teams: {
    in: FootballTeam;
    out: FootballTeam;
  };
}

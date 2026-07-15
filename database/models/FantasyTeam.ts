import { Schema, model, Document, Types } from "mongoose";

export interface IFantasyPlayer {
  playerId: number;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  teamId: number;
  teamName: string;
  price: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isStarting: boolean;
}

export interface IFantasyTeam extends Document {
  userId: Types.ObjectId;
  discordId: string;
  guildId: string;
  leagueId?: Types.ObjectId;
  teamName: string;
  budget: number;
  remainingBudget: number;
  players: IFantasyPlayer[];
  totalPoints: number;
  gameweekPoints: number;
  currentGameweek: number;
  transfersMade: number;
  freeTransfers: number;
  isLocked: boolean;
  history: {
    gameweek: number;
    points: number;
    rank?: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const FantasyPlayerSchema = new Schema<IFantasyPlayer>(
  {
    playerId: { type: Number, required: true },
    name: { type: String, required: true },
    position: { type: String, enum: ["GK", "DEF", "MID", "FWD"], required: true },
    teamId: { type: Number, required: true },
    teamName: { type: String, required: true },
    price: { type: Number, required: true },
    isCaptain: { type: Boolean, default: false },
    isViceCaptain: { type: Boolean, default: false },
    isStarting: { type: Boolean, default: true },
  },
  { _id: false },
);

const FantasyTeamSchema = new Schema<IFantasyTeam>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    discordId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    leagueId: { type: Schema.Types.ObjectId, ref: "FantasyLeague" },
    teamName: { type: String, required: true },
    budget: { type: Number, required: true, default: 100.0 },
    remainingBudget: { type: Number, required: true, default: 100.0 },
    players: { type: [FantasyPlayerSchema], default: [] },
    totalPoints: { type: Number, default: 0 },
    gameweekPoints: { type: Number, default: 0 },
    currentGameweek: { type: Number, default: 1 },
    transfersMade: { type: Number, default: 0 },
    freeTransfers: { type: Number, default: 1 },
    isLocked: { type: Boolean, default: false },
    history: {
      type: [
        {
          gameweek: { type: Number, required: true },
          points: { type: Number, required: true },
          rank: { type: Number },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

FantasyTeamSchema.index({ discordId: 1, guildId: 1 }, { unique: true });

export const FantasyTeam = model<IFantasyTeam>("FantasyTeam", FantasyTeamSchema);

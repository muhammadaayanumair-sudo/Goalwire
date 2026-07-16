import { Schema, model, Document, Types } from "mongoose";

export type ChallengeStatus = "pending" | "accepted" | "active" | "completed" | "declined" | "cancelled";

export interface IChallenge extends Document {
  guildId: string;
  proposerDiscordId: string;
  proposerFantasyTeamId: Types.ObjectId;
  opponentDiscordId: string;
  opponentFantasyTeamId?: Types.ObjectId;
  status: ChallengeStatus;
  gameweek: number;
  proposerScore?: number;
  opponentScore?: number;
  winnerDiscordId?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChallengeSchema = new Schema<IChallenge>(
  {
    guildId: { type: String, required: true, index: true },
    proposerDiscordId: { type: String, required: true, index: true },
    proposerFantasyTeamId: { type: Schema.Types.ObjectId, ref: "FantasyTeam", required: true },
    opponentDiscordId: { type: String, required: true, index: true },
    opponentFantasyTeamId: { type: Schema.Types.ObjectId, ref: "FantasyTeam" },
    status: {
      type: String,
      enum: ["pending", "accepted", "active", "completed", "declined", "cancelled"],
      default: "pending",
    },
    gameweek: { type: Number, required: true },
    proposerScore: { type: Number },
    opponentScore: { type: Number },
    winnerDiscordId: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

ChallengeSchema.index(
  { guildId: 1, proposerDiscordId: 1, opponentDiscordId: 1, gameweek: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["pending", "accepted", "active"] } } },
);

export const Challenge = model<IChallenge>("Challenge", ChallengeSchema);

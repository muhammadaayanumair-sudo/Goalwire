import { Schema, model, Document, Types } from "mongoose";

export interface IUser extends Document {
  discordId: string;
  username: string;
  isPartner: boolean;
  partnerSince?: Date;
  favoriteTeamId?: number;
  favoriteLeagueId?: number;
  fantasyTeamId?: Types.ObjectId;
  stats: {
    predictionsMade: number;
    predictionsCorrect: number;
    currentStreak: number;
    bestStreak: number;
  };
  settings: {
    notifications: boolean;
    dmAlerts: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    isPartner: { type: Boolean, default: false },
    partnerSince: { type: Date },
    favoriteTeamId: { type: Number },
    favoriteLeagueId: { type: Number },
    fantasyTeamId: { type: Schema.Types.ObjectId, ref: "FantasyTeam" },
    stats: {
      predictionsMade: { type: Number, default: 0 },
      predictionsCorrect: { type: Number, default: 0 },
      currentStreak: { type: Number, default: 0 },
      bestStreak: { type: Number, default: 0 },
    },
    settings: {
      notifications: { type: Boolean, default: true },
      dmAlerts: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

export const User = model<IUser>("User", UserSchema);

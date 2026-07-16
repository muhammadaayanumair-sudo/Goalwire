import { Schema, model, Document, Types } from "mongoose";

export interface IUser extends Document {
  discordId: string;
  username: string;
  isPartner: boolean;
  partnerSince?: Date;
  favoriteTeamId?: number;
  favoriteLeagueId?: number;
  fantasyTeamId?: Types.ObjectId;
  followedFixtures: number[];
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

const MAX_FOLLOWED_FIXTURES = 20;

const UserSchema = new Schema<IUser>(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    isPartner: { type: Boolean, default: false },
    partnerSince: { type: Date },
    favoriteTeamId: { type: Number },
    favoriteLeagueId: { type: Number },
    fantasyTeamId: { type: Schema.Types.ObjectId, ref: "FantasyTeam" },
    followedFixtures: {
      type: [Number],
      default: [],
      validate: {
        validator: (value: number[]) => value.length <= MAX_FOLLOWED_FIXTURES,
        message: `Cannot follow more than ${MAX_FOLLOWED_FIXTURES} fixtures at once.`,
      },
    },
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

// Index to make liveUpdater.ts's "who follows fixture X" lookup fast without
// scanning every user document on every poll tick.
UserSchema.index({ followedFixtures: 1 });

export const User = model<IUser>("User", UserSchema);

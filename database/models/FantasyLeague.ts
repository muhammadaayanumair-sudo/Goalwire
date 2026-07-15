import { Schema, model, Document, Types } from "mongoose";

export interface IFantasyLeague extends Document {
  name: string;
  guildId: string;
  createdBy: string;
  code: string;
  members: Types.ObjectId[];
  maxMembers: number;
  isPrivate: boolean;
  currentGameweek: number;
  startGameweek: number;
  isActive: boolean;
  standings: {
    fantasyTeamId: Types.ObjectId;
    discordId: string;
    totalPoints: number;
    rank: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const FantasyLeagueSchema = new Schema<IFantasyLeague>(
  {
    name: { type: String, required: true },
    guildId: { type: String, required: true, index: true },
    createdBy: { type: String, required: true },
    code: { type: String, required: true, unique: true, index: true },
    members: [{ type: Schema.Types.ObjectId, ref: "FantasyTeam" }],
    maxMembers: { type: Number, default: 20 },
    isPrivate: { type: Boolean, default: false },
    currentGameweek: { type: Number, default: 1 },
    startGameweek: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    standings: {
      type: [
        {
          fantasyTeamId: { type: Schema.Types.ObjectId, ref: "FantasyTeam", required: true },
          discordId: { type: String, required: true },
          totalPoints: { type: Number, default: 0 },
          rank: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

export const FantasyLeague = model<IFantasyLeague>("FantasyLeague", FantasyLeagueSchema);

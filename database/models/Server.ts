import { Schema, model, Document } from "mongoose";

export interface IServerChannels {
  live?: string;
  goals?: string;
  news?: string;
  transfers?: string;
  announcements?: string;
  fantasyUpdates?: string;
}

export interface IServerRoles {
  partner?: string;
  fantasyPing?: string;
  liveAlertPing?: string;
}

export interface IServer extends Document {
  guildId: string;
  guildName: string;
  prefix: string;
  channels: IServerChannels;
  roles: IServerRoles;
  fantasyEnabled: boolean;
  fantasyLocked: boolean;
  currentGameweek: number;
  isPartner: boolean;
  favoriteTeams: number[];
  favoriteLeagues: number[];
  disabledCommands: string[];
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

const ServerSchema = new Schema<IServer>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    guildName: { type: String, required: true },
    prefix: { type: String, default: "!" },
    channels: {
      live: { type: String },
      goals: { type: String },
      news: { type: String },
      transfers: { type: String },
      announcements: { type: String },
      fantasyUpdates: { type: String },
    },
    roles: {
      partner: { type: String },
      fantasyPing: { type: String },
      liveAlertPing: { type: String },
    },
    fantasyEnabled: { type: Boolean, default: true },
    fantasyLocked: { type: Boolean, default: false },
    currentGameweek: { type: Number, default: 1 },
    isPartner: { type: Boolean, default: false },
    favoriteTeams: { type: [Number], default: [] },
    favoriteLeagues: { type: [Number], default: [] },
    disabledCommands: { type: [String], default: [] },
    language: { type: String, default: "en" },
  },
  { timestamps: true },
);

export const Server = model<IServer>("Server", ServerSchema);

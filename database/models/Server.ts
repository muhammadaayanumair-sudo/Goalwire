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

export interface ILeagueRoleMapping {
  leagueId: number;
  leagueName: string;
  roleId: string;
}

export interface IClubRoleMapping {
  clubId: number;
  clubName: string;
  roleId: string;
}

export interface IServer extends Document {
  guildId: string;
  guildName: string;
  prefix: string;
  channels: IServerChannels;
  roles: IServerRoles;
  leagueRoles: ILeagueRoleMapping[];
  clubRoles: IClubRoleMapping[];
  selfAssignMessageIds: {
    league?: string;
    club?: string;
  };
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

const MAX_ROLE_MAPPINGS = 20;

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
    leagueRoles: {
      type: [
        {
          leagueId: { type: Number, required: true },
          leagueName: { type: String, required: true },
          roleId: { type: String, required: true },
        },
      ],
      default: [],
      validate: {
        validator: (value: unknown[]) => value.length <= MAX_ROLE_MAPPINGS,
        message: `Cannot map more than ${MAX_ROLE_MAPPINGS} league roles.`,
      },
    },
    clubRoles: {
      type: [
        {
          clubId: { type: Number, required: true },
          clubName: { type: String, required: true },
          roleId: { type: String, required: true },
        },
      ],
      default: [],
      validate: {
        validator: (value: unknown[]) => value.length <= MAX_ROLE_MAPPINGS,
        message: `Cannot map more than ${MAX_ROLE_MAPPINGS} club roles.`,
      },
    },
    selfAssignMessageIds: {
      league: { type: String },
      club: { type: String },
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

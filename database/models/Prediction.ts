import { Schema, model, Document } from "mongoose";

export type PredictionOutcome = "home" | "draw" | "away";
export type PredictionStatus = "pending" | "correct_exact" | "correct_outcome" | "incorrect" | "void";

export interface IPrediction extends Document {
  discordId: string;
  guildId: string;
  fixtureId: number;
  homeTeamName: string;
  awayTeamName: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  predictedOutcome: PredictionOutcome;
  actualHomeScore?: number;
  actualAwayScore?: number;
  status: PredictionStatus;
  scoredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

function deriveOutcome(homeScore: number, awayScore: number): PredictionOutcome {
  if (homeScore > awayScore) return "home";
  if (homeScore < awayScore) return "away";
  return "draw";
}

const PredictionSchema = new Schema<IPrediction>(
  {
    discordId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    fixtureId: { type: Number, required: true, index: true },
    homeTeamName: { type: String, required: true },
    awayTeamName: { type: String, required: true },
    predictedHomeScore: { type: Number, required: true, min: 0 },
    predictedAwayScore: { type: Number, required: true, min: 0 },
    predictedOutcome: { type: String, enum: ["home", "draw", "away"], required: true },
    actualHomeScore: { type: Number },
    actualAwayScore: { type: Number },
    status: {
      type: String,
      enum: ["pending", "correct_exact", "correct_outcome", "incorrect", "void"],
      default: "pending",
    },
    scoredAt: { type: Date },
  },
  { timestamps: true },
);

// One prediction per user per fixture — prevents re-predicting the same
// match repeatedly to game the reward system.
PredictionSchema.index({ discordId: 1, fixtureId: 1 }, { unique: true });

PredictionSchema.pre("validate", function (next) {
  if (this.predictedHomeScore !== undefined && this.predictedAwayScore !== undefined) {
    this.predictedOutcome = deriveOutcome(this.predictedHomeScore, this.predictedAwayScore);
  }
  next();
});

export const Prediction = model<IPrediction>("Prediction", PredictionSchema);

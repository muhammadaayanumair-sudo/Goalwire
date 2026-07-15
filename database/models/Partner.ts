import { Schema, model, Document } from "mongoose";

export interface IPartner extends Document {
  guildId: string;
  guildName: string;
  activatedBy: string;
  activatedAt: Date;
  tier: "standard" | "premium";
  features: {
    betaFantasy: boolean;
    advancedAiScout: boolean;
    earlyAccess: boolean;
    exclusiveBadges: boolean;
  };
  feedback: {
    submittedBy: string;
    message: string;
    submittedAt: Date;
  }[];
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PartnerSchema = new Schema<IPartner>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    guildName: { type: String, required: true },
    activatedBy: { type: String, required: true },
    activatedAt: { type: Date, default: Date.now },
    tier: { type: String, enum: ["standard", "premium"], default: "standard" },
    features: {
      betaFantasy: { type: Boolean, default: true },
      advancedAiScout: { type: Boolean, default: true },
      earlyAccess: { type: Boolean, default: true },
      exclusiveBadges: { type: Boolean, default: true },
    },
    feedback: {
      type: [
        {
          submittedBy: { type: String, required: true },
          message: { type: String, required: true },
          submittedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

export const Partner = model<IPartner>("Partner", PartnerSchema);

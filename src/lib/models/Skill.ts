import mongoose, { Schema, type Document, type Types } from "mongoose";

export type SkillCategory =
  | "TECHNICAL"
  | "LANGUAGE"
  | "SOFT"
  | "TOOL"
  | "FRAMEWORK"
  | "CERTIFICATION";

export type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

export interface ISkill extends Document {
  userId: Types.ObjectId;
  name: string;
  category: SkillCategory;
  level: SkillLevel;
  createdAt: Date;
}

const SkillSchema = new Schema<ISkill>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ["TECHNICAL", "LANGUAGE", "SOFT", "TOOL", "FRAMEWORK", "CERTIFICATION"],
      default: "TECHNICAL",
    },
    level: {
      type: String,
      enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"],
      default: "INTERMEDIATE",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Skill = mongoose.models.Skill ?? mongoose.model<ISkill>("Skill", SkillSchema);

import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IExperience extends Document {
  userId: Types.ObjectId;
  company: string;
  title: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  isCurrent: boolean;
  description: string;
  highlights: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ExperienceSchema = new Schema<IExperience>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: String, required: true },
    title: { type: String, required: true },
    location: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    isCurrent: { type: Boolean, default: false },
    description: { type: String, required: true },
    highlights: [{ type: String }],
  },
  { timestamps: true }
);

export const Experience =
  mongoose.models.Experience ?? mongoose.model<IExperience>("Experience", ExperienceSchema);

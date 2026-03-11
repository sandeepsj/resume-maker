import mongoose, { Schema, type Document, type Types } from "mongoose";
import type { ResumeContent } from "@/types/resume";

export interface IResumeVersion extends Document {
  resumeId: Types.ObjectId;
  content: ResumeContent;
  changeLog?: string;
  createdAt: Date;
}

const ResumeVersionSchema = new Schema<IResumeVersion>(
  {
    resumeId: { type: Schema.Types.ObjectId, ref: "Resume", required: true, index: true },
    content: { type: Schema.Types.Mixed, required: true },
    changeLog: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ResumeVersion =
  mongoose.models.ResumeVersion ??
  mongoose.model<IResumeVersion>("ResumeVersion", ResumeVersionSchema);

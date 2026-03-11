import mongoose, { Schema, type Document, type Types } from "mongoose";
import type { ResumeContent } from "@/types/resume";

export type ResumeStatus = "DRAFT" | "GENERATING" | "READY" | "EXPORTED";

export interface IResume extends Document {
  userId: Types.ObjectId;
  title: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  content?: ResumeContent;
  templateId: string;
  status: ResumeStatus;
  pdfUrl?: string;
  pdfGeneratedAt?: Date;
  aiModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ResumeSchema = new Schema<IResume>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    jobTitle: { type: String },
    companyName: { type: String },
    jobDescription: { type: String },
    content: { type: Schema.Types.Mixed },
    templateId: { type: String, default: "modern" },
    status: {
      type: String,
      enum: ["DRAFT", "GENERATING", "READY", "EXPORTED"],
      default: "DRAFT",
    },
    pdfUrl: { type: String },
    pdfGeneratedAt: { type: Date },
    aiModel: { type: String },
  },
  { timestamps: true }
);

export const Resume = mongoose.models.Resume ?? mongoose.model<IResume>("Resume", ResumeSchema);

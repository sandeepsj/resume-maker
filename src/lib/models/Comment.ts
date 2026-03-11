import mongoose, { Schema, type Document, type Types } from "mongoose";

export type CommentStatus = "PENDING" | "PROCESSING" | "APPLIED" | "DISMISSED";

export interface IComment extends Document {
  resumeId: Types.ObjectId;
  sectionKey: string;
  selectedText: string;
  anchorOffset: number;
  focusOffset: number;
  body: string;
  status: CommentStatus;
  aiResponse?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    resumeId: { type: Schema.Types.ObjectId, ref: "Resume", required: true, index: true },
    sectionKey: { type: String, required: true },
    selectedText: { type: String, required: true },
    anchorOffset: { type: Number, required: true },
    focusOffset: { type: Number, required: true },
    body: { type: String, required: true },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "APPLIED", "DISMISSED"],
      default: "PENDING",
    },
    aiResponse: { type: String },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

export const Comment =
  mongoose.models.Comment ?? mongoose.model<IComment>("Comment", CommentSchema);

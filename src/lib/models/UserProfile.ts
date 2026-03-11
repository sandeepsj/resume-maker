import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IUserProfile extends Document {
  userId: Types.ObjectId;
  headline?: string;
  summary?: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    headline: { type: String },
    summary: { type: String },
    phone: { type: String },
    location: { type: String },
    linkedinUrl: { type: String },
    githubUrl: { type: String },
    portfolioUrl: { type: String },
  },
  { timestamps: true }
);

export const UserProfile =
  mongoose.models.UserProfile ?? mongoose.model<IUserProfile>("UserProfile", UserProfileSchema);

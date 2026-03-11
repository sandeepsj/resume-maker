import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IEducation extends Document {
  userId: Types.ObjectId;
  institution: string;
  degree: string;
  field?: string;
  startDate: Date;
  endDate?: Date;
  gpa?: string;
  honors?: string;
  activities: string[];
  createdAt: Date;
  updatedAt: Date;
}

const EducationSchema = new Schema<IEducation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    institution: { type: String, required: true },
    degree: { type: String, required: true },
    field: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    gpa: { type: String },
    honors: { type: String },
    activities: [{ type: String }],
  },
  { timestamps: true }
);

export const Education =
  mongoose.models.Education ?? mongoose.model<IEducation>("Education", EducationSchema);

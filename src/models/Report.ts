import mongoose, { Schema, Document } from "mongoose";

export interface IComment {
  commentId: string;    // คีย์หลักของ comment
  author: string;
  text: string;
  createdAt: Date;
}

export interface IReport extends Document {
  reportId: number;     // คีย์หลัก
  category: string;
  priority: string;
  detail: string;
  status: string;
  owner: string;
  feedback: string;
  likesCount: number;
  dislikesCount: number;
  likedBy: string[];
  dislikedBy: string[];
  comments: IComment[];
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>({
  commentId: { type: String, required: true },
  author: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const ReportSchema = new Schema<IReport>(
  {
    reportId: { type: Number, required: true, unique: true },
    category: { type: String, required: true },
    priority: { type: String, default: "medium", enum: ["low", "medium", "high", "critical"] },
    detail: { type: String, required: true },
    status: { type: String, default: "รอรับเรื่อง" },
    owner: { type: String, required: true },
    feedback: { type: String, default: "" },
    likesCount: { type: Number, default: 0 },
    dislikesCount: { type: Number, default: 0 },
    likedBy: [{ type: String }],
    dislikedBy: [{ type: String }],
    comments: [CommentSchema],
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<IReport>("Report", ReportSchema);

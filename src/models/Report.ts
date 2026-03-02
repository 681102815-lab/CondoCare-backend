import mongoose, { Schema, Document } from "mongoose";

export interface IComment {
  commentId: string;
  author: string;
  text: string;
  likesCount: number;
  dislikesCount: number;
  likedBy: string[];
  dislikedBy: string[];
  createdAt: Date;
}

export interface IReport extends Document {
  reportId: number;
  category: string;
  customCategory: string;    // ถ้าเลือก "อื่นๆ"
  priority: string;
  detail: string;
  status: string;
  owner: string;
  location: string;          // เลขห้อง/สถานที่ (admin แจ้งแทน)
  feedback: string;
  feedbackBy: string;        // ใครเป็นคนใส่หมายเหตุ (admin/tech)
  images: string[];
  completionImages: string[];
  rating: number;            // คะแนน 1-5 ดาว
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
  likesCount: { type: Number, default: 0 },
  dislikesCount: { type: Number, default: 0 },
  likedBy: [{ type: String }],
  dislikedBy: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

const ReportSchema = new Schema<IReport>(
  {
    reportId: { type: Number, required: true, unique: true },
    category: { type: String, required: true },
    customCategory: { type: String, default: "" },
    priority: { type: String, default: "medium", enum: ["low", "medium", "high", "critical"] },
    detail: { type: String, required: true },
    status: { type: String, default: "รอรับเรื่อง" },
    owner: { type: String, required: true },
    location: { type: String, default: "" },
    feedback: { type: String, default: "" },
    feedbackBy: { type: String, default: "" },
    images: [{ type: String }],
    completionImages: [{ type: String }],
    rating: { type: Number, default: 0, min: 0, max: 5 },
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

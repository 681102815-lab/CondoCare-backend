import { Router, Request, Response } from "express";
import Report from "../models/Report";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { upload, uploadToCloudinary } from "../middleware/upload";

const router = Router();

// GET /api/reports — list (resident เห็นเฉพาะของตัวเอง, admin/tech เห็นทั้งหมด)
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const filter = req.user?.role === "resident" ? { owner: req.user.username } : {};
        const reports = await Report.find(filter).sort({ createdAt: -1 });
        res.json({ data: reports });
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// GET /api/reports/next-id — ดึง next report ID (RPT-xxx)
router.get("/next-id", authMiddleware, async (_req: Request, res: Response) => {
    try {
        const last = await Report.findOne().sort({ reportId: -1 });
        const nextId = (last?.reportId || 0) + 1;
        res.json({ nextId });
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /api/reports — create with optional images (multipart/form-data)
router.post("/", authMiddleware, upload.array("images", 5), async (req: AuthRequest, res: Response) => {
    try {
        const { category, customCategory, detail, priority, owner, location } = req.body;

        // Auto-increment report ID
        const last = await Report.findOne().sort({ reportId: -1 });
        const nextId = (last?.reportId || 0) + 1;

        // Upload images to Cloudinary
        const imageUrls: string[] = [];
        const files = req.files as Express.Multer.File[] | undefined;
        if (files && files.length > 0) {
            for (const file of files) {
                const url = await uploadToCloudinary(file.buffer, "reports");
                imageUrls.push(url);
            }
        }

        const report = await Report.create({
            reportId: nextId,
            category,
            customCategory: customCategory || "",
            detail,
            priority: priority || "medium",
            owner: owner || req.user?.username,
            location: location || "",
            status: "รอรับเรื่อง",
            images: imageUrls,
        });
        res.status(201).json(report);
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// DELETE /api/reports/:id — delete (ห้ามลบถ้ากำลังดำเนินการ)
router.delete("/:id", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = req.params.id;
        const report = await Report.findOne({ reportId: Number(id) });
        if (!report) { res.status(404).json({ error: true, message: "Report not found" }); return; }

        // ห้ามลบ report ที่กำลังดำเนินการ
        if (report.status === "กำลังดำเนินการ") {
            res.status(400).json({ error: true, message: "ไม่สามารถลบ Report ที่กำลังดำเนินการได้" });
            return;
        }

        await Report.deleteOne({ reportId: Number(id) });
        res.json({ message: "Deleted", id });
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// PUT /api/reports/:id/status — change status
router.put("/:id/status", authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { status } = req.body;
        const update: any = { status };

        if (status === "กำลังดำเนินการ") {
            update.startedAt = new Date();
        } else if (status === "เสร็จสิ้น") {
            update.completedAt = new Date();
        } else if (status === "รอรับเรื่อง") {
            update.startedAt = null;
            update.completedAt = null;
        }

        const report = await Report.findOneAndUpdate(
            { reportId: Number(req.params.id) },
            update,
            { new: true }
        );
        if (!report) { res.status(404).json({ error: true, message: "Report not found" }); return; }
        res.json(report);
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// PUT /api/reports/:id/feedback — add feedback with feedbackBy
router.put("/:id/feedback", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const report = await Report.findOneAndUpdate(
            { reportId: Number(req.params.id) },
            {
                feedback: req.body.feedback,
                feedbackBy: req.user?.role === "admin" ? "admin" : "tech",
            },
            { new: true }
        );
        if (!report) { res.status(404).json({ error: true, message: "Report not found" }); return; }
        res.json(report);
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// PUT /api/reports/:id/rating — ให้คะแนนช่าง 1-5 ดาว
router.put("/:id/rating", authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { rating } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            res.status(400).json({ error: true, message: "คะแนนต้องอยู่ระหว่าง 1-5" });
            return;
        }
        const report = await Report.findOneAndUpdate(
            { reportId: Number(req.params.id) },
            { rating },
            { new: true }
        );
        if (!report) { res.status(404).json({ error: true, message: "Report not found" }); return; }
        res.json(report);
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /api/reports/:id/completion-images
router.post("/:id/completion-images", authMiddleware, upload.array("images", 5), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const report = await Report.findOne({ reportId: Number(req.params.id) });
        if (!report) { res.status(404).json({ error: true, message: "Report not found" }); return; }

        const files = req.files as Express.Multer.File[] | undefined;
        if (!files || files.length === 0) {
            res.status(400).json({ error: true, message: "กรุณาแนบรูปภาพอย่างน้อย 1 รูป" });
            return;
        }

        const imageUrls: string[] = [];
        for (const file of files) {
            const url = await uploadToCloudinary(file.buffer, "completions");
            imageUrls.push(url);
        }

        report.completionImages.push(...imageUrls);
        await report.save();
        res.json(report);
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /api/reports/:id/comment/:commentId/like — toggle like on a comment
router.post("/:id/comment/:commentId/like", authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { username } = req.body;
        const report = await Report.findOne({ reportId: Number(req.params.id) });
        if (!report) { res.status(404).json({ error: true, message: "Report not found" }); return; }

        const comment = report.comments.find(c => c.commentId === req.params.commentId);
        if (!comment) { res.status(404).json({ error: true, message: "Comment not found" }); return; }

        const idx = comment.likedBy.indexOf(username);
        if (idx >= 0) {
            comment.likedBy.splice(idx, 1);
            comment.likesCount = Math.max(0, comment.likesCount - 1);
        } else {
            comment.likedBy.push(username);
            comment.likesCount += 1;
            const dIdx = comment.dislikedBy.indexOf(username);
            if (dIdx >= 0) { comment.dislikedBy.splice(dIdx, 1); comment.dislikesCount = Math.max(0, comment.dislikesCount - 1); }
        }
        await report.save();
        res.json(report);
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /api/reports/:id/comment/:commentId/dislike — toggle dislike on a comment
router.post("/:id/comment/:commentId/dislike", authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { username } = req.body;
        const report = await Report.findOne({ reportId: Number(req.params.id) });
        if (!report) { res.status(404).json({ error: true, message: "Report not found" }); return; }

        const comment = report.comments.find(c => c.commentId === req.params.commentId);
        if (!comment) { res.status(404).json({ error: true, message: "Comment not found" }); return; }

        const idx = comment.dislikedBy.indexOf(username);
        if (idx >= 0) {
            comment.dislikedBy.splice(idx, 1);
            comment.dislikesCount = Math.max(0, comment.dislikesCount - 1);
        } else {
            comment.dislikedBy.push(username);
            comment.dislikesCount += 1;
            const lIdx = comment.likedBy.indexOf(username);
            if (lIdx >= 0) { comment.likedBy.splice(lIdx, 1); comment.likesCount = Math.max(0, comment.likesCount - 1); }
        }
        await report.save();
        res.json(report);
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /api/reports/:id/comment
router.post("/:id/comment", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { author, text } = req.body;
        const report = await Report.findOne({ reportId: Number(req.params.id) });
        if (!report) { res.status(404).json({ error: true, message: "Report not found" }); return; }

        report.comments.push({
            commentId: `C${Date.now()}`,
            author: author || req.user?.username || "unknown",
            text,
            likesCount: 0,
            dislikesCount: 0,
            likedBy: [],
            dislikedBy: [],
            createdAt: new Date(),
        });
        await report.save();
        res.json(report);
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

export default router;

import { Router, Request, Response } from "express";
import Report from "../models/Report";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/reports — list all
router.get("/", async (_req: Request, res: Response) => {
    try {
        const reports = await Report.find().sort({ createdAt: -1 });
        res.json({ data: reports });
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /api/reports — create (auth required)
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { reportId, category, detail, priority, owner } = req.body;
        const report = await Report.create({
            reportId: reportId || Date.now(),
            category,
            detail,
            priority: priority || "medium",
            owner: owner || req.user?.username,
            status: "รอรับเรื่อง",
        });
        res.status(201).json(report);
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// DELETE /api/reports/:id — delete (auth required)
router.delete("/:id", authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id;
        let report = await Report.findOneAndDelete({ reportId: Number(id) });
        if (!report) report = await Report.findByIdAndDelete(id);
        if (!report) { res.status(404).json({ error: true, message: "Report not found" }); return; }
        res.json({ message: "Deleted", id });
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// PUT /api/reports/:id/status — change status (auth required)
router.put("/:id/status", authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const report = await Report.findOneAndUpdate(
            { reportId: Number(req.params.id) },
            { status: req.body.status },
            { new: true }
        );
        if (!report) { res.status(404).json({ error: true, message: "Report not found" }); return; }
        res.json(report);
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// PUT /api/reports/:id/feedback — add feedback (auth required)
router.put("/:id/feedback", authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const report = await Report.findOneAndUpdate(
            { reportId: Number(req.params.id) },
            { feedback: req.body.feedback },
            { new: true }
        );
        if (!report) { res.status(404).json({ error: true, message: "Report not found" }); return; }
        res.json(report);
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /api/reports/:id/like — toggle like
router.post("/:id/like", async (req: Request, res: Response): Promise<void> => {
    try {
        const { username } = req.body;
        const report = await Report.findOne({ reportId: Number(req.params.id) });
        if (!report) { res.status(404).json({ error: true, message: "Report not found" }); return; }

        const idx = report.likedBy.indexOf(username);
        if (idx >= 0) {
            report.likedBy.splice(idx, 1);
            report.likesCount = Math.max(0, report.likesCount - 1);
        } else {
            report.likedBy.push(username);
            report.likesCount += 1;
            const dIdx = report.dislikedBy.indexOf(username);
            if (dIdx >= 0) { report.dislikedBy.splice(dIdx, 1); report.dislikesCount = Math.max(0, report.dislikesCount - 1); }
        }
        await report.save();
        res.json(report);
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /api/reports/:id/dislike — toggle dislike
router.post("/:id/dislike", async (req: Request, res: Response): Promise<void> => {
    try {
        const { username } = req.body;
        const report = await Report.findOne({ reportId: Number(req.params.id) });
        if (!report) { res.status(404).json({ error: true, message: "Report not found" }); return; }

        const idx = report.dislikedBy.indexOf(username);
        if (idx >= 0) {
            report.dislikedBy.splice(idx, 1);
            report.dislikesCount = Math.max(0, report.dislikesCount - 1);
        } else {
            report.dislikedBy.push(username);
            report.dislikesCount += 1;
            const lIdx = report.likedBy.indexOf(username);
            if (lIdx >= 0) { report.likedBy.splice(lIdx, 1); report.likesCount = Math.max(0, report.likesCount - 1); }
        }
        await report.save();
        res.json(report);
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /api/reports/:id/comment — add comment (auth required)
router.post("/:id/comment", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { author, text } = req.body;
        const report = await Report.findOne({ reportId: Number(req.params.id) });
        if (!report) { res.status(404).json({ error: true, message: "Report not found" }); return; }

        report.comments.push({
            author: author || req.user?.username || "unknown",
            text,
            createdAt: new Date(),
        });
        await report.save();
        res.json(report);
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

export default router;

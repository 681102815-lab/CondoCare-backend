import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "condocare_secret_key_2026";

// Default users — จะ seed ลง MongoDB ตอน server เริ่ม
const DEFAULT_USERS = [
    { userId: "U001", username: "admin", password: "1234", role: "admin", firstName: "Admin" },
    { userId: "U002", username: "tech", password: "1234", role: "tech", firstName: "ช่าง" },
    { userId: "U003", username: "resident", password: "1234", role: "resident", firstName: "ผู้พัก" },
];

// Seed users ลง MongoDB (ถ้ายังไม่มี)
export async function seedUsers() {
    for (const u of DEFAULT_USERS) {
        const exists = await User.findOne({ username: u.username });
        if (!exists) {
            await User.create(u);
            console.log(`  ✅ Seeded user: ${u.username} (${u.userId})`);
        }
    }
}

// GET /api/auth/users — ดูรายชื่อผู้ใช้ทั้งหมด (admin only)
router.get("/users", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== "admin") {
            res.status(403).json({ error: true, message: "เฉพาะ admin เท่านั้น" });
            return;
        }
        const users = await User.find({}, { password: 0 }); // ไม่ส่ง password
        res.json({ data: users });
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /api/auth/register — สมัครสมาชิก (admin only)
router.post("/register", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // ตรวจว่าเป็น admin
        if (req.user?.role !== "admin") {
            res.status(403).json({ error: true, message: "เฉพาะ admin เท่านั้นที่สร้าง user ได้" });
            return;
        }

        const { username, password, role, firstName } = req.body;

        if (!username || !password || !role) {
            res.status(400).json({ error: true, message: "กรุณากรอก username, password, role" });
            return;
        }

        // ถ้า resident → username ต้องเป็นเลขห้อง (ตัวเลขเท่านั้น)
        if (role === "resident" && !/^\d+$/.test(username)) {
            res.status(400).json({ error: true, message: "ชื่อผู้ใช้ผู้พักต้องเป็นเลขห้องเท่านั้น (เช่น 101, 205)" });
            return;
        }

        // ตรวจ username ซ้ำ
        const exists = await User.findOne({ username });
        if (exists) {
            res.status(409).json({ error: true, message: `username "${username}" ถูกใช้แล้ว` });
            return;
        }

        // สร้าง userId อัตโนมัติ
        const count = await User.countDocuments();
        const userId = `U${String(count + 1).padStart(3, "0")}`;

        const user = await User.create({
            userId,
            username,
            password,
            role,
            firstName: firstName || username,
        });

        res.status(201).json({
            message: "สร้าง user สำเร็จ",
            user: { userId: user.userId, username: user.username, role: user.role, firstName: user.firstName },
        });
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// PUT /api/auth/change-password — เปลี่ยนรหัสผ่าน (ทุก role)
router.put("/change-password", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            res.status(400).json({ error: true, message: "กรุณากรอกรหัสเก่าและรหัสใหม่" });
            return;
        }

        if (newPassword.length < 4) {
            res.status(400).json({ error: true, message: "รหัสใหม่ต้องมีอย่างน้อย 4 ตัวอักษร" });
            return;
        }

        const user = await User.findOne({ username: req.user?.username });
        if (!user) {
            res.status(404).json({ error: true, message: "ไม่พบ user" });
            return;
        }

        if (user.password !== oldPassword) {
            res.status(401).json({ error: true, message: "รหัสเก่าไม่ถูกต้อง" });
            return;
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// PUT /api/auth/update-name — เปลี่ยนชื่อแสดงผล (ทุก role, เปลี่ยน username ไม่ได้)
router.put("/update-name", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { firstName } = req.body;
        if (!firstName?.trim()) {
            res.status(400).json({ error: true, message: "กรุณากรอกชื่อใหม่" });
            return;
        }

        const user = await User.findOneAndUpdate(
            { username: req.user?.username },
            { firstName: firstName.trim() },
            { new: true }
        );
        if (!user) { res.status(404).json({ error: true, message: "ไม่พบ user" }); return; }

        res.json({ message: "เปลี่ยนชื่อสำเร็จ", firstName: user.firstName });
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// DELETE /api/auth/users/:userId — ลบ user (admin only)
router.delete("/users/:userId", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (req.user?.role !== "admin") {
            res.status(403).json({ error: true, message: "เฉพาะ admin เท่านั้น" });
            return;
        }

        const { userId } = req.params;

        // ห้ามลบตัวเอง
        const target = await User.findOne({ userId });
        if (!target) {
            res.status(404).json({ error: true, message: "ไม่พบ user" });
            return;
        }
        if (target.username === req.user?.username) {
            res.status(400).json({ error: true, message: "ไม่สามารถลบตัวเองได้" });
            return;
        }

        await User.deleteOne({ userId });
        res.json({ message: `ลบ user ${userId} สำเร็จ` });
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /api/auth/login — เข้าสู่ระบบ (ดึงจาก MongoDB)
router.post("/login", async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ error: true, message: "กรุณากรอก username และ password" });
        return;
    }

    const user = await User.findOne({ username, password });
    if (!user) {
        res.status(401).json({ error: true, message: "username หรือ password ไม่ถูกต้อง" });
        return;
    }

    const token = jwt.sign(
        { username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: "24h" }
    );

    res.json({
        token,
        user: {
            id: user.userId,
            userId: user.userId,
            username: user.username,
            role: user.role,
            firstName: user.firstName,
        },
    });
});

export default router;

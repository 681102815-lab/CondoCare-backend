import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "condocare_secret_key_2026";

const DEFAULT_USERS = [
    { userId: "U001", username: "admin", password: "160314", role: "admin", firstName: "Admin" },
    { userId: "U002", username: "tech", password: "pao270549", role: "tech", firstName: "ช่าง" },
    { userId: "U003", username: "resident", password: "mana160314", role: "resident", firstName: "ผู้พัก" },
];

export async function seedUsers() {
    for (const u of DEFAULT_USERS) {
        await User.findOneAndUpdate(
            { username: u.username },
            { $set: u },
            { upsert: true, new: true }
        );
        console.log(`  ✅ Seeded/updated user: ${u.username} (${u.userId})`);
    }
}

// GET /api/auth/users
router.get("/users", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== "admin") {
            res.status(403).json({ error: true, message: "เฉพาะ admin เท่านั้น" });
            return;
        }
        const users = await User.find({}, { password: 0 });
        res.json({ data: users });
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /api/auth/register
router.post("/register", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (req.user?.role !== "admin") {
            res.status(403).json({ error: true, message: "เฉพาะ admin เท่านั้นที่สร้าง user ได้" });
            return;
        }

        const { username, password, role, firstName } = req.body;

        if (!username || !password || !role) {
            res.status(400).json({ error: true, message: "กรุณากรอก username, password, role" });
            return;
        }

        if (password.length < 6) {
            res.status(400).json({ error: true, message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
            return;
        }

        if (role === "resident" && !/^\d+$/.test(username)) {
            res.status(400).json({ error: true, message: "ชื่อผู้ใช้ผู้พักต้องเป็นเลขห้องเท่านั้น (เช่น 101, 205)" });
            return;
        }

        const exists = await User.findOne({ username });
        if (exists) {
            res.status(409).json({ error: true, message: `username "${username}" ถูกใช้แล้ว — 1 ห้อง สามารถมีได้เพียง 1 บัญชี` });
            return;
        }

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
            credentials: { username: user.username, password },
        });
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// PUT /api/auth/users/:userId — แก้ไข user (admin only)
router.put("/users/:userId", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (req.user?.role !== "admin") {
            res.status(403).json({ error: true, message: "เฉพาะ admin เท่านั้น" });
            return;
        }

        const { userId } = req.params;
        const { firstName, role, username } = req.body;

        const user = await User.findOne({ userId });
        if (!user) { res.status(404).json({ error: true, message: "ไม่พบ user" }); return; }

        // ห้ามแก้ admin ตัวเอง role
        if (user.username === "admin" && role && role !== "admin") {
            res.status(400).json({ error: true, message: "ไม่สามารถเปลี่ยน role ของ admin หลักได้" });
            return;
        }

        if (firstName) user.firstName = firstName;
        if (role) user.role = role;
        if (username && username !== user.username) {
            const exists = await User.findOne({ username });
            if (exists) {
                res.status(409).json({ error: true, message: `username "${username}" ถูกใช้แล้ว` });
                return;
            }
            user.username = username;
        }

        await user.save();
        res.json({ message: "แก้ไข user สำเร็จ", user: { userId: user.userId, username: user.username, role: user.role, firstName: user.firstName } });
    } catch (err: any) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// PUT /api/auth/change-password
router.put("/change-password", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            res.status(400).json({ error: true, message: "กรุณากรอกรหัสเก่าและรหัสใหม่" });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ error: true, message: "รหัสใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" });
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

// PUT /api/auth/update-name
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

// DELETE /api/auth/users/:userId
router.delete("/users/:userId", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (req.user?.role !== "admin") {
            res.status(403).json({ error: true, message: "เฉพาะ admin เท่านั้น" });
            return;
        }

        const { userId } = req.params;

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

// POST /api/auth/login
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

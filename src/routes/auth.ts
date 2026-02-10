import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

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

// GET /api/auth/users — ดูรายชื่อผู้ใช้ทั้งหมด
router.get("/users", async (_req: Request, res: Response) => {
    try {
        const users = await User.find({}, { password: 0 }); // ไม่ส่ง password
        res.json({ data: users });
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

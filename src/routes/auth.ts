import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "condocare_secret_key_2026";

// Hardcoded users (same as frontend spec)
const USERS = [
    { username: "admin", password: "1234", role: "admin", firstName: "Admin" },
    { username: "tech", password: "1234", role: "tech", firstName: "ช่าง" },
    { username: "resident", password: "1234", role: "resident", firstName: "ผู้พัก" },
];

// POST /api/auth/login
router.post("/login", (req: Request, res: Response): void => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ error: true, message: "กรุณากรอก username และ password" });
        return;
    }

    const user = USERS.find((u) => u.username === username && u.password === password);
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
            id: user.username,
            username: user.username,
            role: user.role,
            firstName: user.firstName,
        },
    });
});

export default router;

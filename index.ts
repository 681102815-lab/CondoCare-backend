import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes, { seedUsers } from "./src/routes/auth";
import reportRoutes from "./src/routes/reports";

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/condocare";

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);

// Connect to MongoDB & start server
mongoose
    .connect(MONGODB_URI)
    .then(async () => {
        console.log("✅ MongoDB connected:", MONGODB_URI);

        // Seed default users ลง MongoDB
        console.log("📦 Seeding default users...");
        await seedUsers();

        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error("❌ MongoDB connection error:", err.message);
        app.listen(PORT, () => {
            console.log(`⚠️ Server running WITHOUT database on http://localhost:${PORT}`);
        });
    });

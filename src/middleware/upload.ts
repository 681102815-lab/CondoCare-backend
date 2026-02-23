import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { Request } from "express";

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer — store in memory, max 5MB per file, max 5 files
const storage = multer.memoryStorage();

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith("image/")) {
        cb(null, true);
    } else {
        cb(new Error("อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น (jpg, png, webp)"));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

// Upload buffer to Cloudinary → returns URL
export function uploadToCloudinary(buffer: Buffer, folder: string): Promise<string> {
    return new Promise((resolve, reject) => {
        cloudinary.uploader
            .upload_stream(
                {
                    folder: `condocare/${folder}`,
                    resource_type: "image",
                    transformation: [{ width: 1200, crop: "limit", quality: "auto" }],
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result!.secure_url);
                }
            )
            .end(buffer);
    });
}

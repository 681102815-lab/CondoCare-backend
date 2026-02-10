import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
    userId: string;       // คีย์หลัก
    username: string;
    password: string;
    role: string;         // admin | tech | resident
    firstName: string;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        userId: { type: String, required: true, unique: true },
        username: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        role: { type: String, required: true, enum: ["admin", "tech", "resident"] },
        firstName: { type: String, required: true },
    },
    { timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);

import mongoose, { Schema, Model } from 'mongoose';
import { IUserDocument } from '../types/user.types';

const userSchema = new Schema<IUserDocument>({
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    name: { type: String, required: true, trim: true },
    nameVerified: { type: Boolean, default: false },
    gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
    avatarUrl: String,
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    plan: { type: String, enum: ['free', 'premium', 'vip', 'viip'], default: 'free' },
    planExpiresAt: Date,
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    passwordHash: String,
    githubId: String,
    githubAccessToken: String,
}, { timestamps: true });

const User: Model<IUserDocument> = mongoose.models.User || mongoose.model<IUserDocument>('User', userSchema);

export default User;

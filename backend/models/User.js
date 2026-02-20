const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    name: { type: String, required: true, trim: true },
    nameVerified: { type: Boolean, default: false },
    avatarUrl: String,
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    plan: { type: String, enum: ['free', 'premium', 'vip', 'viip'], default: 'free' },
    planExpiresAt: Date,
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    passwordHash: String,
}, { timestamps: true });

// Check if model already exists before creating
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
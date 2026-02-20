const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isPrivate: { type: Boolean, default: false },
    roomCode: { type: String, unique: true, sparse: true }, // 6-digit code for private rooms
    memberCount: { type: Number, default: 0 },
    limits: { maxMembers: Number },
}, { timestamps: true });

// Check if model already exists before creating
module.exports = mongoose.models.Group || mongoose.model('Group', groupSchema);
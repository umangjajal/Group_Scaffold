const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    role: { type: String, enum: ['member', 'moderator', 'owner'], default: 'member' },
}, { timestamps: true, indexes: [{ user: 1, group: 1, unique: true }] });

// Check if model already exists before creating
module.exports = mongoose.models.Membership || mongoose.model('Membership', membershipSchema);
const mongoose = require('mongoose');

const quotaUsageSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    messagesSent: { type: Number, default: 0 },
}, { timestamps: true, indexes: [{ user: 1, date: 1, unique: true }] });

// Check if model already exists before creating
module.exports = mongoose.models.QuotaUsage || mongoose.model('QuotaUsage', quotaUsageSchema);
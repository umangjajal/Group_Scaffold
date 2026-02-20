const mongoose = require('mongoose');

const callQuotaSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  voiceSeconds: { type: Number, default: 0 },
  videoSeconds: { type: Number, default: 0 },
}, { indexes: [{ user: 1, date: 1, unique: true }]});

// Check if model already exists before creating
module.exports = mongoose.models.CallQuota || mongoose.model('CallQuota', callQuotaSchema);
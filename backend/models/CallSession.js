const mongoose = require('mongoose');
const callSessionSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  type: { type: String, enum: ['audio','video'], required: true },
  mode: { type: String, enum: ['p2p','sfu'], default: 'p2p' },
  isAnonymous: { type: Boolean, default: false },
  startedAt: Date,
  endedAt: Date,
  durationSec: Number,
  recordedUrl: String,
  status: { type: String, enum: ['ringing','active','ended','failed'], default: 'ringing' },
  metadata: mongoose.Mixed,
}, { timestamps: true });
module.exports = mongoose.models.CallSession || mongoose.model('CallSession', callSessionSchema);

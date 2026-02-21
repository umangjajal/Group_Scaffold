const mongoose = require('mongoose');

const collabVersionSchema = new mongoose.Schema({
  file: { type: mongoose.Schema.Types.ObjectId, ref: 'CollabFile', required: true, index: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  version: { type: Number, required: true },
  branch: { type: String, default: 'main' },
  parentVersion: { type: Number, default: null },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  patchSummary: { type: String, default: '' },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  restoredFrom: { type: Number, default: null },
}, { timestamps: true });

collabVersionSchema.index({ file: 1, version: 1 }, { unique: true });

module.exports = mongoose.models.CollabVersion || mongoose.model('CollabVersion', collabVersionSchema);

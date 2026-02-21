const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  line: { type: Number, default: null },
  resolved: { type: Boolean, default: false },
}, { timestamps: true });

const collabFileSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['document', 'code', 'spreadsheet'], required: true },
  content: { type: mongoose.Schema.Types.Mixed, default: {} },
  latestVersion: { type: Number, default: 1 },
  permissions: {
    editors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    approvalRequired: { type: Boolean, default: false },
  },
  comments: [commentSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

collabFileSchema.index({ group: 1, name: 1 }, { unique: true });

module.exports = mongoose.models.CollabFile || mongoose.model('CollabFile', collabFileSchema);

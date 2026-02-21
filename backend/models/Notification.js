const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  readAt: { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

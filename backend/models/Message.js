const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String },
    mediaUrl: String,
    reactions: [{ emoji: String, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }],
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

// Check if model already exists before creating
module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
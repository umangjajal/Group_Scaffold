// backend/models/RandomMatch.js
const mongoose = require('mongoose');

const randomMatchSchema = new mongoose.Schema({
    userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    filters: mongoose.Mixed, // gender, ageRange, interests
    createdAt: Date,
    acceptedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('RandomMatch', randomMatchSchema);
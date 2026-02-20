// backend/middleware/dailyMessageQuota.js
const Plans = require('../models/Plan');
const Quota = require('../models/QuotaUsage');

const day = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD format

module.exports = async (req, res, next) => {
    const p = Plans[req.user.plan];
    if (!p) return res.status(400).json({ error: 'Invalid plan' });

    const d = day();
    const rec = await Quota.findOneAndUpdate(
        { user: req.user.id, date: d },
        { $setOnInsert: { messagesSent: 0 } }, // Initialize if not exists
        { new: true, upsert: true } // Return new doc, create if not exists
    );

    if (rec.messagesSent >= p.dailyMessages) {
        return res.status(429).json({ error: 'Daily message quota exceeded' });
    }
    req._quotaDoc = rec; // Store the quota document for later increment
    next();
};
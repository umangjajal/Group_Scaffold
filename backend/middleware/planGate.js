// backend/middleware/planGate.js
const Plans = require('../models/Plan');
const Membership = require('../models/Membership');
const Group = require('../models/group'); // Make sure to require Group model

module.exports = {
    canCreateGroup: async (req, res, next) => {
        const p = Plans[req.user.plan];
        if (!p) return res.status(400).json({ error: 'Invalid plan' }); // Should not happen with valid plans

        const created = await Group.countDocuments({ owner: req.user.id });
        if (created >= p.maxGroupsCreate) {
            return res.status(402).json({ error: 'Upgrade required: Max groups created' });
        }
        next();
    },
    canJoinGroup: async (req, res, next) => {
        const p = Plans[req.user.plan];
        if (!p) return res.status(400).json({ error: 'Invalid plan' });

        const joined = await Membership.countDocuments({ user: req.user.id });
        if (joined >= p.maxGroupsJoin) {
            return res.status(402).json({ error: 'Upgrade required: Join limit reached' });
        }
        next();
    },
};
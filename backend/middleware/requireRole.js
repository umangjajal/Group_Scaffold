// backend/middleware/requireRole.js
module.exports = (role) => (req, res, next) => {
    if (!req.user || req.user.role !== role) {
        return res.status(403).json({ error: 'Forbidden: Insufficient role' });
    }
    next();
};
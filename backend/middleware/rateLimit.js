const buckets = new Map();

module.exports = function rateLimit({ windowMs = 60000, max = 120 } = {}) {
  return (req, res, next) => {
    const key = `${req.user?.id || req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please retry shortly.' });
    }

    return next();
  };
};

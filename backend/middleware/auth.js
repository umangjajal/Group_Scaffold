const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ error: "No token provided" });

  // Accept both "Bearer <token>" and "<token>"
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT verification error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

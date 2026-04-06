/**
 * Admin-only middleware. Must be used after auth middleware.
 */

function adminAuth(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

module.exports = { adminAuth };

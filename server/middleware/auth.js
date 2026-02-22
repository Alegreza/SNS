/**
 * JWT auth middleware.
 */

const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config");

function auth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = req.cookies && req.cookies.token;

  const t = token || cookieToken;
  if (!t) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const payload = jwt.verify(t, jwtSecret);
    req.userId = payload.userId;
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = req.cookies && req.cookies.token;
  const t = token || cookieToken;

  if (t) {
    try {
      const payload = jwt.verify(t, jwtSecret);
      req.userId = payload.userId;
      req.user = payload;
    } catch (_) {}
  }
  next();
}

module.exports = { auth, optionalAuth };

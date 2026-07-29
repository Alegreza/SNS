/**
 * CKSNS server: Express API + static frontend.
 * Run: node index.js (from server/) or npm start (from project root)
 */

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const rateLimit = require("express-rate-limit");
const pino = require("pino");
const pinoHttp = require("pino-http");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined
});
module.exports.logger = logger;

const config = require("./config");
const { initDb } = require("./db");
const authRoutes = require("./routes/auth");
const postRoutes = require("./routes/posts");
const adminRoutes = require("./routes/admin");
const commentRoutes = require("./routes/comments");
const notificationRoutes = require("./routes/notifications");

const app = express();

// Trust Render's proxy so req.ip reflects the real client IP
app.set("trust proxy", 1);

// CSP: script-src is kept strict (no unsafe-inline/unsafe-eval — that's where real
// XSS execution risk lives). style-src allows unsafe-inline as a deliberate trade-off:
// the app sets many dynamic inline styles via element.style.* throughout app.js, and
// refactoring all of those into stylesheet classes just for this is out of scope —
// CSS-only injection is a much lower-severity risk than script injection.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://accounts.google.com", "https://alcdn.msauth.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*.gstatic.com", "https://*.googleusercontent.com"],
      connectSrc: ["'self'", "https://accounts.google.com"],
      frameSrc: ["'self'", "https://accounts.google.com", "https://login.microsoftonline.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  // Third-party OAuth scripts (Google GIS, MSAL) aren't COEP-compatible, and MSAL's
  // login popup relies on window.opener access, which strict same-origin COOP breaks.
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

const allowedOrigins = [
  "https://cksns.live",
  "https://www.cksns.live",
  "http://localhost:3000"
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/health" } }));

// Extract real client IP from X-Forwarded-For (set by Render proxy)
app.use(function (req, _res, next) {
  const forwarded = req.headers["x-forwarded-for"];
  req.clientIp = forwarded ? forwarded.split(",")[0].trim() : req.ip;
  next();
});

// Rate limiting: 100 requests per 15 minutes on all API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

// API routes
app.use("/api/auth", authRoutes);
app.use("/api", postRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/posts/:id/comments", commentRoutes);
app.use("/api/notifications", notificationRoutes);

// Health check
app.get("/api/health", (_, res) => res.json({ ok: true }));

// Static files (frontend)
const staticRoot = path.join(__dirname, "..");
app.use(express.static(staticRoot));

// SPA fallback: serve index.html for non-API routes
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(staticRoot, "index.html"));
});

initDb()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`CKSNS server running at http://localhost:${config.port}`);
    });
  })
  .catch((err) => {
    console.error("DB init failed:", err);
    process.exit(1);
  });

/**
 * Kobe server: Express API + static frontend.
 * Run: node index.js (from server/) or npm start (from project root)
 */

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const path = require("path");

const config = require("./config");
const { initDb } = require("./db");
const authRoutes = require("./routes/auth");
const postRoutes = require("./routes/posts");
const adminRoutes = require("./routes/admin");
const commentRoutes = require("./routes/comments");
const notificationRoutes = require("./routes/notifications");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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
      console.log(`Kobe server running at http://localhost:${config.port}`);
    });
  })
  .catch((err) => {
    console.error("DB init failed:", err);
    process.exit(1);
  });

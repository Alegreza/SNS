/**
 * Kobe server: Express API + static frontend.
 * Run: node index.js (from server/) or npm start (from project root)
 */

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const path = require("path");

const config = require("./config");
const authRoutes = require("./routes/auth");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// API routes
app.use("/api/auth", authRoutes);

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

app.listen(config.port, () => {
  console.log(`Kobe server running at http://localhost:${config.port}`);
});

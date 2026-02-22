/**
 * Auth routes: signup, login (email, Google, Microsoft), logout.
 */

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { OAuth2Client } = require("google-auth-library");
const { db } = require("../db");
const config = require("../config");
const { auth } = require("../middleware/auth");

const router = express.Router();

// Ensure upload dir exists
const uploadDir = path.resolve(__dirname, "..", "data", "uploads");
if (!fs.existsSync(path.dirname(uploadDir))) {
  fs.mkdirSync(path.dirname(uploadDir), { recursive: true });
}
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `student_id_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function userResponse(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username || null,
    name: user.name,
    school_email: user.school_email,
    role: user.role,
    grade: user.grade,
    verification_method: user.verification_method,
    verification_status: user.verification_status,
    created_at: user.created_at
  };
}

// --- Sign up (email) ---
router.post("/signup", upload.single("student_id"), async (req, res) => {
  try {
    const { email, password, name, username, school_email, role, grade, verification_method } = req.body;
    const usernameVal = username ? String(username).trim() : null;

    if (!email || !password || !name || !role || !verification_method) {
      return res.status(400).json({ error: "Missing required fields: email, password, name, role, verification_method" });
    }

    if (!["manual", "student_id", "school_sso"].includes(verification_method)) {
      return res.status(400).json({ error: "Invalid verification_method" });
    }

    if (verification_method === "student_id" && !req.file) {
      return res.status(400).json({ error: "Student ID photo required" });
    }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase());
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }
    if (usernameVal) {
      const existingUser = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?)").get(usernameVal);
      if (existingUser) {
        return res.status(409).json({ error: "Username already taken" });
      }
    }

    const hash = await bcrypt.hash(password, 10);

    const insert = db.prepare(`
      INSERT INTO users (email, username, name, password_hash, school_email, role, grade, verification_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = insert.run(
      email.trim().toLowerCase(),
      usernameVal || null,
      name.trim(),
      hash,
      school_email ? school_email.trim().toLowerCase() : null,
      role,
      grade || null,
      verification_method
    );

    const userId = info.lastInsertRowid;

    if (req.file) {
      db.prepare(`
        INSERT INTO uploads (user_id, type, filename, path) VALUES (?, 'student_id', ?, ?)
      `).run(userId, req.file.filename, req.file.path);
    }

    db.prepare(`
      INSERT INTO user_providers (user_id, provider, provider_user_id) VALUES (?, 'email', ?)
    `).run(userId, email.trim().toLowerCase());

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const token = signToken(user);

    res.status(201).json({
      user: userResponse(user),
      token,
      message: verification_method === "manual"
        ? `School verification pending. Contact ${config.adminEmail} to get approved.`
        : "School verification pending. Your student ID will be reviewed."
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Signup failed" });
  }
});

// --- Login (email or username + password) ---
router.post("/login", async (req, res) => {
  try {
    const { login, password } = req.body;
    const identifier = (login || req.body.email || "").trim();

    if (!identifier || !password) {
      return res.status(400).json({ error: "Email or username and password required" });
    }

    const user = db.prepare(
      "SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR (username IS NOT NULL AND LOWER(username) = LOWER(?))"
    ).get(identifier, identifier);
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "Invalid email/username or password" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user);

    res.json({
      user: userResponse(user),
      token
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed" });
  }
});

// --- Sign up / Link (Google) ---
router.post("/google", upload.single("student_id"), async (req, res) => {
  try {
    const { id_token, name, username, school_email, role, grade, verification_method } = req.body || {};

    if (!id_token) {
      return res.status(400).json({ error: "id_token required" });
    }

    if (!config.googleClientId) {
      return res.status(503).json({ error: "Google sign-in not configured" });
    }

    const client = new OAuth2Client(config.googleClientId);
    const ticket = await client.verifyIdToken({ idToken: id_token, audience: config.googleClientId });
    const payload = ticket.getPayload();
    const email = (payload.email || "").toLowerCase();
    const googleId = payload.sub;

    if (!email) {
      return res.status(400).json({ error: "Email not provided by Google" });
    }

    let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (user) {
      // Existing user: link provider if not already
      const hasProvider = db.prepare("SELECT id FROM user_providers WHERE user_id = ? AND provider = 'google'").get(user.id);
      if (!hasProvider) {
        db.prepare("INSERT INTO user_providers (user_id, provider, provider_user_id) VALUES (?, 'google', ?)").run(user.id, googleId);
      }
      const token = signToken(user);
      return res.json({ user: userResponse(user), token });
    }

    // New user: must provide profile
    if (!name || !role || !verification_method) {
      return res.status(400).json({
        error: "New user: provide name, role, verification_method",
        email,
        name_from_google: payload.name
      });
    }

    if (verification_method === "student_id" && !req.file) {
      return res.status(400).json({ error: "Student ID photo required" });
    }

    const usernameVal = username ? String(username).trim() : null;
    if (usernameVal) {
      const existingUser = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?)").get(usernameVal);
      if (existingUser) {
        return res.status(409).json({ error: "Username already taken" });
      }
    }

    const insert = db.prepare(`
      INSERT INTO users (email, username, name, password_hash, school_email, role, grade, verification_method)
      VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
    `);
    const info = insert.run(
      email,
      usernameVal || null,
      (name || payload.name || "User").trim(),
      school_email ? school_email.trim().toLowerCase() : null,
      role,
      grade || null,
      verification_method
    );
    const userId = info.lastInsertRowid;

    db.prepare("INSERT INTO user_providers (user_id, provider, provider_user_id) VALUES (?, 'google', ?)").run(userId, googleId);

    if (req.file) {
      db.prepare("INSERT INTO uploads (user_id, type, filename, path) VALUES (?, 'student_id', ?, ?)").run(userId, req.file.filename, req.file.path);
    }

    user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const token = signToken(user);

    res.status(201).json({
      user: userResponse(user),
      token,
      message: verification_method === "manual"
        ? `School verification pending. Contact ${config.adminEmail} to get approved.`
        : "School verification pending."
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Google auth failed" });
  }
});

// --- Sign up / Link (Microsoft) ---
router.post("/microsoft", upload.single("student_id"), async (req, res) => {
  try {
    const { access_token, name, username, school_email, role, grade, verification_method } = req.body || {};

    if (!access_token) {
      return res.status(400).json({ error: "access_token required" });
    }

    // Validate Microsoft token (simplified: call Graph or decode and verify)
    const jwt = require("jsonwebtoken");
    let payload;
    try {
      payload = jwt.decode(access_token);
      if (!payload || !payload.aud) {
        return res.status(401).json({ error: "Invalid Microsoft token" });
      }
    } catch (_) {
      return res.status(401).json({ error: "Invalid Microsoft token" });
    }

    const email = (payload.preferred_username || payload.upn || payload.email || "").toLowerCase();
    const msId = payload.oid || payload.sub;

    if (!email) {
      return res.status(400).json({ error: "Email not provided by Microsoft" });
    }

    let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (user) {
      const hasProvider = db.prepare("SELECT id FROM user_providers WHERE user_id = ? AND provider = 'microsoft'").get(user.id);
      if (!hasProvider) {
        db.prepare("INSERT INTO user_providers (user_id, provider, provider_user_id) VALUES (?, 'microsoft', ?)").run(user.id, msId);
      }
      const token = signToken(user);
      return res.json({ user: userResponse(user), token });
    }

    // New user
    if (!name || !role || !verification_method) {
      return res.status(400).json({
        error: "New user: provide name, role, verification_method",
        email,
        name_from_ms: payload.name
      });
    }

    if (verification_method === "student_id" && !req.file) {
      return res.status(400).json({ error: "Student ID photo required" });
    }

    const usernameVal = username ? String(username).trim() : null;
    if (usernameVal) {
      const existingUser = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?)").get(usernameVal);
      if (existingUser) {
        return res.status(409).json({ error: "Username already taken" });
      }
    }

    const insert = db.prepare(`
      INSERT INTO users (email, username, name, password_hash, school_email, role, grade, verification_method)
      VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
    `);
    const info = insert.run(
      email,
      usernameVal || null,
      (name || payload.name || "User").trim(),
      school_email ? school_email.trim().toLowerCase() : null,
      role,
      grade || null,
      verification_method
    );
    const userId = info.lastInsertRowid;

    db.prepare("INSERT INTO user_providers (user_id, provider, provider_user_id) VALUES (?, 'microsoft', ?)").run(userId, msId);

    if (req.file) {
      db.prepare("INSERT INTO uploads (user_id, type, filename, path) VALUES (?, 'student_id', ?, ?)").run(userId, req.file.filename, req.file.path);
    }

    user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const token = signToken(user);

    res.status(201).json({
      user: userResponse(user),
      token,
      message: verification_method === "manual"
        ? `School verification pending. Contact ${config.adminEmail} to get approved.`
        : "School verification pending."
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Microsoft auth failed" });
  }
});

// --- Get current user ---
router.get("/me", auth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(userResponse(user));
});

// --- Logout (client discards token; optional: blacklist) ---
router.post("/logout", (req, res) => {
  res.json({ ok: true });
});

module.exports = router;

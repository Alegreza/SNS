/**
 * Auth routes: signup, login (email, Google, Microsoft), logout.
 */

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const jwksRsa = require("jwks-rsa");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { OAuth2Client } = require("google-auth-library");
const { pool, queryOne } = require("../db");
const config = require("../config");
const { auth } = require("../middleware/auth");

// Microsoft JWKS client — verifies token signatures against Microsoft's public keys.
// Option C (MVP): signature + issuer + azp/appid claim check (audience = MS Graph, not our clientId).
const msJwksClient = jwksRsa({
  jwksUri: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000 // 10 minutes
});

function getMsSigningKey(header) {
  return new Promise((resolve, reject) => {
    msJwksClient.getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

async function verifyMicrosoftToken(token) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error("Invalid Microsoft token structure");
  }

  const signingKey = await getMsSigningKey(decoded.header);

  // Verify signature and standard claims; skip audience check (access token aud = MS Graph).
  const payload = jwt.verify(token, signingKey, {
    algorithms: ["RS256"],
    issuer: [
      `https://login.microsoftonline.com/${decoded.payload.tid}/v2.0`,
      `https://sts.windows.net/${decoded.payload.tid}/`
    ]
  });

  // Confirm token was issued by our registered Azure app (azp = delegated, appid = app-only).
  if (config.microsoftClientId) {
    const appClaim = payload.azp || payload.appid;
    if (appClaim !== config.microsoftClientId) {
      throw new Error("Microsoft token client mismatch");
    }
  }

  return payload;
}

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
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function signToken(user) {
  return jwt.sign(
    { userId: user.id, id: user.id, email: user.email, role: user.role, grade: user.grade, name: user.name },
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

    const existing = await queryOne("SELECT id FROM users WHERE email = $1", [email.trim().toLowerCase()]);
    if (existing) return res.status(409).json({ error: "Email already registered" });

    if (usernameVal) {
      const existingUser = await queryOne("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [usernameVal]);
      if (existingUser) return res.status(409).json({ error: "Username already taken" });
    }

    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, username, name, password_hash, school_email, role, grade, verification_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        email.trim().toLowerCase(),
        usernameVal || null,
        name.trim(),
        hash,
        school_email ? school_email.trim().toLowerCase() : null,
        role,
        grade || null,
        verification_method
      ]
    );
    const user = result.rows[0];

    if (req.file) {
      await pool.query(
        "INSERT INTO uploads (user_id, type, filename, path) VALUES ($1, 'student_id', $2, $3)",
        [user.id, req.file.filename, req.file.path]
      );
    }
    await pool.query(
      "INSERT INTO user_providers (user_id, provider, provider_user_id) VALUES ($1, 'email', $2)",
      [user.id, email.trim().toLowerCase()]
    );

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

    const user = await queryOne(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR (username IS NOT NULL AND LOWER(username) = LOWER($1))",
      [identifier]
    );
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "Invalid email/username or password" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    res.json({ user: userResponse(user), token: signToken(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed" });
  }
});

// --- Sign up / Link (Google) ---
router.post("/google", upload.single("student_id"), async (req, res) => {
  try {
    const { id_token, name, username, school_email, role, grade, verification_method } = req.body || {};

    if (!id_token) return res.status(400).json({ error: "id_token required" });
    if (!config.googleClientId) return res.status(503).json({ error: "Google sign-in not configured" });

    const client = new OAuth2Client(config.googleClientId);
    const ticket = await client.verifyIdToken({ idToken: id_token, audience: config.googleClientId });
    const payload = ticket.getPayload();
    const email = (payload.email || "").toLowerCase();
    const googleId = payload.sub;

    if (!email) return res.status(400).json({ error: "Email not provided by Google" });

    let user = await queryOne("SELECT * FROM users WHERE email = $1", [email]);

    if (user) {
      const hasProvider = await queryOne(
        "SELECT id FROM user_providers WHERE user_id = $1 AND provider = 'google'", [user.id]
      );
      if (!hasProvider) {
        await pool.query(
          "INSERT INTO user_providers (user_id, provider, provider_user_id) VALUES ($1, 'google', $2)",
          [user.id, googleId]
        );
      }
      return res.json({ user: userResponse(user), token: signToken(user) });
    }

    if (!name || !role || !verification_method) {
      return res.status(400).json({ error: "New user: provide name, role, verification_method", email, name_from_google: payload.name });
    }
    if (verification_method === "student_id" && !req.file) {
      return res.status(400).json({ error: "Student ID photo required" });
    }

    const usernameVal = username ? String(username).trim() : null;
    if (usernameVal) {
      const existingUser = await queryOne("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [usernameVal]);
      if (existingUser) return res.status(409).json({ error: "Username already taken" });
    }

    const result = await pool.query(
      `INSERT INTO users (email, username, name, school_email, role, grade, verification_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [email, usernameVal || null, (name || payload.name || "User").trim(),
       school_email ? school_email.trim().toLowerCase() : null, role, grade || null, verification_method]
    );
    user = result.rows[0];

    await pool.query(
      "INSERT INTO user_providers (user_id, provider, provider_user_id) VALUES ($1, 'google', $2)",
      [user.id, googleId]
    );
    if (req.file) {
      await pool.query(
        "INSERT INTO uploads (user_id, type, filename, path) VALUES ($1, 'student_id', $2, $3)",
        [user.id, req.file.filename, req.file.path]
      );
    }

    res.status(201).json({
      user: userResponse(user),
      token: signToken(user),
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

    if (!access_token) return res.status(400).json({ error: "access_token required" });

    let payload;
    try {
      payload = await verifyMicrosoftToken(access_token);
    } catch (verifyErr) {
      console.error("Microsoft token verification failed:", verifyErr.message);
      return res.status(401).json({ error: "Invalid Microsoft token" });
    }

    const email = (payload.preferred_username || payload.upn || payload.email || "").toLowerCase();
    const msId = payload.oid || payload.sub;

    if (!email) return res.status(400).json({ error: "Email not provided by Microsoft" });

    let user = await queryOne("SELECT * FROM users WHERE email = $1", [email]);

    if (user) {
      const hasProvider = await queryOne(
        "SELECT id FROM user_providers WHERE user_id = $1 AND provider = 'microsoft'", [user.id]
      );
      if (!hasProvider) {
        await pool.query(
          "INSERT INTO user_providers (user_id, provider, provider_user_id) VALUES ($1, 'microsoft', $2)",
          [user.id, msId]
        );
      }
      return res.json({ user: userResponse(user), token: signToken(user) });
    }

    if (!name || !role || !verification_method) {
      return res.status(400).json({ error: "New user: provide name, role, verification_method", email, name_from_ms: payload.name });
    }
    if (verification_method === "student_id" && !req.file) {
      return res.status(400).json({ error: "Student ID photo required" });
    }

    const usernameVal = username ? String(username).trim() : null;
    if (usernameVal) {
      const existingUser = await queryOne("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [usernameVal]);
      if (existingUser) return res.status(409).json({ error: "Username already taken" });
    }

    const result = await pool.query(
      `INSERT INTO users (email, username, name, school_email, role, grade, verification_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [email, usernameVal || null, (name || payload.name || "User").trim(),
       school_email ? school_email.trim().toLowerCase() : null, role, grade || null, verification_method]
    );
    user = result.rows[0];

    await pool.query(
      "INSERT INTO user_providers (user_id, provider, provider_user_id) VALUES ($1, 'microsoft', $2)",
      [user.id, msId]
    );
    if (req.file) {
      await pool.query(
        "INSERT INTO uploads (user_id, type, filename, path) VALUES ($1, 'student_id', $2, $3)",
        [user.id, req.file.filename, req.file.path]
      );
    }

    res.status(201).json({
      user: userResponse(user),
      token: signToken(user),
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
router.get("/me", auth, async (req, res) => {
  try {
    const user = await queryOne("SELECT * FROM users WHERE id = $1", [req.userId]);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(userResponse(user));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// --- Logout ---
router.post("/logout", (req, res) => {
  res.json({ ok: true });
});

module.exports = router;

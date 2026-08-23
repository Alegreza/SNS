/**
 * Admin routes: user management, post oversight, space-teacher assignment.
 * All routes require admin role.
 */

const express = require("express");
const router = express.Router();
const { pool, query, queryOne } = require("../db");
const { auth } = require("../middleware/auth");
const { adminAuth } = require("../middleware/adminAuth");
const { sanitizeText } = require("../sanitize");

router.use(auth, adminAuth);

// ── Users ──────────────────────────────────────────────────────────────────

// GET /api/admin/users?status=pending|approved|rejected|all
router.get("/users", async (req, res) => {
  try {
    const { status = "all" } = req.query;
    let sql = `
      SELECT id, email, username, name, role, grade,
             verification_method, verification_status, created_at
      FROM users
    `;
    const params = [];
    if (status !== "all") {
      params.push(status);
      sql += ` WHERE verification_status = $1`;
    }
    sql += " ORDER BY created_at DESC";
    res.json(await query(sql, params));
  } catch (e) {
    req.log && req.log.error(e);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// PATCH /api/admin/users/:id/verify
router.patch("/users/:id/verify", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
    }

    const user = await queryOne("SELECT id, email FROM users WHERE id = $1", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });

    await pool.query(
      "UPDATE users SET verification_status = $1, updated_at = NOW() WHERE id = $2",
      [status, req.params.id]
    );
    req.log && req.log.info({ event: "admin_verify_user", targetUserId: Number(req.params.id), status, byAdminId: req.user.id });
    res.json({ ok: true, id: Number(req.params.id), verification_status: status });
  } catch (e) {
    req.log && req.log.error(e);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// PATCH /api/admin/users/:id — edit role and/or grade
router.patch("/users/:id", async (req, res) => {
  try {
    const { role, grade } = req.body;
    const validRoles = ["student", "teacher", "admin"];
    if (role !== undefined && !validRoles.includes(role)) {
      return res.status(400).json({ error: "role must be one of: " + validRoles.join(", ") });
    }
    const validGrades = ["9", "10", "11", "12"];
    if (grade !== undefined && grade !== null && grade !== "" && !validGrades.includes(String(grade))) {
      return res.status(400).json({ error: "grade must be one of: " + validGrades.join(", ") });
    }

    const user = await queryOne("SELECT id FROM users WHERE id = $1", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });

    const fields = [];
    const params = [];
    if (role !== undefined) { params.push(role); fields.push(`role = $${params.length}`); }
    if (grade !== undefined) { params.push(grade || null); fields.push(`grade = $${params.length}`); }
    if (!fields.length) return res.status(400).json({ error: "Nothing to update" });

    params.push(req.params.id);
    await pool.query(
      `UPDATE users SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${params.length}`,
      params
    );
    req.log && req.log.info({ event: "admin_edit_user", targetUserId: Number(req.params.id), role, grade, byAdminId: req.user.id });
    res.json({ ok: true, id: Number(req.params.id), role, grade });
  } catch (e) {
    req.log && req.log.error(e);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// ── Posts (admin view: real authors + IPs for anonymous) ───────────────────

// GET /api/admin/posts?spaceId=&section=&limit=&offset=
router.get("/posts", async (req, res) => {
  try {
    const { spaceId, section, limit = 50, offset = 0 } = req.query;
    let sql = "SELECT * FROM posts";
    const params = [];

    if (spaceId) {
      params.push(spaceId);
      sql += ` WHERE space_id = $${params.length}`;
      if (section) {
        params.push(section);
        sql += ` AND section = $${params.length}`;
      }
    } else if (section) {
      params.push(section);
      sql += ` WHERE section = $${params.length}`;
    }

    params.push(Number(limit));
    params.push(Number(offset));
    sql += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    // Admin gets full data including real author + IP for anonymous posts
    res.json(await query(sql, params));
  } catch (e) {
    req.log && req.log.error(e);
    res.status(500).json({ error: "Failed to load posts" });
  }
});

// DELETE /api/admin/posts/:id
router.delete("/posts/:id", async (req, res) => {
  try {
    const post = await queryOne("SELECT id, title, author_id FROM posts WHERE id = $1", [req.params.id]);
    if (!post) return res.status(404).json({ error: "Post not found" });

    await pool.query("DELETE FROM posts WHERE id = $1", [req.params.id]);
    req.log && req.log.info({ event: "admin_delete_post", postId: Number(req.params.id), byAdminId: req.user.id });
    res.json({ ok: true });
  } catch (e) {
    req.log && req.log.error(e);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// ── Space-Teacher Assignment ───────────────────────────────────────────────

const DEFAULT_SECTIONS = ["Announcements & Assignments", "Questions", "Anonymous / Vent"];

// spaces.sections is stored as a JSON-stringified array (or NULL for the app defaults)
function parseSpaceRow(row) {
  let sections = null;
  if (row.sections) {
    try { sections = JSON.parse(row.sections); } catch (e) { sections = null; }
  }
  return { ...row, sections: sections && sections.length ? sections : DEFAULT_SECTIONS };
}

function slugifyBoardName(name) {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "board";
}

// GET /api/admin/spaces — all spaces with assigned teacher list
router.get("/spaces", async (req, res) => {
  try {
    const spaces = await query("SELECT * FROM spaces ORDER BY type, name");
    const assignments = await query(
      `SELECT us.space_id, u.id, u.name, u.email
       FROM user_spaces us
       JOIN users u ON u.id = us.user_id
       WHERE u.role = 'teacher'`
    );
    const bySpace = {};
    assignments.forEach((a) => {
      if (!bySpace[a.space_id]) bySpace[a.space_id] = [];
      bySpace[a.space_id].push({ id: a.id, name: a.name, email: a.email });
    });
    res.json(spaces.map((s) => ({ ...parseSpaceRow(s), teachers: bySpace[s.id] || [] })));
  } catch (e) {
    req.log && req.log.error(e);
    res.status(500).json({ error: "Failed to load spaces" });
  }
});

// POST /api/admin/spaces — create a new board, optionally with custom categories
router.post("/spaces", async (req, res) => {
  try {
    const { name, type, grade, sections, postTemplate } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: "name is required" });
    if (!["class", "subject", "club"].includes(type)) {
      return res.status(400).json({ error: "type must be one of: class, subject, club" });
    }

    let gradeVal = null;
    if (type === "class" || type === "subject") {
      if (!["9", "10", "11", "12"].includes(String(grade))) {
        return res.status(400).json({ error: "grade must be one of: 9, 10, 11, 12 for class/subject boards" });
      }
      gradeVal = String(grade);
    }

    let cleanedSections = null;
    if (Array.isArray(sections)) {
      cleanedSections = sections.map((s) => String(s || "").trim()).filter(Boolean).slice(0, 8);
      if (!cleanedSections.length) cleanedSections = null;
    }
    const sectionsVal = cleanedSections ? JSON.stringify(cleanedSections) : null;

    const templateVal = postTemplate != null ? sanitizeText(postTemplate).slice(0, 5000) || null : null;

    const trimmedName = String(name).trim();
    let id = slugifyBoardName(trimmedName);
    let suffix = 1;
    while (await queryOne("SELECT id FROM spaces WHERE id = $1", [id])) {
      suffix += 1;
      id = `${slugifyBoardName(trimmedName)}-${suffix}`;
    }

    await pool.query(
      "INSERT INTO spaces (id, type, name, grade, sections, post_template) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, type, trimmedName, gradeVal, sectionsVal, templateVal]
    );
    req.log && req.log.info({ event: "admin_create_space", spaceId: id, type, grade: gradeVal, byAdminId: req.user.id });
    res.status(201).json({ id, type, name: trimmedName, grade: gradeVal, sections: cleanedSections || DEFAULT_SECTIONS, post_template: templateVal, teachers: [] });
  } catch (e) {
    req.log && req.log.error(e);
    res.status(500).json({ error: "Failed to create board" });
  }
});

// PATCH /api/admin/spaces/:spaceId/template — set or clear this board's default post template
router.patch("/spaces/:spaceId/template", async (req, res) => {
  try {
    const { spaceId } = req.params;
    const space = await queryOne("SELECT id FROM spaces WHERE id = $1", [spaceId]);
    if (!space) return res.status(404).json({ error: "Board not found" });

    const { template } = req.body;
    const templateVal = template != null ? sanitizeText(template).slice(0, 5000) || null : null;

    await pool.query("UPDATE spaces SET post_template = $1 WHERE id = $2", [templateVal, spaceId]);
    req.log && req.log.info({ event: "admin_set_space_template", spaceId, hasTemplate: !!templateVal, byAdminId: req.user.id });
    res.json({ ok: true, id: spaceId, post_template: templateVal });
  } catch (e) {
    req.log && req.log.error(e);
    res.status(500).json({ error: "Failed to update template" });
  }
});

// PUT /api/admin/spaces/:spaceId/teachers/:userId — assign teacher
router.put("/spaces/:spaceId/teachers/:userId", async (req, res) => {
  try {
    const { spaceId, userId } = req.params;
    const user = await queryOne("SELECT id, role FROM users WHERE id = $1", [userId]);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "teacher") return res.status(400).json({ error: "User is not a teacher" });

    await pool.query(
      "INSERT INTO user_spaces (user_id, space_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, spaceId]
    );
    req.log && req.log.info({ event: "admin_assign_teacher", userId: Number(userId), spaceId, byAdminId: req.user.id });
    res.json({ ok: true });
  } catch (e) {
    req.log && req.log.error(e);
    res.status(500).json({ error: "Failed to assign teacher" });
  }
});

// DELETE /api/admin/spaces/:spaceId/teachers/:userId — remove teacher
router.delete("/spaces/:spaceId/teachers/:userId", async (req, res) => {
  try {
    const { spaceId, userId } = req.params;
    await pool.query(
      "DELETE FROM user_spaces WHERE user_id = $1 AND space_id = $2",
      [userId, spaceId]
    );
    req.log && req.log.info({ event: "admin_remove_teacher", userId: Number(userId), spaceId, byAdminId: req.user.id });
    res.json({ ok: true });
  } catch (e) {
    req.log && req.log.error(e);
    res.status(500).json({ error: "Failed to remove teacher" });
  }
});

module.exports = router;

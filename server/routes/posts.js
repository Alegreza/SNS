const express = require("express");
const router = express.Router();
const { pool, query, queryOne } = require("../db");
const { auth } = require("../middleware/auth");

const SECTIONS = ["Announcements & Assignments", "Questions", "Anonymous / Vent"];
const STUDENT_ONLY_SECTIONS = ["Anonymous / Vent"];

// GET /api/spaces
router.get("/spaces", auth, async (req, res) => {
  try {
    const { grade } = req.query;
    let rows;
    if (req.user.role === "admin") {
      rows = await query("SELECT * FROM spaces");
    } else {
      rows = await query(
        `SELECT * FROM spaces WHERE type = 'club' OR (type IN ('class','subject') AND grade = $1)`,
        [grade || req.user.grade]
      );
    }
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load spaces" });
  }
});

// GET /api/posts?spaceId=&section=&limit=&offset=
router.get("/posts", auth, async (req, res) => {
  try {
    const { spaceId, section, limit = 30, offset = 0 } = req.query;
    if (!spaceId) return res.status(400).json({ error: "spaceId required" });

    let sql = "SELECT * FROM posts WHERE space_id = $1";
    const params = [spaceId];

    if (section) {
      params.push(section);
      sql += ` AND section = $${params.length}`;
    }

    params.push(Number(limit));
    params.push(Number(offset));
    sql += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const posts = await query(sql, params);
    const isPrivileged = req.user.role === "teacher" || req.user.role === "admin";
    const sanitized = posts.map((p) =>
      p.is_anonymous && !isPrivileged ? { ...p, author_name: "Anonymous", author_id: null } : p
    );
    res.json(sanitized);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load posts" });
  }
});

// GET /api/posts/feed
router.get("/posts/feed", auth, async (req, res) => {
  try {
    let spaceIds;
    if (req.user.role === "admin") {
      const rows = await query("SELECT id FROM spaces");
      spaceIds = rows.map((r) => r.id);
    } else {
      const rows = await query(
        `SELECT id FROM spaces WHERE type = 'club' OR (type IN ('class','subject') AND grade = $1)`,
        [req.user.grade]
      );
      spaceIds = rows.map((r) => r.id);
    }

    if (!spaceIds.length) return res.json([]);

    const placeholders = spaceIds.map((_, i) => `$${i + 1}`).join(",");
    const posts = await query(
      `SELECT * FROM posts WHERE space_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 20`,
      spaceIds
    );

    const isPrivileged = req.user.role === "teacher" || req.user.role === "admin";
    const sanitized = posts.map((p) =>
      p.is_anonymous && !isPrivileged ? { ...p, author_name: "Anonymous", author_id: null } : p
    );
    res.json(sanitized);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load feed" });
  }
});

// POST /api/posts
router.post("/posts", auth, async (req, res) => {
  try {
    const { spaceId, section, title, content, isAnonymous } = req.body;

    if (!spaceId || !section || !title || !content) {
      return res.status(400).json({ error: "spaceId, section, title, content required" });
    }
    if (!SECTIONS.includes(section)) {
      return res.status(400).json({ error: "Invalid section" });
    }
    if (STUDENT_ONLY_SECTIONS.includes(section) && req.user.role === "teacher") {
      return res.status(403).json({ error: "Teachers cannot post in this section" });
    }

    const space = await queryOne("SELECT id FROM spaces WHERE id = $1", [spaceId]);
    if (!space) return res.status(404).json({ error: "Space not found" });

    const anonymous = isAnonymous ? 1 : 0;
    const authorName = isAnonymous ? "Anonymous" : req.user.name;

    const result = await pool.query(
      `INSERT INTO posts (space_id, section, title, content, author_id, author_name, author_role, is_anonymous)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [spaceId, section, title, content, req.user.id, authorName, req.user.role, anonymous]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// DELETE /api/posts/:id
router.delete("/posts/:id", auth, async (req, res) => {
  try {
    const post = await queryOne("SELECT * FROM posts WHERE id = $1", [req.params.id]);
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (post.author_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    await pool.query("DELETE FROM posts WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

module.exports = router;

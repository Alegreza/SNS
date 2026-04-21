const express = require("express");
const router = express.Router({ mergeParams: true });
const { pool, query, queryOne } = require("../db");
const { auth } = require("../middleware/auth");

// GET /api/posts/:id/comments
router.get("/", auth, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const post = await queryOne("SELECT id, is_anonymous FROM posts WHERE id = $1", [postId]);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const comments = await query(
      "SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC",
      [postId]
    );

    const isAdmin = req.user.role === "admin";
    const sanitized = comments.map((c) =>
      c.is_anonymous && !isAdmin
        ? { ...c, author_name: "Anonymous", author_id: null, author_ip: null }
        : c
    );
    res.json(sanitized);
  } catch (e) {
    req.log && req.log.error(e);
    res.status(500).json({ error: "Failed to load comments" });
  }
});

// POST /api/posts/:id/comments
router.post("/", auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const postId = Number(req.params.id);
    const { content, isAnonymous } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "content required" });
    }

    const post = await queryOne(
      "SELECT id, author_id, title FROM posts WHERE id = $1",
      [postId]
    );
    if (!post) return res.status(404).json({ error: "Post not found" });

    const anonymous = isAnonymous ? 1 : 0;
    const authorName = isAnonymous ? "Anonymous" : req.user.name;
    const clientIp = req.clientIp || req.ip;

    await client.query("BEGIN");

    const commentResult = await client.query(
      `INSERT INTO comments (post_id, author_id, author_name, author_role, is_anonymous, content, author_ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [postId, req.user.id, authorName, req.user.role, anonymous, content.trim(), clientIp]
    );
    const comment = commentResult.rows[0];

    // Notify post author if different from commenter
    if (post.author_id && post.author_id !== req.user.id) {
      const actorLabel = isAnonymous ? "Someone" : req.user.name;
      const msg = `${actorLabel} commented on your post "${post.title}"`;
      await client.query(
        `INSERT INTO notifications (user_id, type, post_id, actor_name, message)
         VALUES ($1, 'comment', $2, $3, $4)`,
        [post.author_id, postId, actorLabel, msg]
      );
    }

    await client.query("COMMIT");

    req.log && req.log.info({ event: "comment_created", commentId: comment.id, postId, userId: req.user.id, isAnonymous: anonymous });

    // Return sanitized version to non-admins
    const isAdmin = req.user.role === "admin";
    res.status(201).json(
      comment.is_anonymous && !isAdmin
        ? { ...comment, author_name: "Anonymous", author_id: null, author_ip: null }
        : comment
    );
  } catch (e) {
    await client.query("ROLLBACK");
    req.log && req.log.error(e);
    res.status(500).json({ error: "Failed to post comment" });
  } finally {
    client.release();
  }
});

module.exports = router;

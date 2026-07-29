const express = require("express");
const router = express.Router({ mergeParams: true });
const { pool, query, queryOne } = require("../db");
const { auth } = require("../middleware/auth");
const { sanitizeText } = require("../sanitize");

// Give each distinct anonymous commenter a stable per-thread number ("Anonymous 1",
// "Anonymous 2", ...) instead of an indistinguishable "Anonymous" for everyone —
// lets readers follow a conversation between anonymous commenters without revealing
// who anyone actually is. Sequenced by order of first comment in this thread
// (comments must already be in created_at ASC order).
function sanitizeAnonymousComments(comments, isAdmin) {
  const anonSeq = new Map();
  let nextSeq = 1;
  return comments.map((c) => {
    if (!c.is_anonymous || isAdmin) return c;
    let label = "Anonymous";
    if (c.author_id != null) {
      if (!anonSeq.has(c.author_id)) anonSeq.set(c.author_id, nextSeq++);
      label = "Anonymous " + anonSeq.get(c.author_id);
    }
    return { ...c, author_name: label, author_id: null, author_ip: null };
  });
}

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
    res.json(sanitizeAnonymousComments(comments, isAdmin));
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
    const { isAnonymous } = req.body;
    const content = sanitizeText(req.body.content);

    if (!content) {
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
      [postId, req.user.id, authorName, req.user.role, anonymous, content, clientIp]
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

    // Re-derive the same per-thread anonymous numbering the GET list uses, so a
    // freshly-posted anonymous comment shows "Anonymous N" immediately instead of
    // plain "Anonymous" until the next reload.
    const isAdmin = req.user.role === "admin";
    const allComments = await query(
      "SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC",
      [postId]
    );
    const sanitized = sanitizeAnonymousComments(allComments, isAdmin);
    const responseComment = sanitized.find((c) => c.id === comment.id) || comment;
    res.status(201).json(responseComment);
  } catch (e) {
    await client.query("ROLLBACK");
    req.log && req.log.error(e);
    res.status(500).json({ error: "Failed to post comment" });
  } finally {
    client.release();
  }
});

module.exports = router;

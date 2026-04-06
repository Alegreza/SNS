const express = require("express");
const router = express.Router();
const { pool, query, queryOne } = require("../db");
const { auth } = require("../middleware/auth");

// GET /api/notifications
router.get("/", auth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY is_read ASC, created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

// PATCH /api/notifications/read-all
router.patch("/read-all", auth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE notifications SET is_read = 1 WHERE user_id = $1 AND is_read = 0",
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", auth, async (req, res) => {
  try {
    const notif = await queryOne(
      "SELECT id FROM notifications WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (!notif) return res.status(404).json({ error: "Not found" });

    await pool.query("UPDATE notifications SET is_read = 1 WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

module.exports = router;

/**
 * Admin routes: user listing and verification.
 */

const express = require("express");
const router = express.Router();
const { pool, query, queryOne } = require("../db");
const { auth } = require("../middleware/auth");
const { adminAuth } = require("../middleware/adminAuth");

router.use(auth, adminAuth);

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
    console.error(e);
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

    const user = await queryOne("SELECT id FROM users WHERE id = $1", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });

    await pool.query(
      "UPDATE users SET verification_status = $1, updated_at = NOW() WHERE id = $2",
      [status, req.params.id]
    );
    res.json({ ok: true, id: Number(req.params.id), verification_status: status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update user" });
  }
});

module.exports = router;

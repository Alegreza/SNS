/**
 * PostgreSQL database setup (Supabase).
 * Exports: query(sql, params), queryOne(sql, params), run(sql, params), pool, initDb()
 */

const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function query(sql, params) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function queryOne(sql, params) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

async function run(sql, params) {
  return pool.query(sql, params);
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT,
      school_email TEXT,
      role TEXT NOT NULL CHECK(role IN ('student','teacher','admin')),
      grade TEXT,
      verification_method TEXT NOT NULL CHECK(verification_method IN ('manual','student_id','school_sso')),
      verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending','approved','rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_providers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK(provider IN ('google','microsoft','email')),
      provider_user_id TEXT,
      UNIQUE(user_id, provider)
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'student_id',
      filename TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('class','subject','club')),
      name TEXT NOT NULL,
      grade TEXT
    );

    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      section TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      is_anonymous INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      is_anonymous INTEGER NOT NULL DEFAULT 0,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'comment',
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      actor_name TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_user_providers_user ON user_providers(user_id);
    CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id);
    CREATE INDEX IF NOT EXISTS idx_posts_space ON posts(space_id, section);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
  `);

  // Seed default spaces
  const defaultSpaces = [
    { id: "grade-9",         type: "class",   name: "Grade 9",          grade: "9"  },
    { id: "grade-10",        type: "class",   name: "Grade 10",         grade: "10" },
    { id: "grade-11",        type: "class",   name: "Grade 11",         grade: "11" },
    { id: "grade-12",        type: "class",   name: "Grade 12",         grade: "12" },
    { id: "subject-9-math1", type: "subject", name: "Math I (Grade 9)", grade: "9"  },
    { id: "club-band",       type: "club",    name: "Band Club",        grade: null },
  ];
  for (const s of defaultSpaces) {
    await pool.query(
      "INSERT INTO spaces (id, type, name, grade) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
      [s.id, s.type, s.name, s.grade]
    );
  }

  // Seed admin account (email: admin, password: admin) — change before production
  const existing = await queryOne("SELECT id FROM users WHERE email = $1", ["admin"]);
  if (!existing) {
    const hash = await bcrypt.hash("admin", 10);
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, role, verification_method, verification_status)
       VALUES ($1, $2, $3, 'admin', 'manual', 'approved') RETURNING id`,
      ["admin", "Admin", hash]
    );
    const userId = result.rows[0].id;
    await pool.query(
      "INSERT INTO user_providers (user_id, provider, provider_user_id) VALUES ($1, 'email', $2)",
      [userId, "admin"]
    );
  }

  console.log("DB initialized");
}

module.exports = { pool, query, queryOne, run, initDb };

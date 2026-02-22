/**
 * SQLite database setup and schema.
 */

const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "kobe.db");
const db = new Database(dbPath);

// Enable foreign keys
db.pragma("foreign_keys = ON");

function hasColumn(table, col) {
  return db.prepare("PRAGMA table_info(" + table + ")").all().some((c) => c.name === col);
}

function addUsernameColumn() {
  if (hasColumn("users", "username")) return;
  db.exec("ALTER TABLE users ADD COLUMN username TEXT");
}

function migrateUsersTable() {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasClassNumber = columns.some((c) => c.name === "class_number");
  if (!hasClassNumber) return;

  db.pragma("foreign_keys = OFF");
  db.exec(`
    CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT,
      school_email TEXT,
      role TEXT NOT NULL CHECK(role IN ('student','teacher','admin')),
      grade TEXT,
      verification_method TEXT NOT NULL CHECK(verification_method IN ('manual','student_id','school_sso')),
      verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending','approved','rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO users_new (id, email, name, password_hash, school_email, role, grade, verification_method, verification_status, created_at, updated_at)
    SELECT id, email, name, password_hash, school_email, role, grade, verification_method, verification_status, created_at, updated_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);
  db.pragma("foreign_keys = ON");
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      username TEXT UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT,
      school_email TEXT,
      role TEXT NOT NULL CHECK(role IN ('student','teacher','admin')),
      grade TEXT,
      verification_method TEXT NOT NULL CHECK(verification_method IN ('manual','student_id','school_sso')),
      verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending','approved','rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK(provider IN ('google','microsoft','email')),
      provider_user_id TEXT,
      UNIQUE(user_id, provider)
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'student_id',
      filename TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_user_providers_user ON user_providers(user_id);
    CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id);
  `);

  migrateUsersTable();
  addUsernameColumn();
  if (hasColumn("users", "username")) {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL");
  }

  // Seed admin account if not exists (email: admin, password: admin)
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get("admin");
  if (!existing) {
    const hash = bcrypt.hashSync("admin", 10);
    const info = db.prepare(`
      INSERT INTO users (email, name, password_hash, role, verification_method, verification_status)
      VALUES (?, ?, ?, 'admin', 'manual', 'approved')
    `).run("admin", "Admin", hash);
    db.prepare(`
      INSERT INTO user_providers (user_id, provider, provider_user_id) VALUES (?, 'email', ?)
    `).run(info.lastInsertRowid, "admin");
  }
}

initDb();

module.exports = { db };

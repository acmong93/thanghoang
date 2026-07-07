/**
 * Tầng database — dùng node:sqlite có sẵn trong Node.js >= 22.5 (không cần native build).
 * File DB: data/rose.db (tự tạo lần đầu, gitignore).
 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'rose.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS albums (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  tag        TEXT NOT NULL DEFAULT '',
  desc       TEXT NOT NULL DEFAULT '',
  category   TEXT NOT NULL DEFAULT 'wedding',  -- wedding | signature | phong-su
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id   INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  file       TEXT NOT NULL,   -- đường dẫn tương đối trong /img hoặc /uploads
  thumb      TEXT NOT NULL DEFAULT '',
  alt        TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_cover   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_images_album ON images(album_id, sort_order);

CREATE TABLE IF NOT EXISTS pricing (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  tag        TEXT NOT NULL DEFAULT '',
  intro      TEXT NOT NULL DEFAULT '',
  hero       TEXT NOT NULL DEFAULT '',
  tiers_json TEXT NOT NULL DEFAULT '[]',  -- [{name, price, note, highlight, items:[]}]
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT UNIQUE NOT NULL,
  title      TEXT NOT NULL,
  cat        TEXT NOT NULL DEFAULT '',
  date       TEXT NOT NULL DEFAULT '',
  cover      TEXT NOT NULL DEFAULT '',
  excerpt    TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',   -- các đoạn cách nhau bằng dòng trống
  visible    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS leads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  service    TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'new',  -- new | contacted | done
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS videos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  youtube_id TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS vips (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,               -- VD: Cầu thủ A & B
  tag        TEXT NOT NULL DEFAULT '',    -- VD: Pre-Wedding 2026
  image      TEXT NOT NULL DEFAULT '',
  album_slug TEXT NOT NULL DEFAULT '',    -- liên kết tới album nếu có
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible    INTEGER NOT NULL DEFAULT 1
);
`);

/* ---------- helpers ---------- */
const get = (sql, ...args) => db.prepare(sql).get(...args);
const all = (sql, ...args) => db.prepare(sql).all(...args);
const run = (sql, ...args) => db.prepare(sql).run(...args);

const setting = key => (get('SELECT value FROM settings WHERE key = ?', key) || {}).value || '';
const setSetting = (key, value) =>
  run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, String(value ?? ''));

function allSettings() {
  const out = {};
  for (const row of all('SELECT key, value FROM settings')) out[row.key] = row.value;
  return out;
}

/* Đảm bảo tài khoản admin tồn tại (tạo từ .env lần đầu) */
function ensureAdmin() {
  const user = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASSWORD || 'rosewedding';
  const existing = get('SELECT id FROM users WHERE username = ?', user);
  if (!existing) {
    run('INSERT INTO users(username, password_hash) VALUES(?,?)', user, bcrypt.hashSync(pass, 10));
    console.log(`[db] Đã tạo tài khoản quản trị "${user}"`);
  }
}

module.exports = { db, get, all, run, setting, setSetting, allSettings, ensureAdmin };

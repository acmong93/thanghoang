/**
 * Tầng database — dùng node:sqlite có sẵn trong Node.js >= 22.5 (không cần native build).
 * File DB: data/rose.db (tự tạo lần đầu, gitignore).
 * Đặt biến môi trường DATA_DIR để chuyển dữ liệu ra ngoài thư mục app
 * (VD một thư mục không bị xoá khi hosting deploy lại).
 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'rose.db');
fs.mkdirSync(DATA_DIR, { recursive: true });

const SCHEMA = `
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
  quote      TEXT NOT NULL DEFAULT '',    -- cảm nhận ngắn của khách
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible    INTEGER NOT NULL DEFAULT 1
);
`;

function openDb() {
  const d = new DatabaseSync(DB_PATH);
  d.exec('PRAGMA journal_mode = WAL;');
  d.exec('PRAGMA foreign_keys = ON;');
  d.exec(SCHEMA);
  /* Migration cho database tạo trước khi có cột quote */
  try { d.exec("ALTER TABLE vips ADD COLUMN quote TEXT NOT NULL DEFAULT ''"); } catch (e) { /* đã có */ }
  /* Migration: vị trí hiển thị khi ảnh bị cắt (object-position, VD '50% 30%') */
  try { d.exec("ALTER TABLE images ADD COLUMN pos TEXT NOT NULL DEFAULT '50% 50%'"); } catch (e) { /* đã có */ }
  try { d.exec("ALTER TABLE vips ADD COLUMN pos TEXT NOT NULL DEFAULT '50% 50%'"); } catch (e) { /* đã có */ }
  return d;
}

let db = openDb();

/* Gom dữ liệu WAL về file .db chính (gọi trước khi sao lưu để file luôn đầy đủ) */
function checkpoint() {
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
}

/* Đóng rồi mở lại database — dùng khi khôi phục bản sao lưu (thay file .db đang mở) */
function reopenDb(fn) {
  db.close();
  try {
    fn(); // thao tác trên file db khi đã đóng (VD: chép đè bản sao lưu)
  } finally {
    for (const suffix of ['-wal', '-shm']) fs.rmSync(DB_PATH + suffix, { force: true });
    db = openDb();
  }
}

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

/* Đảm bảo tài khoản admin tồn tại (tạo từ .env lần đầu).
   Khi ADMIN_PASSWORD được đặt trong môi trường, mật khẩu luôn đồng bộ theo đó:
   đổi biến môi trường rồi khởi động lại là đổi được mật khẩu (kể cả khi quên). */
function ensureAdmin() {
  const user = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASSWORD || 'rosewedding';
  const existing = get('SELECT id, password_hash FROM users WHERE username = ?', user);
  if (!existing) {
    run('INSERT INTO users(username, password_hash) VALUES(?,?)', user, bcrypt.hashSync(pass, 10));
    console.log(`[db] Đã tạo tài khoản quản trị "${user}"`);
  } else if (process.env.ADMIN_PASSWORD && !bcrypt.compareSync(pass, existing.password_hash)) {
    run('UPDATE users SET password_hash = ? WHERE id = ?', bcrypt.hashSync(pass, 10), existing.id);
    console.log(`[db] Đã cập nhật mật khẩu quản trị "${user}" theo ADMIN_PASSWORD`);
  }
}

module.exports = {
  get db() { return db; }, // getter để luôn trả instance hiện hành (sau reopenDb)
  DATA_DIR, DB_PATH, checkpoint, reopenDb,
  get, all, run, setting, setSetting, allSettings, ensureAdmin
};

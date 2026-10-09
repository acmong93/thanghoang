/**
 * Lưu phiên đăng nhập admin vào file SQLite riêng (DATA_DIR/sessions.db) thay cho bộ nhớ RAM:
 * deploy hay hosting khởi động lại không còn đăng xuất anh Thắng.
 * File riêng nên không lọt vào bản sao lưu (chỉ chứa rose.db + uploads) và không bị khôi phục đè.
 * Không có touch(): phiên hết hạn cứng 8 giờ sau đăng nhập (đúng hạn cookie), không tự kéo dài.
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const session = require('express-session');
const { DATA_DIR } = require('./db');

const PRUNE_EVERY_MS = 60 * 60 * 1000;
const FALLBACK_TTL_MS = 8 * 60 * 60 * 1000;

class SqliteSessionStore extends session.Store {
  constructor({ file = path.join(DATA_DIR, 'sessions.db'), now = () => Date.now() } = {}) {
    super();
    this.file = file;
    this.now = now;
    try {
      this.open();
    } catch (e) {
      /* Phiên chỉ là dữ liệu tạm: file hỏng thì cất sang bên cạnh rồi mở file mới, web vẫn chạy */
      console.error('[session] sessions.db lỗi, tạo file mới:', e.message);
      const bad = `${file}.bad-${this.now()}`;
      for (const sfx of ['', '-wal', '-shm']) {
        try { fs.renameSync(file + sfx, bad + sfx); } catch (_) { /* file phụ có thể không tồn tại */ }
      }
      this.open();
    }
    this.prune();
    setInterval(() => this.prune(), PRUNE_EVERY_MS).unref();
  }

  open() {
    const db = new DatabaseSync(this.file);
    try {
      db.exec('PRAGMA busy_timeout = 3000;');
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expires INTEGER NOT NULL)');
      this.sql = {
        get: db.prepare('SELECT sess, expires FROM sessions WHERE sid = ?'),
        set: db.prepare('INSERT INTO sessions(sid, sess, expires) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires'),
        destroy: db.prepare('DELETE FROM sessions WHERE sid = ?'),
        prune: db.prepare('DELETE FROM sessions WHERE expires <= ?'),
        clear: db.prepare('DELETE FROM sessions')
      };
    } catch (e) {
      try { db.close(); } catch (_) { /* đóng để đổi tên được file trên Windows */ }
      throw e;
    }
    this.db = db;
  }

  expiresOf(sess) {
    const c = (sess && sess.cookie) || {};
    if (c.expires) return new Date(c.expires).getTime();
    if (c.maxAge) return this.now() + c.maxAge;
    return this.now() + FALLBACK_TTL_MS;
  }

  get(sid, cb) {
    try {
      const row = this.sql.get.get(sid);
      if (!row) return cb(null, null);
      if (row.expires <= this.now()) { this.sql.destroy.run(sid); return cb(null, null); }
      cb(null, JSON.parse(row.sess));
    } catch (e) { cb(e); }
  }

  set(sid, sess, cb = () => {}) {
    try { this.sql.set.run(sid, JSON.stringify(sess), this.expiresOf(sess)); cb(null); } catch (e) { cb(e); }
  }

  destroy(sid, cb = () => {}) {
    try { this.sql.destroy.run(sid); cb(null); } catch (e) { cb(e); }
  }

  /* Đăng xuất mọi phiên (VD khi đổi mật khẩu quản trị) */
  clear(cb = () => {}) {
    try { this.sql.clear.run(); cb(null); } catch (e) { cb(e); }
  }

  prune() {
    try { this.sql.prune.run(this.now()); } catch (e) { console.error('[session]', e.message); }
  }
}

module.exports = { SqliteSessionStore };

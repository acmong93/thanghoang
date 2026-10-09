/**
 * Lưu phiên đăng nhập admin vào file SQLite riêng (DATA_DIR/sessions.db) thay cho bộ nhớ RAM:
 * deploy hay hosting khởi động lại không còn đăng xuất anh Thắng.
 * File riêng nên không lọt vào bản sao lưu (chỉ chứa rose.db + uploads) và không bị khôi phục đè.
 */
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const session = require('express-session');
const { DATA_DIR } = require('./db');

const PRUNE_EVERY_MS = 60 * 60 * 1000;
const FALLBACK_TTL_MS = 8 * 60 * 60 * 1000;

class SqliteSessionStore extends session.Store {
  constructor({ file = path.join(DATA_DIR, 'sessions.db'), now = () => Date.now() } = {}) {
    super();
    this.now = now;
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expires INTEGER NOT NULL)');
    this.sql = {
      get: this.db.prepare('SELECT sess, expires FROM sessions WHERE sid = ?'),
      set: this.db.prepare('INSERT INTO sessions(sid, sess, expires) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires'),
      touch: this.db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?'),
      destroy: this.db.prepare('DELETE FROM sessions WHERE sid = ?'),
      prune: this.db.prepare('DELETE FROM sessions WHERE expires <= ?')
    };
    this.prune();
    setInterval(() => this.prune(), PRUNE_EVERY_MS).unref();
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

  touch(sid, sess, cb = () => {}) {
    try { this.sql.touch.run(this.expiresOf(sess), sid); cb(null); } catch (e) { cb(e); }
  }

  destroy(sid, cb = () => {}) {
    try { this.sql.destroy.run(sid); cb(null); } catch (e) { cb(e); }
  }

  prune() {
    try { this.sql.prune.run(this.now()); } catch (e) { console.error('[session]', e.message); }
  }
}

module.exports = { SqliteSessionStore };

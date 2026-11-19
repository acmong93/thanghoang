/**
 * Các cỡ ảnh trung gian cho kho concept (480 / 800 / 1280px, WebP q78).
 * Trình duyệt chọn đúng cỡ theo màn hình qua srcset, nên điện thoại và máy tính không phải
 * tải bản 1600px cho một ô chỉ rộng vài trăm pixel. Bản 1600px (file gốc) giữ cho phóng to.
 * 1280 (không phải 1200) để iPhone Pro Max màn 3x vẫn đủ nét mà không phải tải bản gốc.
 *
 * Nơi lưu: UPLOADS_DIR/_v/<đường dẫn ảnh gốc>-<cỡ>.webp (VD /uploads/_v/img/concepts/ao-dai/01-800.webp).
 * Thư mục uploads nằm ngoài app nên sống sót qua deploy; ảnh tạo một lần là dùng mãi.
 * Cột images.sizes = "<các cỡ>@<mã nội dung ảnh gốc>" (VD "480,800,1280@1a2b3c4d"): mã đổi khi ảnh gốc
 * bị ghi đè cùng tên → tạo lại các cỡ, và mã đi kèm URL (?v=) để trình duyệt/CDN không giữ ảnh cũ.
 * Trống thì trang dùng lại thumb + bản gốc. Bản sao lưu bỏ qua thư mục _v (tạo lại được).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VARIANT_WIDTHS = [480, 800, 1280];
const QUALITY = 78;
const ROOT = path.join(__dirname, '..');
const UPLOAD_DIR = process.env.UPLOADS_DIR || path.join(ROOT, 'public', 'uploads');
const VARIANT_DIR = path.join(UPLOAD_DIR, '_v');

/* Đường dẫn web của một cỡ */
function variantUrl(file, w, sig) {
  return '/uploads/_v' + String(file).replace(/\.webp$/i, `-${w}.webp`) + (sig ? `?v=${sig}` : '');
}

/* Đường dẫn file thật trên máy chủ của một ảnh web (/img/... trong public, /uploads/... trong UPLOADS_DIR) */
function absOf(webPath) {
  const p = String(webPath || '');
  const base = p.startsWith('/uploads/') ? UPLOAD_DIR : path.join(ROOT, 'public');
  const rel = p.startsWith('/uploads/') ? p.slice('/uploads/'.length) : p.replace(/^\/+/, '');
  const abs = path.resolve(base, rel);
  return abs.startsWith(path.resolve(base) + path.sep) ? abs : null;
}

function variantAbs(file, w) {
  const abs = path.resolve(VARIANT_DIR, '.' + String(file).replace(/\.webp$/i, `-${w}.webp`));
  return abs.startsWith(path.resolve(VARIANT_DIR) + path.sep) ? abs : null;
}

/* Các cỡ cần có cho một ảnh: nhỏ hơn bề ngang ảnh gốc */
const wantedWidths = w => VARIANT_WIDTHS.filter(v => !w || v < w);

/* "480,800,1280@sig" → { widths: [480, 800, 1280], sig } */
function parseSizes(s) {
  const [list, sig] = String(s || '').split('@');
  return { widths: String(list || '').split(',').map(Number).filter(Boolean), sig: sig || '' };
}

/* srcset cho thẻ <img>: các cỡ đã tạo + bản gốc; chưa có cỡ nào thì thumb 640 + bản gốc */
function srcsetFor(im) {
  if (!im || !im.file) return '';
  const fullW = im.w || 1600;
  const { widths, sig } = parseSizes(im.sizes);
  if (widths.length) return widths.map(w => `${variantUrl(im.file, w, sig)} ${w}w`).concat(`${im.file} ${fullW}w`).join(', ');
  return im.thumb ? `${im.thumb} 640w, ${im.file} ${fullW}w` : '';
}

/* Tạo các cỡ còn thiếu (hoặc tạo lại khi ảnh gốc đã đổi nội dung), trả chuỗi sizes mới ("" nếu không làm được).
   Đọc ảnh gốc vào bộ nhớ: không để thư viện ảnh giữ khoá file gốc (Windows) hay trả điểm ảnh cũ từ bộ đệm */
async function ensureFor(im, sharp) {
  if (!/\.webp$/i.test(im.file || '')) return '';
  const src = absOf(im.file);
  if (!src || !fs.existsSync(src)) return '';
  const buf = fs.readFileSync(src);
  const sig = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
  const changed = parseSizes(im.sizes).sig !== sig;
  const done = [];
  for (const w of wantedWidths(im.w)) {
    const out = variantAbs(im.file, w);
    if (!out) return '';
    if (changed || !fs.existsSync(out)) {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const tmp = out + '.tmp';
      await sharp(buf, { failOn: 'none' }).resize({ width: w, withoutEnlargement: true })
        .webp({ quality: QUALITY, effort: 5 }).toFile(tmp);
      fs.renameSync(tmp, out); /* ghi xong mới đổi tên: không bao giờ phục vụ file dở dang */
    }
    done.push(w);
  }
  return done.length ? `${done.join(',')}@${sig}` : '';
}

/* Xoá các cỡ của một ảnh (khi xoá / thay ảnh) */
function removeFor(file) {
  for (const w of VARIANT_WIDTHS) {
    const p = variantAbs(file, w);
    if (p) fs.rm(p, { force: true }, () => {});
  }
}

const conceptRows = db => db.all(`SELECT i.id, i.file, i.thumb, i.w, i.sizes FROM images i
  JOIN albums a ON a.id = i.album_id WHERE a.category IN ('concept', 'baogia')`);

/* Kiểm tra nhanh (chỉ xem file có tồn tại, không tạo ảnh): ảnh nào thiếu cỡ thì xoá sizes để trang
   dùng lại thumb + bản gốc, KHÔNG BAO GIỜ trỏ tới file không có (VD vừa khôi phục sao lưu sang máy chủ mới,
   hoặc thư mục _v bị xoá). Chạy đồng bộ lúc khởi động, sau khôi phục và đầu mỗi lượt tạo. */
function reconcile() {
  const db = require('./db');
  let fixed = 0;
  for (const im of conceptRows(db)) {
    if (!im.sizes) continue;
    const have = parseSizes(im.sizes).widths;
    const want = wantedWidths(im.w);
    const ok = want.length === have.length && want.every(w => have.includes(w)) &&
      want.every(w => { const p = variantAbs(im.file, w); return p && fs.existsSync(p); });
    if (!ok) { db.run("UPDATE images SET sizes = '' WHERE id = ?", im.id); fixed++; }
  }
  if (fixed) console.log(`[variants] ${fixed} ảnh concept thiếu cỡ trung gian, tạm dùng bản thường cho tới khi tạo xong`);
  return fixed;
}

/* Rà toàn bộ ảnh concept: tạo bù cỡ còn thiếu, ghi lại sizes.
   Chạy nền từng ảnh một (không giành CPU của khách đang xem web); gọi chồng thì gộp làm một lượt sau. */
let running = false;
let again = false;
async function syncConcepts() {
  if (running) { again = true; return; }
  running = true;
  try {
    do {
      again = false;
      const db = require('./db');
      const sharp = require('sharp');
      reconcile();
      let made = 0;
      for (const im of conceptRows(db)) {
        let sizes = '';
        try {
          /* Ảnh vừa bị thay/xoá trong lúc đang chạy: bỏ qua, lượt sau (đã xếp hàng) xử lý */
          const cur = db.get('SELECT file, sizes FROM images WHERE id = ?', im.id);
          if (!cur || cur.file !== im.file) continue;
          sizes = await ensureFor(cur.sizes === im.sizes ? im : { ...im, sizes: cur.sizes }, sharp);
          if (sizes && sizes !== (cur.sizes || '')) made++;
        } catch (e) {
          console.error('[variants]', im.file, e.message);
        }
        const r = db.run('UPDATE images SET sizes = ? WHERE id = ? AND file = ? AND sizes != ?', sizes, im.id, im.file, sizes);
        /* Ảnh đã bị thay/xoá đúng lúc vừa tạo xong: dọn các cỡ vừa tạo cho file không còn dùng */
        if (r.changes === 0 && !db.get('SELECT 1 FROM images WHERE file = ?', im.file)) removeFor(im.file);
      }
      if (made) console.log(`[variants] Đã tạo cỡ ảnh trung gian cho ${made} ảnh concept`);
    } while (again);
  } finally {
    running = false;
  }
}

/* Gọi không chờ (sau upload, khởi động, khôi phục sao lưu) */
function queueSync(delayMs = 0) {
  setTimeout(() => { syncConcepts().catch(e => console.error('[variants]', e.message)); }, delayMs).unref();
}

module.exports = { VARIANT_WIDTHS, variantUrl, srcsetFor, parseSizes, absOf, removeFor, reconcile, syncConcepts, queueSync, wantedWidths };

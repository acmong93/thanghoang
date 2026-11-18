/**
 * Kho concept không công khai: chỉ ai có link riêng (Rosé gửi cho khách khi tư vấn) mới xem được.
 * - Link gửi khách: /concept?k=<mã> (hoặc /concept/<hạng mục>?k=<mã>#concept-12).
 * - Mở đúng mã: trình duyệt nhớ quyền xem (cookie 180 ngày, chỉ cho /concept); các đường dẫn bên trong
 *   kho concept cũng mang kèm mã, nên vẫn xem được ở trình duyệt chặn cookie (trong Zalo/Facebook).
 * - Không có mã/cookie hợp lệ: trả trang 404 như thể không tồn tại. Admin đã đăng nhập luôn xem được.
 * - Đổi mã trong Admin → Concept = vô hiệu mọi link và cookie cũ.
 * Luôn kèm noindex + no-store: Google không lập chỉ mục, CDN không lưu bản trang có nội dung cho người khác.
 */
const crypto = require('crypto');

const COOKIE = 'rose_concept';
const MAX_AGE = 180 * 24 * 60 * 60 * 1000;

function db() { return require('./db'); }

function key() {
  let k = db().setting('concept_key');
  if (!k) {
    k = crypto.randomBytes(9).toString('base64url');
    db().setSetting('concept_key', k);
  }
  return k;
}

function rotate() {
  const k = crypto.randomBytes(9).toString('base64url');
  db().setSetting('concept_key', k);
  return k;
}

const same = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { return ''; }
    }
  }
  return '';
}

/* Trang 404 chuẩn của web (như thể /concept không tồn tại) */
function notFound(res) {
  res.status(404).render('404', { s: db().allSettings(), page: '404' });
}

/* Gắn trước router công khai: app.use('/concept', gate) */
function gate(req, res, next) {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Cache-Control', 'private, no-store');
  res.locals.noindex = true;
  const k = key();

  let ok = false;
  if (req.query.k !== undefined) {
    if (!same(req.query.k, k)) return notFound(res);
    /* Nhớ quyền xem; nhưng KHÔNG chỉ dựa vào cookie (trình duyệt trong Zalo/Facebook có thể chặn):
       mọi đường dẫn trong kho concept đều mang kèm ?k= (conceptQs) */
    res.cookie(COOKIE, k, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: MAX_AGE, path: '/concept' });
    ok = true;
  } else if (same(readCookie(req, COOKIE), k) || (req.session && req.session.user)) {
    ok = true;
  }
  if (!ok) return notFound(res);
  res.locals.conceptKey = k; /* nút Zalo chép kèm link xem được */
  res.locals.conceptQs = '?k=' + encodeURIComponent(k);
  return next();
}

module.exports = { gate, key, rotate, COOKIE };

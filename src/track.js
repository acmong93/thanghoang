/**
 * Thống kê truy cập tự vận hành (first-party analytics).
 * Nguyên tắc: ẩn danh tuyệt đối — không IP, không tên, không định danh cá nhân.
 * - trackMiddleware: ghi mỗi lượt xem trang (bỏ qua admin, file tĩnh, bot)
 * - router POST /track: nhận sự kiện bấm nút liên hệ từ main.js (sendBeacon)
 */
const express = require('express');
const crypto = require('crypto');
const { run } = require('./db');

const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|curl|wget|python-requests|headless/i;
const VID_RE = /(?:^|;\s*)rw_vid=([a-f0-9]{16,32})/;

/* Kênh liên hệ hợp lệ (chống rác từ request tự chế) */
const CONTACT_CHANNELS = new Set(['zalo', 'messenger', 'call', 'booking', 'facebook', 'instagram', 'tiktok', 'youtube']);

/* Suy nguồn truy cập từ tên miền trang giới thiệu khi không có utm_source */
function srcFromRef(refDomain) {
  if (!refDomain) return '';
  if (/facebook\.|fb\.com|m\.me/.test(refDomain)) return 'facebook';
  if (/instagram\./.test(refDomain)) return 'instagram';
  if (/tiktok\./.test(refDomain)) return 'tiktok';
  if (/google\./.test(refDomain)) return 'google';
  if (/zalo\./.test(refDomain)) return 'zalo';
  if (/youtube\.|youtu\.be/.test(refDomain)) return 'youtube';
  if (/bing\./.test(refDomain)) return 'bing';
  if (/coccoc\./.test(refDomain)) return 'coccoc';
  return 'khac';
}

function deviceOf(ua) {
  return /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop';
}

/* Lấy (hoặc cấp mới) mã khách ẩn danh trong cookie — chỉ là chuỗi ngẫu nhiên */
function visitorId(req, res) {
  const m = VID_RE.exec(req.headers.cookie || '');
  if (m) return m[1];
  const vid = crypto.randomBytes(8).toString('hex');
  res.append('Set-Cookie', `rw_vid=${vid}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`);
  return vid;
}

function trackMiddleware(req, res, next) {
  try {
    if (req.method !== 'GET') return next();
    const p = req.path;
    // Chỉ đếm trang nội dung: bỏ admin, endpoint track, file tĩnh, sitemap...
    if (p.startsWith('/admin') || p.startsWith('/track') || /\.[a-z0-9]{2,5}$/i.test(p)) return next();
    const ua = String(req.headers['user-agent'] || '');
    if (!ua || BOT_RE.test(ua)) return next();

    const vid = visitorId(req, res);
    let ref = '';
    try {
      const r = new URL(req.headers.referer || '');
      if (r.hostname !== req.hostname) ref = r.hostname.replace(/^www\./, '');
    } catch (e) { /* không có referer */ }
    const q = req.query || {};
    const src = String(q.utm_source || srcFromRef(ref)).slice(0, 40).toLowerCase();
    run(
      'INSERT INTO hits(kind, path, ref, src, medium, campaign, device, vid) VALUES(?,?,?,?,?,?,?,?)',
      'view', p.slice(0, 160), ref.slice(0, 80), src,
      String(q.utm_medium || '').slice(0, 40).toLowerCase(),
      String(q.utm_campaign || '').slice(0, 60).toLowerCase(),
      deviceOf(ua), vid
    );
  } catch (e) { /* thống kê không bao giờ được làm hỏng trang */ }
  next();
}

const router = express.Router();
/* sendBeacon gửi text/plain — đọc raw rồi tự parse */
router.post('/', express.text({ type: '*/*', limit: '1kb' }), (req, res) => {
  try {
    const ua = String(req.headers['user-agent'] || '');
    if (ua && !BOT_RE.test(ua)) {
      let c = '';
      try { c = String(JSON.parse(req.body || '{}').c || ''); } catch (e) { /* bỏ qua */ }
      if (CONTACT_CHANNELS.has(c)) {
        const m = VID_RE.exec(req.headers.cookie || '');
        run(
          'INSERT INTO hits(kind, path, label, device, vid) VALUES(?,?,?,?,?)',
          'contact', String(req.headers.referer || '').slice(0, 160), c, deviceOf(ua), m ? m[1] : ''
        );
      }
    }
  } catch (e) { /* nuốt lỗi */ }
  res.status(204).end();
});

module.exports = { trackMiddleware, trackRouter: router };

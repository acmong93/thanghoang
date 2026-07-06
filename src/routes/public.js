const express = require('express');
const { all, get, run, allSettings } = require('../db');
const { sendBookingNotification } = require('../mailer');

const router = express.Router();

/* Dữ liệu dùng chung cho mọi trang */
function base() {
  return { s: allSettings() };
}
const coverOf = albumId =>
  get('SELECT file, thumb FROM images WHERE album_id = ? ORDER BY is_cover DESC, sort_order LIMIT 1', albumId) || {};

function albumsWithCover(category, limit) {
  const rows = all(
    `SELECT * FROM albums WHERE visible = 1 ${category ? 'AND category = ?' : ''} ORDER BY sort_order${limit ? ` LIMIT ${limit}` : ''}`,
    ...(category ? [category] : [])
  );
  return rows.map(a => ({ ...a, cover: coverOf(a.id) }));
}

/* ============ TRANG CHỦ ============ */
router.get('/', (req, res) => {
  res.render('index', {
    ...base(), page: 'home',
    weddingAlbums: albumsWithCover('wedding', 6),
    signatureAlbums: albumsWithCover('signature'),
    videos: all('SELECT * FROM videos WHERE visible = 1 ORDER BY sort_order'),
    pricing: all('SELECT slug, name, tag FROM pricing WHERE visible = 1 ORDER BY sort_order')
  });
});

/* ============ ẢNH CƯỚI (danh sách album) ============ */
router.get('/anh-cuoi', (req, res) => {
  res.render('anh-cuoi', {
    ...base(), page: 'anh-cuoi',
    weddingAlbums: albumsWithCover('wedding'),
    signatureAlbums: albumsWithCover('signature')
  });
});

/* ============ ALBUM CHI TIẾT ============ */
router.get('/album/:slug', (req, res, next) => {
  const album = get('SELECT * FROM albums WHERE slug = ? AND visible = 1', req.params.slug);
  if (!album) return next();
  const images = all('SELECT * FROM images WHERE album_id = ? ORDER BY sort_order', album.id);
  const others = albumsWithCover(album.category).filter(a => a.id !== album.id).slice(0, 3);
  res.render('album', { ...base(), page: 'album', album, images, others });
});

/* ============ BẢNG GIÁ ============ */
router.get('/bang-gia/:slug?', (req, res, next) => {
  const slug = req.params.slug || 'anh-cuoi';
  const current = get('SELECT * FROM pricing WHERE slug = ? AND visible = 1', slug);
  if (!current) return next();
  current.tiers = JSON.parse(current.tiers_json || '[]');
  res.render('bang-gia', {
    ...base(), page: 'bang-gia',
    current,
    tabs: all('SELECT slug, name, tag FROM pricing WHERE visible = 1 ORDER BY sort_order')
  });
});

/* ============ VÁY CƯỚI ============ */
router.get('/vay-cuoi', (req, res) => {
  const album = get("SELECT * FROM albums WHERE slug = 'sac-rose'");
  const images = album ? all('SELECT * FROM images WHERE album_id = ? ORDER BY sort_order LIMIT 12', album.id) : [];
  res.render('vay-cuoi', { ...base(), page: 'vay-cuoi', images });
});

/* ============ CÂU CHUYỆN ============ */
router.get('/cau-chuyen', (req, res) => {
  res.render('cau-chuyen', { ...base(), page: 'cau-chuyen' });
});

/* ============ TIN TỨC ============ */
router.get('/tin-tuc', (req, res) => {
  res.render('tin-tuc', {
    ...base(), page: 'tin-tuc',
    posts: all('SELECT * FROM posts WHERE visible = 1 ORDER BY created_at DESC, id DESC')
  });
});

router.get('/tin-tuc/:slug', (req, res, next) => {
  const post = get('SELECT * FROM posts WHERE slug = ? AND visible = 1', req.params.slug);
  if (!post) return next();
  const others = all('SELECT slug, title, cover, cat, date FROM posts WHERE visible = 1 AND id != ? ORDER BY created_at DESC LIMIT 3', post.id);
  res.render('post', { ...base(), page: 'tin-tuc', post, others });
});

/* ============ ĐẶT LỊCH ============ */
router.post('/api/booking', async (req, res) => {
  const { name, phone, service, message } = req.body || {};
  if (!name || !phone || String(name).trim().length < 2) {
    return res.status(400).json({ ok: false, error: 'Vui lòng nhập họ tên và số điện thoại.' });
  }
  if (!/^[0-9+\s().-]{8,15}$/.test(String(phone).trim())) {
    return res.status(400).json({ ok: false, error: 'Số điện thoại chưa đúng định dạng.' });
  }
  const lead = {
    name: String(name).trim().slice(0, 120),
    phone: String(phone).trim().slice(0, 20),
    service: String(service || '').trim().slice(0, 120),
    message: String(message || '').trim().slice(0, 2000)
  };
  run('INSERT INTO leads(name, phone, service, message) VALUES(?,?,?,?)',
    lead.name, lead.phone, lead.service, lead.message);

  sendBookingNotification(lead).catch(err => console.error('[mail]', err.message));
  res.json({ ok: true });
});

module.exports = router;

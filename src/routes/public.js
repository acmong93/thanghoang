const express = require('express');
const { all, get, run, allSettings } = require('../db');
const { sendBookingNotification } = require('../mailer');

const router = express.Router();

/* Dữ liệu dùng chung cho mọi trang */
function base() {
  return { s: allSettings() };
}
const coverOf = albumId =>
  get('SELECT file, thumb, pos FROM images WHERE album_id = ? ORDER BY is_cover DESC, sort_order LIMIT 1', albumId) || {};

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
    vips: all('SELECT * FROM vips WHERE visible = 1 ORDER BY sort_order'),
    videos: all('SELECT * FROM videos WHERE visible = 1 ORDER BY sort_order'),
    /* Trang chủ lược bớt thẻ Váy cưới cho gọn (trang bảng giá vẫn đủ) */
    pricing: all("SELECT slug, name, tag FROM pricing WHERE visible = 1 AND slug != 'vay-cuoi' ORDER BY sort_order")
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

/* ============ CONCEPT: hub cho khách xem khi tư vấn online ============ */
router.get('/concept', (req, res) => {
  /* Chỉ hiện concept đã có ảnh — concept vừa tạo chưa upload không lộ thẻ rỗng ra trang khách */
  const rows = all("SELECT * FROM albums WHERE visible = 1 AND category = 'concept' ORDER BY sort_order")
    .map(a => ({ ...a, cover: coverOf(a.id), count: get('SELECT COUNT(*) n FROM images WHERE album_id = ?', a.id).n }))
    .filter(a => a.count > 0);
  /* Gom theo nhóm, giữ đúng thứ tự sort_order (kéo thả trong admin quyết định tất cả) */
  const groups = [];
  for (const a of rows) {
    let g = groups.find(x => x.name === a.grp);
    if (!g) { g = { name: a.grp, concepts: [] }; groups.push(g); }
    g.concepts.push(a);
  }
  res.render('concept', { ...base(), page: 'concept', groups, total: rows.length });
});

router.get('/concept/:slug', (req, res, next) => {
  const album = get("SELECT * FROM albums WHERE slug = ? AND visible = 1 AND category = 'concept'", req.params.slug);
  if (!album) return next();
  const images = all('SELECT * FROM images WHERE album_id = ? ORDER BY sort_order', album.id);
  const others = all(
    `SELECT * FROM albums WHERE visible = 1 AND category = 'concept' AND id != ?
     AND EXISTS(SELECT 1 FROM images WHERE album_id = albums.id)
     ORDER BY (grp = ?) DESC, sort_order LIMIT 3`,
    album.id, album.grp
  ).map(a => ({ ...a, cover: coverOf(a.id) }));
  res.render('concept-detail', { ...base(), page: 'concept', album, images, others });
});

/* ============ ALBUM CHI TIẾT ============ */
router.get('/album/:slug', (req, res, next) => {
  const album = get('SELECT * FROM albums WHERE slug = ? AND visible = 1', req.params.slug);
  if (!album) return next();
  /* Concept có trang xem riêng đẹp hơn — chuyển hướng để không trùng nội dung */
  if (album.category === 'concept') return res.redirect(301, '/concept/' + album.slug);
  const images = all('SELECT * FROM images WHERE album_id = ? ORDER BY sort_order', album.id);
  const others = albumsWithCover(album.category).filter(a => a.id !== album.id).slice(0, 3);
  album.cover = coverOf(album.id);
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

/* ============ PHÓNG SỰ (danh sách album) ============ */
router.get('/phong-su', (req, res) => {
  res.render('phong-su', {
    ...base(), page: 'phong-su',
    albums: albumsWithCover('phong-su')
  });
});

/* ============ CÂU CHUYỆN ============ */
router.get('/cau-chuyen', (req, res) => {
  // Trang portfolio render sẵn trong public/img/portfolio (scripts/render-portfolio.js)
  const fs = require('fs');
  const path = require('path');
  let portfolio = [];
  try {
    portfolio = fs.readdirSync(path.join(__dirname, '..', '..', 'public', 'img', 'portfolio'))
      .filter(f => f.endsWith('.webp')).sort().map(f => '/img/portfolio/' + f);
  } catch (e) { /* chưa render portfolio */ }
  res.render('cau-chuyen', { ...base(), page: 'cau-chuyen', portfolio });
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
  const { renderPostBody } = require('../post-render');
  res.render('post', { ...base(), page: 'tin-tuc', post, others, bodyHtml: renderPostBody(post.body) });
});

/* ============ SEO: ROBOTS & SITEMAP ============ */
router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nDisallow: /admin\n\nSitemap: ${res.locals.baseUrl}/sitemap.xml\n`
  );
});

router.get('/sitemap.xml', (req, res) => {
  const urls = ['/', '/anh-cuoi', '/phong-su', '/vay-cuoi', '/cau-chuyen', '/tin-tuc', '/concept'];
  all('SELECT slug FROM pricing WHERE visible = 1 ORDER BY sort_order').forEach(p => urls.push(`/bang-gia/${p.slug}`));
  all(`SELECT slug, category FROM albums WHERE visible = 1
       AND (category != 'concept' OR EXISTS(SELECT 1 FROM images WHERE album_id = albums.id))
       ORDER BY sort_order`)
    .forEach(a => urls.push(a.category === 'concept' ? `/concept/${a.slug}` : `/album/${a.slug}`));
  all('SELECT slug FROM posts WHERE visible = 1 ORDER BY created_at DESC').forEach(p => urls.push(`/tin-tuc/${p.slug}`));
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => `  <url><loc>${res.locals.baseUrl}${u}</loc></url>`).join('\n') +
    '\n</urlset>';
  res.type('application/xml').send(xml);
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

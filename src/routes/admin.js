const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const sharp = require('sharp');
const bcrypt = require('bcryptjs');
const AdmZip = require('adm-zip');
const { all, get, run, allSettings, setSetting, DB_PATH, checkpoint, reopenDb, ensureAdmin } = require('../db');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 40 },
  fileFilter: (req, file, cb) => cb(null, /image\/(jpe?g|png|webp)/.test(file.mimetype))
});

/* Đặt biến môi trường UPLOADS_DIR để chuyển ảnh upload ra ngoài thư mục app
   (VD một thư mục không bị xoá khi hosting deploy lại) */
const UPLOAD_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'public', 'uploads');

/* ---------- Auth ---------- */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect('/admin/login');
}

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = get('SELECT * FROM users WHERE username = ?', String(username || '').trim());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).render('admin/login', { error: 'Sai tên đăng nhập hoặc mật khẩu.' });
  }
  req.session.user = { id: user.id, username: user.username };
  res.redirect('/admin');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

router.use(requireAuth);

/* Biến chung cho mọi view admin */
router.use((req, res, next) => {
  res.locals.user = req.session.user;
  res.locals.path = req.path;
  next();
});

/* ---------- Dashboard ---------- */
router.get('/', (req, res) => {
  res.render('admin/dashboard', {
    counts: {
      albums: get('SELECT COUNT(*) n FROM albums').n,
      images: get('SELECT COUNT(*) n FROM images').n,
      posts: get('SELECT COUNT(*) n FROM posts').n,
      leadsNew: get("SELECT COUNT(*) n FROM leads WHERE status = 'new'").n
    },
    recentLeads: all('SELECT * FROM leads ORDER BY id DESC LIMIT 6')
  });
});

/* ---------- Albums ---------- */
router.get('/albums', (req, res) => {
  const albums = all(`
    SELECT a.*, COUNT(i.id) AS img_count,
      (SELECT thumb FROM images WHERE album_id = a.id ORDER BY is_cover DESC, sort_order LIMIT 1) AS cover
    FROM albums a LEFT JOIN images i ON i.album_id = a.id
    GROUP BY a.id ORDER BY a.sort_order`);
  res.render('admin/albums', { albums });
});

router.post('/albums', (req, res) => {
  const { name, slug, tag, category } = req.body;
  const cleanSlug = String(slug || name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!name || !cleanSlug) return res.redirect('/admin/albums');
  const max = get('SELECT COALESCE(MAX(sort_order),0) m FROM albums').m;
  try {
    run('INSERT INTO albums(slug,name,tag,category,sort_order) VALUES(?,?,?,?,?)',
      cleanSlug, name.trim(), (tag || '').trim(), category || 'wedding', max + 1);
  } catch (e) { /* slug trùng — bỏ qua */ }
  res.redirect('/admin/albums');
});

router.get('/albums/:id', (req, res, next) => {
  const album = get('SELECT * FROM albums WHERE id = ?', req.params.id);
  if (!album) return next();
  const images = all('SELECT * FROM images WHERE album_id = ? ORDER BY sort_order', album.id);
  res.render('admin/album-edit', { album, images });
});

router.post('/albums/:id', (req, res) => {
  const { name, tag, desc, category, visible, sort_order } = req.body;
  run('UPDATE albums SET name=?, tag=?, desc=?, category=?, visible=?, sort_order=? WHERE id=?',
    name.trim(), (tag || '').trim(), (desc || '').trim(), category || 'wedding',
    visible ? 1 : 0, Number(sort_order) || 0, req.params.id);
  res.redirect('/admin/albums/' + req.params.id);
});

router.post('/albums/:id/delete', (req, res) => {
  run('DELETE FROM albums WHERE id = ?', req.params.id);
  res.redirect('/admin/albums');
});

/* Upload ảnh vào album: nén WebP + tạo thumb */
router.post('/albums/:id/images', upload.array('photos', 40), async (req, res) => {
  const album = get('SELECT * FROM albums WHERE id = ?', req.params.id);
  if (!album) return res.redirect('/admin/albums');
  const dir = path.join(UPLOAD_DIR, album.slug);
  fs.mkdirSync(dir, { recursive: true });
  let order = get('SELECT COALESCE(MAX(sort_order),-1) m FROM images WHERE album_id = ?', album.id).m;
  const hasCover = get('SELECT COUNT(*) n FROM images WHERE album_id = ? AND is_cover = 1', album.id).n > 0;

  for (const file of req.files || []) {
    const base = Date.now() + '-' + Math.round(Math.random() * 1e4);
    const full = `/uploads/${album.slug}/${base}.webp`;
    const th = `/uploads/${album.slug}/${base}-thumb.webp`;
    try {
      const img = sharp(file.buffer, { failOn: 'none' }).rotate();
      await img.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 })
        .toFile(path.join(dir, `${base}.webp`));
      await img.clone().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 74 })
        .toFile(path.join(dir, `${base}-thumb.webp`));
      order += 1;
      run('INSERT INTO images(album_id,file,thumb,alt,sort_order,is_cover) VALUES(?,?,?,?,?,?)',
        album.id, full, th, `${album.name} — Rosé Wedding`, order,
        (!hasCover && order === 0) ? 1 : 0);
    } catch (e) {
      console.error('[upload]', e.message);
    }
  }
  res.redirect('/admin/albums/' + album.id);
});

/* Thay ảnh tại chỗ: giữ nguyên thứ tự + ảnh bìa, xoá file cũ nếu là ảnh upload */
router.post('/images/:id/replace', upload.single('photo'), async (req, res) => {
  const img = get('SELECT i.*, a.slug AS album_slug FROM images i JOIN albums a ON a.id = i.album_id WHERE i.id = ?', req.params.id);
  if (img && req.file) {
    const dir = path.join(UPLOAD_DIR, img.album_slug);
    fs.mkdirSync(dir, { recursive: true });
    const base = Date.now() + '-' + Math.round(Math.random() * 1e4);
    try {
      const sh = sharp(req.file.buffer, { failOn: 'none' }).rotate();
      await sh.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 })
        .toFile(path.join(dir, `${base}.webp`));
      await sh.clone().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 74 })
        .toFile(path.join(dir, `${base}-thumb.webp`));
      for (const f of [img.file, img.thumb]) {
        if (f && f.startsWith('/uploads/')) {
          fs.rm(path.join(__dirname, '..', '..', 'public', f), { force: true }, () => {});
        }
      }
      run("UPDATE images SET file=?, thumb=?, pos='50% 50%' WHERE id=?",
        `/uploads/${img.album_slug}/${base}.webp`, `/uploads/${img.album_slug}/${base}-thumb.webp`, img.id);
    } catch (e) {
      console.error('[replace]', e.message);
    }
  }
  res.redirect(req.get('referer') || '/admin/albums');
});

/* Căn vị trí hiển thị khi ảnh bị cắt (object-position) — gọi bằng fetch, trả JSON */
function clampPct(v) { return Math.min(100, Math.max(0, Math.round(Number(v) || 0))); }

router.post('/images/:id/pos', (req, res) => {
  const pos = `${clampPct(req.body.x ?? 50)}% ${clampPct(req.body.y ?? 50)}%`;
  run('UPDATE images SET pos = ? WHERE id = ?', pos, req.params.id);
  res.json({ ok: true, pos });
});

router.post('/images/:id/delete', (req, res) => {
  const img = get('SELECT * FROM images WHERE id = ?', req.params.id);
  if (img) {
    // Chỉ xoá file vật lý nếu là ảnh upload (không đụng vào /img gốc)
    for (const f of [img.file, img.thumb]) {
      if (f && f.startsWith('/uploads/')) {
        const p = path.join(__dirname, '..', '..', 'public', f);
        fs.rm(p, { force: true }, () => {});
      }
    }
    run('DELETE FROM images WHERE id = ?', img.id);
  }
  res.redirect(req.get('referer') || '/admin/albums');
});

router.post('/images/:id/cover', (req, res) => {
  const img = get('SELECT * FROM images WHERE id = ?', req.params.id);
  if (img) {
    run('UPDATE images SET is_cover = 0 WHERE album_id = ?', img.album_id);
    run('UPDATE images SET is_cover = 1 WHERE id = ?', img.id);
  }
  res.redirect(req.get('referer') || '/admin/albums');
});

router.post('/images/:id/move', (req, res) => {
  const img = get('SELECT * FROM images WHERE id = ?', req.params.id);
  const dir = req.body.dir === 'up' ? -1 : 1;
  if (img) {
    const swap = get(
      `SELECT * FROM images WHERE album_id = ? AND sort_order ${dir < 0 ? '<' : '>'} ? ORDER BY sort_order ${dir < 0 ? 'DESC' : 'ASC'} LIMIT 1`,
      img.album_id, img.sort_order);
    if (swap) {
      run('UPDATE images SET sort_order = ? WHERE id = ?', swap.sort_order, img.id);
      run('UPDATE images SET sort_order = ? WHERE id = ?', img.sort_order, swap.id);
    }
  }
  res.redirect(req.get('referer') || '/admin/albums');
});

/* ---------- Bảng giá ---------- */
router.get('/pricing', (req, res) => {
  res.render('admin/pricing', { items: all('SELECT * FROM pricing ORDER BY sort_order') });
});

router.get('/pricing/:id', (req, res, next) => {
  const item = get('SELECT * FROM pricing WHERE id = ?', req.params.id);
  if (!item) return next();
  item.tiers = JSON.parse(item.tiers_json || '[]');
  res.render('admin/pricing-edit', { item });
});

router.post('/pricing/:id', (req, res) => {
  const { name, tag, intro, visible } = req.body;
  // tiers gửi lên dạng mảng song song từ form động
  const tiers = [];
  const names = [].concat(req.body.tier_name || []);
  const prices = [].concat(req.body.tier_price || []);
  const notes = [].concat(req.body.tier_note || []);
  const items = [].concat(req.body.tier_items || []);
  const highlights = [].concat(req.body.tier_highlight || []);
  names.forEach((n, i) => {
    if (!n.trim()) return;
    tiers.push({
      name: n.trim(),
      price: (prices[i] || '').trim(),
      note: (notes[i] || '').trim(),
      highlight: highlights.includes(String(i)),
      items: (items[i] || '').split('\n').map(s => s.trim()).filter(Boolean)
    });
  });
  run('UPDATE pricing SET name=?, tag=?, intro=?, visible=?, tiers_json=? WHERE id=?',
    name.trim(), (tag || '').trim(), (intro || '').trim(), visible ? 1 : 0,
    JSON.stringify(tiers), req.params.id);
  res.redirect('/admin/pricing/' + req.params.id);
});

/* ---------- Bài viết ---------- */
router.get('/posts', (req, res) => {
  res.render('admin/posts', { posts: all('SELECT * FROM posts ORDER BY created_at DESC, id DESC') });
});

router.get('/posts/new', (req, res) => {
  res.render('admin/post-edit', { post: null });
});

router.post('/posts/new', upload.single('cover_file'), async (req, res) => {
  const { title, cat, date, excerpt, body, cover } = req.body;
  const slug = String(title).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80) + '-' + Date.now().toString(36);
  let coverPath = (cover || '').trim();
  if (req.file) coverPath = await saveCover(req.file);
  run('INSERT INTO posts(slug,title,cat,date,cover,excerpt,body) VALUES(?,?,?,?,?,?,?)',
    slug, title.trim(), (cat || '').trim(), (date || '').trim(), coverPath, (excerpt || '').trim(), (body || '').trim());
  res.redirect('/admin/posts');
});

router.get('/posts/:id', (req, res, next) => {
  const post = get('SELECT * FROM posts WHERE id = ?', req.params.id);
  if (!post) return next();
  res.render('admin/post-edit', { post });
});

router.post('/posts/:id', upload.single('cover_file'), async (req, res) => {
  const { title, cat, date, excerpt, body, cover, visible } = req.body;
  let coverPath = (cover || '').trim();
  if (req.file) coverPath = await saveCover(req.file);
  run('UPDATE posts SET title=?, cat=?, date=?, cover=?, excerpt=?, body=?, visible=? WHERE id=?',
    title.trim(), (cat || '').trim(), (date || '').trim(), coverPath,
    (excerpt || '').trim(), (body || '').trim(), visible ? 1 : 0, req.params.id);
  res.redirect('/admin/posts/' + req.params.id);
});

router.post('/posts/:id/delete', (req, res) => {
  run('DELETE FROM posts WHERE id = ?', req.params.id);
  res.redirect('/admin/posts');
});

async function saveCover(file) {
  const dir = path.join(UPLOAD_DIR, 'posts');
  fs.mkdirSync(dir, { recursive: true });
  const base = Date.now() + '-' + Math.round(Math.random() * 1e4);
  await sharp(file.buffer, { failOn: 'none' }).rotate()
    .resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 82 })
    .toFile(path.join(dir, `${base}.webp`));
  return `/uploads/posts/${base}.webp`;
}

/* ---------- Khách VIP / người nổi tiếng ---------- */
async function saveVipImage(file) {
  const dir = path.join(UPLOAD_DIR, 'vips');
  fs.mkdirSync(dir, { recursive: true });
  const base = Date.now() + '-' + Math.round(Math.random() * 1e4);
  await sharp(file.buffer, { failOn: 'none' }).rotate()
    .resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 })
    .toFile(path.join(dir, `${base}.webp`));
  return `/uploads/vips/${base}.webp`;
}

router.get('/vips', (req, res) => {
  res.render('admin/vips', {
    vips: all('SELECT * FROM vips ORDER BY sort_order'),
    albums: all('SELECT slug, name FROM albums ORDER BY sort_order')
  });
});

router.post('/vips', upload.single('image'), async (req, res) => {
  const { name, tag, album_slug, quote } = req.body;
  if (name && name.trim() && req.file) {
    const image = await saveVipImage(req.file);
    const max = get('SELECT COALESCE(MAX(sort_order),0) m FROM vips').m;
    run('INSERT INTO vips(name,tag,image,album_slug,quote,sort_order) VALUES(?,?,?,?,?,?)',
      name.trim(), (tag || '').trim(), image, (album_slug || '').trim(), (quote || '').trim(), max + 1);
  }
  res.redirect('/admin/vips');
});

router.post('/vips/:id', upload.single('image'), async (req, res) => {
  const vip = get('SELECT * FROM vips WHERE id = ?', req.params.id);
  if (vip) {
    const { name, tag, album_slug, quote, visible } = req.body;
    let image = vip.image;
    if (req.file) image = await saveVipImage(req.file);
    run('UPDATE vips SET name=?, tag=?, image=?, album_slug=?, quote=?, visible=? WHERE id=?',
      (name || vip.name).trim(), (tag || '').trim(), image, (album_slug || '').trim(),
      (quote || '').trim(), visible ? 1 : 0, vip.id);
  }
  res.redirect('/admin/vips');
});

router.post('/vips/:id/pos', (req, res) => {
  const pos = `${clampPct(req.body.x ?? 50)}% ${clampPct(req.body.y ?? 50)}%`;
  run('UPDATE vips SET pos = ? WHERE id = ?', pos, req.params.id);
  res.json({ ok: true, pos });
});

router.post('/vips/:id/move', (req, res) => {
  const vip = get('SELECT * FROM vips WHERE id = ?', req.params.id);
  const dir = req.body.dir === 'up' ? -1 : 1;
  if (vip) {
    const swap = get(
      `SELECT * FROM vips WHERE sort_order ${dir < 0 ? '<' : '>'} ? ORDER BY sort_order ${dir < 0 ? 'DESC' : 'ASC'} LIMIT 1`,
      vip.sort_order);
    if (swap) {
      run('UPDATE vips SET sort_order = ? WHERE id = ?', swap.sort_order, vip.id);
      run('UPDATE vips SET sort_order = ? WHERE id = ?', vip.sort_order, swap.id);
    }
  }
  res.redirect('/admin/vips');
});

router.post('/vips/:id/delete', (req, res) => {
  const vip = get('SELECT * FROM vips WHERE id = ?', req.params.id);
  if (vip) {
    if (vip.image && vip.image.startsWith('/uploads/')) {
      fs.rm(path.join(__dirname, '..', '..', 'public', vip.image), { force: true }, () => {});
    }
    run('DELETE FROM vips WHERE id = ?', vip.id);
  }
  res.redirect('/admin/vips');
});

/* ---------- Leads ---------- */
router.get('/leads', (req, res) => {
  const filter = req.query.status;
  const leads = filter
    ? all('SELECT * FROM leads WHERE status = ? ORDER BY id DESC', filter)
    : all('SELECT * FROM leads ORDER BY id DESC');
  res.render('admin/leads', { leads, filter: filter || 'all' });
});

router.post('/leads/:id/status', (req, res) => {
  const status = ['new', 'contacted', 'done'].includes(req.body.status) ? req.body.status : 'new';
  run('UPDATE leads SET status = ? WHERE id = ?', status, req.params.id);
  res.redirect(req.get('referer') || '/admin/leads');
});

router.post('/leads/:id/delete', (req, res) => {
  run('DELETE FROM leads WHERE id = ?', req.params.id);
  res.redirect(req.get('referer') || '/admin/leads');
});

/* ---------- Sao lưu & Khôi phục dữ liệu ----------
   Dữ liệu (database + ảnh upload) không theo Git nên bị xoá mỗi lần hosting
   deploy lại. Quy trình an toàn: tải bản sao lưu TRƯỚC khi deploy, khôi phục SAU. */
const uploadBackup = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 300 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /\.zip$/i.test(file.originalname))
});

router.get('/backup', (req, res) => {
  res.render('admin/backup', {
    ok: req.query.ok, err: req.query.err,
    dbSize: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
    uploadCount: fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR, { recursive: true }).length : 0
  });
});

router.get('/backup/download', (req, res) => {
  try {
    checkpoint(); // gom WAL về file chính để bản sao lưu đầy đủ
    const zip = new AdmZip();
    zip.addLocalFile(DB_PATH, '', 'rose.db');
    if (fs.existsSync(UPLOAD_DIR)) zip.addLocalFolder(UPLOAD_DIR, 'uploads');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="rose-backup-${stamp}.zip"`);
    res.send(zip.toBuffer());
  } catch (e) {
    console.error('[backup]', e.message);
    res.redirect('/admin/backup?err=' + encodeURIComponent('Không tạo được bản sao lưu: ' + e.message));
  }
});

router.post('/backup/restore', uploadBackup.single('backup'), (req, res) => {
  if (!req.file) return res.redirect('/admin/backup?err=' + encodeURIComponent('Chưa chọn file sao lưu (.zip)'));
  try {
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries().filter(e => !e.isDirectory);
    const dbEntry = entries.find(e => e.entryName === 'rose.db');
    if (!dbEntry) throw new Error('File không đúng định dạng sao lưu của Rosé (thiếu rose.db)');

    // 1) Khôi phục ảnh upload (chỉ nhận đường dẫn an toàn trong uploads/)
    for (const e of entries) {
      if (!e.entryName.startsWith('uploads/')) continue;
      const rel = e.entryName.slice('uploads/'.length);
      const dest = path.join(UPLOAD_DIR, rel);
      if (!path.resolve(dest).startsWith(path.resolve(UPLOAD_DIR) + path.sep)) continue; // chặn ../
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, e.getData());
    }

    // 2) Khôi phục database: đóng DB, chép đè, mở lại
    reopenDb(() => fs.writeFileSync(DB_PATH, dbEntry.getData()));
    ensureAdmin(); // đồng bộ lại mật khẩu quản trị theo biến môi trường hiện tại

    console.log('[restore] Đã khôi phục dữ liệu từ bản sao lưu');
    res.redirect('/admin/backup?ok=1');
  } catch (e) {
    console.error('[restore]', e.message);
    res.redirect('/admin/backup?err=' + encodeURIComponent('Khôi phục thất bại: ' + e.message));
  }
});

/* Chẩn đoán môi trường hosting: tìm thư mục sống sót qua deploy (chỉ admin xem) */
router.get('/backup/env-info', (req, res) => {
  const testWrite = dir => {
    try {
      const f = path.join(dir, '.rose-write-test-' + Date.now());
      fs.writeFileSync(f, 'x');
      fs.rmSync(f, { force: true });
      return true;
    } catch (e) { return false; }
  };
  const appRoot = path.join(__dirname, '..', '..');
  const candidates = [os.homedir(), path.resolve(appRoot, '..'), path.resolve(appRoot, '..', '..'), '/data', '/storage', '/persistent'];
  const dirs = candidates.map(d => {
    let listing = [];
    try { listing = fs.readdirSync(d).slice(0, 20); } catch (e) {}
    return { path: d, exists: fs.existsSync(d), writable: fs.existsSync(d) && testWrite(d), listing };
  });
  res.json({ cwd: process.cwd(), appRoot: path.resolve(appRoot), homedir: os.homedir(), platform: process.platform, dirs });
});

/* ---------- Cài đặt ---------- */
const SETTING_KEYS = [
  'site_name', 'tagline', 'slogan', 'hotline', 'hotline_tel', 'cskh', 'cskh_tel',
  'email', 'address', 'hours', 'instagram', 'facebook', 'map_embed', 'pricing_note',
  'about_stats', 'site_url', 'zalo', 'messenger', 'tiktok', 'youtube', 'ga_id', 'fb_pixel_id'
];

router.get('/settings', (req, res) => {
  res.render('admin/settings', {
    s: allSettings(),
    videos: all('SELECT * FROM videos ORDER BY sort_order')
  });
});

/* Thay ảnh các vị trí cố định (hero, câu chuyện, váy cưới, phóng sự) bằng upload */
const IMAGE_SETTING_KEYS = ['about_img_1', 'about_img_2', 'about_img_3', 'feature_vay_img', 'feature_phongsu_img'];

router.post('/settings/image', upload.single('photo'), async (req, res) => {
  const key = String(req.body.key || '');
  // hero_0..3: ảnh nền desktop (ngang) · hero_m_0..3: ảnh nền điện thoại (dọc)
  const heroMatch = key.match(/^hero_(m_)?([0-9])$/);
  if (req.file && (IMAGE_SETTING_KEYS.includes(key) || heroMatch)) {
    const dir = path.join(UPLOAD_DIR, 'site');
    fs.mkdirSync(dir, { recursive: true });
    const base = Date.now() + '-' + Math.round(Math.random() * 1e4);
    const width = heroMatch ? (heroMatch[1] ? 1280 : 1920) : 1600;
    try {
      await sharp(req.file.buffer, { failOn: 'none' }).rotate()
        .resize({ width, withoutEnlargement: true }).webp({ quality: 82 })
        .toFile(path.join(dir, `${base}.webp`));
      const p = `/uploads/site/${base}.webp`;
      if (heroMatch) {
        const setKey = heroMatch[1] ? 'hero_images_mobile' : 'hero_images';
        const idx = Number(heroMatch[2]);
        let arr = [];
        try { arr = JSON.parse(allSettings()[setKey] || '[]'); } catch (e) {}
        // idx trong bộ: thay ảnh; idx == độ dài bộ: thêm ảnh mới (tối đa 6 ảnh)
        if (idx < arr.length || (idx === arr.length && arr.length < 6)) {
          while (arr.length <= idx) arr.push('');
          arr[idx] = p;
          setSetting(setKey, JSON.stringify(arr));
        }
      } else {
        setSetting(key, p);
      }
      setSetting('pos_' + key, '50% 50%'); // ảnh mới thì căn lại từ giữa
    } catch (e) {
      console.error('[settings-image]', e.message);
    }
  }
  res.redirect('/admin/settings');
});

/* Gỡ một ảnh khỏi bộ ảnh nền (không xoá file vật lý, chỉ bỏ khỏi danh sách) */
router.post('/settings/image-remove', (req, res) => {
  const key = String(req.body.key || '');
  const m = key.match(/^hero_(m_)?([0-9])$/);
  if (m) {
    const setKey = m[1] ? 'hero_images_mobile' : 'hero_images';
    const prefix = m[1] ? 'hero_m_' : 'hero_';
    const idx = Number(m[2]);
    let arr = [];
    try { arr = JSON.parse(allSettings()[setKey] || '[]'); } catch (e) {}
    // Bộ máy tính giữ tối thiểu 1 ảnh (hero không được trống); bộ điện thoại cho về 0
    const minLen = m[1] ? 0 : 1;
    if (idx < arr.length && arr.length > minLen) {
      arr.splice(idx, 1);
      setSetting(setKey, JSON.stringify(arr));
      // Dồn lại các vị trí crop phía sau cho khớp thứ tự mới
      const s = allSettings();
      for (let i = idx; i <= arr.length; i++) {
        setSetting('pos_' + prefix + i, s['pos_' + prefix + (i + 1)] || '50% 50%');
      }
    }
  }
  res.redirect('/admin/settings');
});

/* Căn vị trí hiển thị cho ảnh vị trí cố định (lưu setting pos_<key>) */
router.post('/settings/image-pos', (req, res) => {
  const key = String(req.body.key || '');
  if (!IMAGE_SETTING_KEYS.includes(key) && !/^hero_(m_)?[0-9]$/.test(key)) {
    return res.status(400).json({ ok: false });
  }
  const pos = `${clampPct(req.body.x ?? 50)}% ${clampPct(req.body.y ?? 50)}%`;
  setSetting('pos_' + key, pos);
  res.json({ ok: true, pos });
});

router.post('/settings', (req, res) => {
  for (const key of SETTING_KEYS) {
    if (key in req.body) setSetting(key, String(req.body[key]).trim());
  }
  res.redirect('/admin/settings');
});

router.post('/videos', (req, res) => {
  const { youtube_id, title } = req.body;
  // Chấp nhận cả link YouTube đầy đủ lẫn ID
  const m = String(youtube_id || '').match(/(?:v=|youtu\.be\/|embed\/)?([\w-]{11})/);
  if (m) {
    const max = get('SELECT COALESCE(MAX(sort_order),0) m FROM videos').m;
    run('INSERT INTO videos(youtube_id,title,sort_order) VALUES(?,?,?)', m[1], (title || '').trim(), max + 1);
  }
  res.redirect('/admin/settings');
});

router.post('/videos/:id/delete', (req, res) => {
  run('DELETE FROM videos WHERE id = ?', req.params.id);
  res.redirect('/admin/settings');
});

module.exports = router;

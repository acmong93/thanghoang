require('dotenv').config();
const path = require('path');
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const { ensureAdmin, allSettings } = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

/* Đổi số này mỗi lần deploy để trình duyệt tải lại CSS/JS mới */
app.locals.v = require('./package.json').version;

app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
/* Khi UPLOADS_DIR trỏ ra ngoài app (thư mục sống sót qua deploy), vẫn phục vụ ảnh tại /uploads */
if (process.env.UPLOADS_DIR) {
  app.use('/uploads', express.static(process.env.UPLOADS_DIR, { maxAge: '7d' }));
}
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'rose-wedding-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
}));

ensureAdmin();

/* Khởi tạo dữ liệu lần đầu trên môi trường mới (VD: vừa deploy lên hosting):
   database trống thì seed nội dung chuẩn + áp bảng giá 2027 (có marker, chỉ chạy 1 lần) */
{
  const { get, setting, setSetting } = require('./src/db');
  const { execFileSync } = require('child_process');
  if (get('SELECT COUNT(*) n FROM albums').n === 0) {
    console.log('[init] Database trống — seed dữ liệu ban đầu...');
    execFileSync(process.execPath, [path.join(__dirname, 'scripts', 'seed.js')], { stdio: 'inherit' });
  }
  execFileSync(process.execPath, [path.join(__dirname, 'scripts', 'update-pricing-2027.js')], { stdio: 'inherit' });
  /* Bổ sung cài đặt ra đời sau đợt seed đầu (database cũ thiếu thì điền mặc định) */
  if (!setting('zalo')) setSetting('zalo', '0966669935');
  if (!setting('messenger')) setSetting('messenger', 'https://m.me/RoseWeddingHanoi');
  if (!setting('tiktok')) setSetting('tiktok', 'https://www.tiktok.com/@anhcuoi_rosewedding');
}

/* URL gốc cho SEO (canonical, og:url, sitemap).
   Ưu tiên: biến môi trường SITE_URL > cài đặt site_url trong admin > host của request */
app.use((req, res, next) => {
  const base = (process.env.SITE_URL || allSettings().site_url || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  res.locals.baseUrl = base;
  res.locals.pageUrl = base + req.originalUrl.split('?')[0];
  next();
});

/* Chuyển hướng URL kiểu cũ (web tĩnh) sang URL mới */
app.get('/index.html', (req, res) => res.redirect(301, '/'));
app.get('/album.html', (req, res) => res.redirect(301, req.query.key ? `/album/${req.query.key}` : '/anh-cuoi'));
app.get('/bang-gia.html', (req, res) => res.redirect(301, `/bang-gia/${req.query.type || 'anh-cuoi'}`));
app.get('/anh-cuoi.html', (req, res) => res.redirect(301, '/anh-cuoi'));
app.get('/vay-cuoi.html', (req, res) => res.redirect(301, '/vay-cuoi'));
app.get('/cau-chuyen.html', (req, res) => res.redirect(301, '/cau-chuyen'));
app.get('/tin-tuc.html', (req, res) => res.redirect(301, '/tin-tuc'));
app.get('/post.html', (req, res) => res.redirect(301, req.query.id ? `/tin-tuc/${req.query.id}` : '/tin-tuc'));

app.use('/', require('./src/routes/public'));
app.use('/admin', require('./src/routes/admin'));

/* 404 */
app.use((req, res) => {
  const { allSettings } = require('./src/db');
  res.status(404).render('404', { s: allSettings(), page: '404' });
});

app.listen(PORT, () => {
  console.log(`Rosé Wedding đang chạy tại http://localhost:${PORT}`);
  console.log(`Trang quản trị:            http://localhost:${PORT}/admin`);
});

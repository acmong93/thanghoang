require('dotenv').config();
const path = require('path');
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const { ensureAdmin } = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');
/* Chạy sau proxy của hosting: đọc đúng https từ X-Forwarded-Proto,
   để redirect www và canonical trỏ thẳng https (không qua bậc http trung gian) */
app.set('trust proxy', 1);

/* Đổi số này mỗi lần deploy để trình duyệt tải lại CSS/JS mới */
app.locals.v = require('./package.json').version;

app.use(compression());
/* SEO: địa chỉ chuẩn duy nhất (tên miền chính, link web cũ Haravan, dấu / cuối) và URL gốc
   cho canonical / og:url / sitemap. Đặt trước file tĩnh để ảnh trên .net cũng về tên miền chính.
   Cơ chế tự kiểm tra chống sập web khi đổi tên miền: src/canonical.js */
const canonical = require('./src/canonical').canonical();
canonical.ensurePrimaryDefault();
app.use(canonical.middleware);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
/* redirect: false để thư mục không tự thêm dấu / (tránh lặp với bước bỏ dấu / của canonical) */
/* Khi UPLOADS_DIR trỏ ra ngoài app (thư mục sống sót qua deploy), vẫn phục vụ ảnh tại /uploads */
if (process.env.UPLOADS_DIR) {
  app.use('/uploads', express.static(process.env.UPLOADS_DIR, { maxAge: '7d', redirect: false }));
}
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d', redirect: false }));

/* Phiên đăng nhập lưu ra file (src/session-store.js): deploy/khởi động lại không bị đăng xuất */
const { SqliteSessionStore } = require('./src/session-store');
let sessionStore; // undefined → express-session tự dùng bộ nhớ RAM (dự phòng, web vẫn chạy)
try { sessionStore = new SqliteSessionStore(); } catch (e) { console.error('[session] tạm lưu phiên trong RAM:', e.message); }
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'rose-wedding-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 1000 * 60 * 60 * 8 }
}));

/* Phiên giờ sống qua khởi động lại: đổi ADMIN_PASSWORD thì đăng xuất mọi phiên cũ */
if (ensureAdmin() && sessionStore) {
  sessionStore.clear();
  console.log('[session] Mật khẩu quản trị đã đổi: đăng xuất mọi phiên cũ');
}

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
  /* Quy chuẩn nội dung: không dùng ký tự '&' — đổi thành ' - ' trong tên album,
     tag và tên khách VIP có sẵn (chạy đúng 1 lần nhờ marker) */
  if (!setting('fix_amp_v1')) {
    const { run } = require('./src/db');
    run("UPDATE albums SET name = REPLACE(name, ' & ', ' - '), tag = REPLACE(tag, ' & ', ' - ')");
    run("UPDATE vips SET name = REPLACE(name, ' & ', ' - ')");
    setSetting('fix_amp_v1', '1');
    console.log('[init] Đã thay ký tự & bằng " - " trong tên album/khách VIP');
  }
  /* Gói 9tr8 (Package 3) cũng được chọn nhiều — gắn nhãn nổi bật (chạy 1 lần) */
  if (!setting('hl_pkg3_2027')) {
    const { run } = require('./src/db');
    const g = get("SELECT id, tiers_json FROM pricing WHERE slug = 'anh-cuoi'");
    if (g) {
      const tiers = JSON.parse(g.tiers_json);
      const t = tiers.find(x => x.name === 'Package 3');
      if (t && !t.highlight) {
        t.highlight = true;
        if (t.note) { t.items.unshift(t.note + ' làm việc'); delete t.note; }
        run('UPDATE pricing SET tiers_json = ? WHERE id = ?', JSON.stringify(tiers), g.id);
        console.log('[init] Đã gắn nhãn "Được chọn nhiều nhất" cho Package 3 (9tr8)');
      }
    }
    setSetting('hl_pkg3_2027', '1');
  }
  /* Khôi phục 3 video trang chủ về mặc định (link bị thay nhầm 22/07/2026, chạy 1 lần) */
  if (!setting('restore_videos_v1')) {
    const { run } = require('./src/db');
    run('DELETE FROM videos');
    [
      ['CkkOOj2ka_w', 'Bên nhau mãi mãi'],
      ['EOcZk4Xa8hw', 'Mình cứ đi cùng nhau · Đà Lạt'],
      ['DDC5jch0qbM', 'Khi hai ta về chung một nhà']
    ].forEach((v, i) => run('INSERT INTO videos(youtube_id,title,sort_order) VALUES(?,?,?)', v[0], v[1], i));
    setSetting('restore_videos_v1', '1');
    console.log('[init] Đã khôi phục 3 video mặc định cho trang chủ');
  }
  /* Hệ Concept: nhập bộ concept + ảnh từ manifest (chạy 1 lần; sau đó anh Thắng
     tự quản trong admin — thêm/xoá/kéo thả không bị ghi đè lại) */
  require('./src/concepts-import').ensureConcepts();
  /* Ghi chú bảng giá 2027: thời hạn áp dụng rõ ràng (chạy 1 lần, sau đó sửa được trong admin) */
  if (!setting('pricing_note_2027')) {
    setSetting('pricing_note', 'Bảng giá 2027 áp dụng đến hết 31/12/2027. Mỗi gói đều có thể điều chỉnh theo nhu cầu thực tế của hai bạn.');
    setSetting('pricing_note_2027', '1');
  }
  /* Mã xác minh Google Search Console cho https://rosewedding.vn (09/10/2026, chạy 1 lần; sau đó sửa trong admin) */
  if (!setting('gsc_vn_v1')) {
    if (!setting('gsc_verify')) setSetting('gsc_verify', '1UMNPyc4NZAP4nwylqg3Juf2AfihI_cnqcmuQcOALqU');
    setSetting('gsc_vn_v1', '1');
  }
}


/* Chuyển hướng URL kiểu cũ (web tĩnh) sang URL mới */
app.get('/index.html', (req, res) => res.redirect(301, '/'));
app.get('/album.html', (req, res) => res.redirect(301, req.query.key ? `/album/${req.query.key}` : '/anh-cuoi'));
app.get('/bang-gia.html', (req, res) => res.redirect(301, `/bang-gia/${req.query.type || 'anh-cuoi'}`));
app.get('/anh-cuoi.html', (req, res) => res.redirect(301, '/anh-cuoi'));
app.get('/vay-cuoi.html', (req, res) => res.redirect(301, '/vay-cuoi'));
app.get('/cau-chuyen.html', (req, res) => res.redirect(301, '/cau-chuyen'));
app.get('/tin-tuc.html', (req, res) => res.redirect(301, '/tin-tuc'));
app.get('/post.html', (req, res) => res.redirect(301, req.query.id ? `/tin-tuc/${req.query.id}` : '/tin-tuc'));

/* Thống kê truy cập tự vận hành (ẩn danh) — ghi lượt xem + nhận sự kiện liên hệ */
const { trackMiddleware, trackRouter } = require('./src/track');
app.use(trackMiddleware);
app.use('/track', trackRouter);

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

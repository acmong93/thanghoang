/* Kiểm thử logic chuyển hướng tên miền + link web cũ. Chạy: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { decide, legacyTarget, isActive, nextState, intendedPrimary, parseSiteUrl, createCanonical, GRACE_MS, STALE_MS } = require('../src/canonical');

const noLookups = { postExists: () => false, albumBySlug: () => null };
const VN = parseSiteUrl('https://rosewedding.vn');

const run = (o) => decide({
  method: 'GET', protocol: 'https', search: '', primary: VN, primaryActive: true, lookups: noLookups, ...o
});

test('.vn đã hoạt động: .net và www về .vn trong một bước, giữ đường dẫn và query', () => {
  assert.equal(run({ hostHeader: 'rosewedding.net', path: '/concept', search: '?utm_source=zalo' }), 'https://rosewedding.vn/concept?utm_source=zalo');
  assert.equal(run({ hostHeader: 'www.rosewedding.net', path: '/' }), 'https://rosewedding.vn/');
  assert.equal(run({ hostHeader: 'www.rosewedding.vn', path: '/bang-gia/combo' }), 'https://rosewedding.vn/bang-gia/combo');
  assert.equal(run({ hostHeader: 'rosewedding.vn', path: '/concept' }), null);
});

test('.vn CHƯA hoạt động: không chuyển giữa hai tên miền, chỉ bỏ www trong cùng tên miền', () => {
  const o = { primaryActive: false };
  assert.equal(run({ ...o, hostHeader: 'rosewedding.net', path: '/concept' }), null);
  assert.equal(run({ ...o, hostHeader: 'rosewedding.vn', path: '/concept' }), null, 'không bao giờ 301 .vn về .net');
  assert.equal(run({ ...o, hostHeader: 'www.rosewedding.net', path: '/x' }), 'https://rosewedding.net/x');
  assert.equal(run({ ...o, hostHeader: 'www.rosewedding.vn', path: '/x' }), 'https://rosewedding.vn/x');
});

test('admin luôn vào được, POST không bị chuyển hướng', () => {
  assert.equal(run({ hostHeader: 'rosewedding.net', path: '/admin' }), null);
  assert.equal(run({ hostHeader: 'rosewedding.net', path: '/admin/settings' }), null);
  assert.equal(run({ hostHeader: 'rosewedding.net', path: '/api/booking', method: 'POST' }), null);
  assert.equal(run({ hostHeader: 'rosewedding.net', path: '/administrator' }), 'https://rosewedding.vn/administrator');
});

test('tên miền lạ (localhost, bản xem trước hosting): không đổi host, chỉ sửa đường dẫn tương đối', () => {
  assert.equal(run({ hostHeader: 'localhost:3000', path: '/concept' }), null);
  assert.equal(run({ hostHeader: 'localhost:3000', path: '/concept/' }), '/concept');
  assert.equal(run({ hostHeader: 'www.evil.com', path: '/x' }), null, 'không bao giờ chuyển theo host do request gửi lên');
});

test('dấu / cuối: bỏ đi, giữ query', () => {
  assert.equal(run({ hostHeader: 'rosewedding.vn', path: '/concept/', search: '?a=1' }), '/concept?a=1');
  assert.equal(run({ hostHeader: 'rosewedding.vn', path: '/' }), null);
});

test('chặn open redirect qua đường dẫn bắt đầu bằng // hoặc /\\', () => {
  assert.equal(run({ hostHeader: 'rosewedding.vn', path: '//evil.com/' }), '/evil.com');
  assert.equal(run({ hostHeader: 'rosewedding.vn', path: '/\\evil.com/' }), '/evil.com');
  assert.equal(run({ hostHeader: 'rosewedding.vn', path: '//evil.com' }), '/evil.com');
  assert.equal(run({ hostHeader: 'localhost:3000', path: '///evil.com/' }), '/evil.com');
});

test('link web cũ: đổi host và đường dẫn cùng lúc trong MỘT bước, bỏ query rác', () => {
  assert.equal(run({ hostHeader: 'rosewedding.net', path: '/blogs/news/abc' }), 'https://rosewedding.vn/tin-tuc');
  assert.equal(run({ hostHeader: 'rosewedding.vn', path: '/news2679', search: '?page=1' }), '/tin-tuc');
  assert.equal(run({ hostHeader: 'rosewedding.vn', path: '/bang-gia-combo-chup-anh-cuoi' }), '/bang-gia/combo');
});

test('bảng ánh xạ web cũ Haravan', () => {
  const cases = {
    '/blogs/news/12-buoc-de-co-mot-dam-cuoi-hoan-my': '/tin-tuc',
    '/news/tai-sao-nen-chon-chup-anh-cuoi-tai-da-lat': '/tin-tuc',
    '/blogs/news': '/tin-tuc',
    '/bang-gia-combo-chup-anh-cuoi': '/bang-gia/combo',
    '/bang-gia-quay-chup-anh-phong-su-cuoi': '/bang-gia/phong-su',
    '/bang-gia-chup-anh-phong-su-cuoi': '/bang-gia/phong-su',
    '/bang-gia-chup-anh-cuoi-ngoai-thanh': '/bang-gia/anh-cuoi',
    '/bao-gia-chup-anh-cuoi-noi-thanh': '/bang-gia/anh-cuoi',
    '/collections/bang-gia-quay-chup-anh-phong-su-cuoi': '/bang-gia/phong-su',
    '/blogs/news/bang-gia-combo-cuoi': '/bang-gia/combo',
    '/blogs/bao-gia-chup-anh-cuoi-noi-thanh/news': '/bang-gia/anh-cuoi',
    '/blogs/bao-gia-chup-anh-cuoi-noi-thanh/about-us': '/cau-chuyen',
    '/pages/about-us': '/cau-chuyen',
    '/about-us': '/cau-chuyen',
    '/lien-he': '/#booking',
    '/pages/lien-he': '/#booking',
    '/video-cuoi': '/#video',
    '/blogs/video-cuoi/ben-nhau-mai-mai-pre-wedding-yura-phuong-bali': '/#video',
    '/blogs/phong-su-cuoi/le-an-hoi': '/phong-su',
    '/blogs/anh-cuoi/concept-han-quoc-nhe-nhang': '/concept',
    '/blogs/anh-cuoi/studio-tuong-hoa': '/concept',
    '/blogs/anh-cuoi/love-at-night': '/anh-cuoi',
    '/anh-cuoi/love-is-madness-pre-wedding': '/anh-cuoi',
    '/blogs/anh-cuoi235c': '/anh-cuoi',
    '/pages/chinh-sach-bao-mat': '/',
    '/collections/all': '/',
    '/hot-products': '/',
    '/index942b': '/',
    '/search': '/'
  };
  for (const [from, to] of Object.entries(cases)) assert.equal(legacyTarget(from, noLookups), to, from);
});

test('giữ đúng bài viết / album nếu web mới còn cùng slug', () => {
  const lk = {
    postExists: s => s === 'chuan-bi-chup-cuoi',
    albumBySlug: s => (s === 'lam-diep' ? { slug: 'lam-diep', category: 'signature' } : s === 'ao-dai' ? { slug: 'ao-dai', category: 'concept' } : null)
  };
  assert.equal(legacyTarget('/blogs/news/chuan-bi-chup-cuoi', lk), '/tin-tuc/chuan-bi-chup-cuoi');
  assert.equal(legacyTarget('/news/chuan-bi-chup-cuoi', lk), '/tin-tuc/chuan-bi-chup-cuoi');
  assert.equal(legacyTarget('/blogs/anh-cuoi/lam-diep', lk), '/album/lam-diep');
  assert.equal(legacyTarget('/blogs/anh-cuoi/ao-dai', lk), '/concept/ao-dai');
});

test('KHÔNG đụng tới đường dẫn của web mới', () => {
  const live = ['/', '/anh-cuoi', '/concept', '/concept/ao-dai', '/album/lam-diep', '/phong-su', '/vay-cuoi',
    '/cau-chuyen', '/tin-tuc', '/tin-tuc/chuan-bi-chup-cuoi', '/bang-gia/anh-cuoi', '/bang-gia/combo',
    '/thiep-cuoi', '/sitemap.xml', '/robots.txt', '/api/booking', '/track', '/admin'];
  for (const p of live) assert.equal(legacyTarget(p, noLookups), null, p);
});

test('toàn bộ đường dẫn web cũ lưu trên Wayback đều có đích hợp lệ', () => {
  const file = path.join(__dirname, 'fixtures', 'wayback-rosewedding-vn.txt');
  const paths = fs.readFileSync(file, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const valid = /^\/(tin-tuc(\/[\w-]+)?|bang-gia\/(anh-cuoi|combo|phong-su)|cau-chuyen|phong-su|anh-cuoi|vay-cuoi|concept(\/[\w-]+)?|album\/[\w-]+|#booking|#video)?$/;
  for (const raw of paths) {
    const p = raw.split('?')[0];
    const to = legacyTarget(p, noLookups);
    if (to === null) {
      assert.ok(['/', '/anh-cuoi'].includes(p), `đường dẫn cũ bị bỏ sót: ${raw}`);
      continue;
    }
    assert.match(to, valid, `${raw} → ${to}`);
  }
});

test('kích hoạt: đạt liên tục 24 giờ và lần đạt gần nhất còn mới', () => {
  const now = 100 * GRACE_MS;
  const st = (first, last, host = 'rosewedding.vn') => ({ host, firstOkAt: first, lastOkAt: last });
  assert.equal(isActive(VN, {}, now), false);
  assert.equal(isActive(VN, st(now - GRACE_MS / 2, now), now), false, 'chưa đủ 24 giờ');
  assert.equal(isActive(VN, st(now - GRACE_MS, now), now), true);
  assert.equal(isActive(VN, st(now - 3 * GRACE_MS, now - STALE_MS - 1), now), false, 'lâu không kiểm tra đạt thì thôi chuyển');
  assert.equal(isActive(VN, st(now - 3 * GRACE_MS, now, 'rosewedding.net'), now), false, 'kết quả của tên miền khác không tính');
  assert.equal(isActive(null, st(1, now), now), false);
});

test('trạng thái kiểm tra: trượt trước khi kích hoạt thì đếm lại 24 giờ, sau kích hoạt thì chịu được trục trặc ngắn', () => {
  let s = nextState({}, 'rosewedding.vn', true, '', 1000);
  assert.equal(s.firstOkAt, 1000);
  s = nextState(s, 'rosewedding.vn', true, '', 5000);
  assert.equal(s.firstOkAt, 1000);
  assert.equal(s.lastOkAt, 5000);
  s = nextState(s, 'rosewedding.vn', false, 'lỗi DNS', 6000);
  assert.equal(s.firstOkAt, null, 'trượt khi chưa đủ 24 giờ: đếm lại');
  assert.equal(s.lastError, 'lỗi DNS');
  let a = nextState({}, 'rosewedding.vn', true, '', 1);
  a = nextState(a, 'rosewedding.vn', true, '', GRACE_MS + 10);
  a = nextState(a, 'rosewedding.vn', false, 'chập chờn', GRACE_MS + 20);
  assert.equal(a.firstOkAt, 1, 'đã kích hoạt: giữ mốc');
  const b = nextState({ host: 'rosewedding.net', firstOkAt: 5, lastOkAt: 9 }, 'rosewedding.vn', true, '', 50);
  assert.equal(b.host, 'rosewedding.vn');
  assert.equal(b.firstOkAt, 50, 'đổi tên miền chính: đếm từ đầu');
});

test('tên miền chính: ô trong admin ưu tiên hơn biến môi trường', () => {
  assert.equal(intendedPrimary({ site_url: 'https://rosewedding.vn' }, { SITE_URL: 'https://rosewedding.net' }).host, 'rosewedding.vn');
  assert.equal(intendedPrimary({ site_url: '' }, { SITE_URL: 'https://rosewedding.net/' }).host, 'rosewedding.net');
  assert.equal(intendedPrimary({ site_url: 'linh tinh' }, {}), null);
  assert.equal(intendedPrimary({}, {}), null);
});

/* ---------- Kiểm thử phần chạy thật trong server (middleware + tự kiểm tra) ---------- */
function fakeDb(initial = {}) {
  const st = { ...initial };
  return {
    st,
    setting: k => st[k] || '',
    setSetting: (k, v) => { st[k] = String(v); },
    allSettings: () => ({ ...st }),
    get: () => null
  };
}
function fakeReq({ host, path = '/', proto = 'https', method = 'GET', url }) {
  return { method, path, originalUrl: url || path, protocol: proto, get: h => (h.toLowerCase() === 'host' ? host : undefined) };
}
function fakeRes() {
  const r = { headers: {}, locals: {}, statusCode: 200, location: null, body: null };
  r.set = (k, v) => { r.headers[k.toLowerCase()] = v; return r; };
  r.type = () => r;
  r.send = b => { r.body = b; return r; };
  r.redirect = (code, loc) => { r.statusCode = code; r.location = loc; return r; };
  return r;
}
function run1(c, req) {
  const res = fakeRes();
  let nexted = false;
  c.middleware(req, res, () => { nexted = true; });
  return { res, nexted };
}

/* fetch giả: DNS công khai trả IP, gọi /__domain-check trả mã của website */
function fakeFetch(db, mode = {}) {
  const { dnsOk = true, siteOk = true } = mode;
  return async url => {
    if (url.includes('dns.google') || url.includes('cloudflare-dns')) {
      return { json: async () => ({ Answer: dnsOk ? [{ type: 1, data: '1.2.3.4' }] : [] }) };
    }
    return { status: siteOk ? 200 : 404, text: async () => (siteOk ? 'rose-domain-check:' + db.setting('domain_check_token') : 'parked') };
  };
}

test('server: header Host giả KHÔNG thể kích hoạt tên miền chính (chỉ server tự kiểm tra mới tính)', () => {
  const db = fakeDb({ site_url: 'https://rosewedding.vn' });
  let t = 0;
  const c = createCanonical({ db, env: {}, now: () => t, autoCheck: false, fetchImpl: fakeFetch(db) });
  run1(c, fakeReq({ host: 'rosewedding.vn', path: '/' }));
  t = 3 * GRACE_MS;
  const { res, nexted } = run1(c, fakeReq({ host: 'rosewedding.net', path: '/concept' }));
  assert.equal(nexted, true, '.net vẫn phục vụ bình thường');
  assert.equal(res.location, null);
  assert.equal(db.st.domain_check, undefined);
});

test('server: tự kiểm tra đạt liên tục 24 giờ thì .net chuyển về .vn, kèm giới hạn nhớ 1 giờ', async () => {
  const db = fakeDb({ site_url: 'https://rosewedding.vn' });
  let t = 1000;
  const c = createCanonical({ db, env: {}, now: () => t, autoCheck: false, fetchImpl: fakeFetch(db) });
  const r1 = await c.runCheck();
  assert.equal(r1.ok, true);
  assert.equal(run1(c, fakeReq({ host: 'rosewedding.net', path: '/x' })).nexted, true, 'mới đạt: chưa chuyển');
  t += GRACE_MS - 60000;
  await c.runCheck();
  assert.equal(run1(c, fakeReq({ host: 'rosewedding.net', path: '/x' })).nexted, true, 'chưa đủ 24 giờ');
  t += 120000;
  await c.runCheck();
  const { res } = run1(c, fakeReq({ host: 'rosewedding.net', path: '/x', url: '/x?a=1' }));
  assert.equal(res.statusCode, 301);
  assert.equal(res.location, 'https://rosewedding.vn/x?a=1');
  assert.equal(res.headers['cache-control'], 'public, max-age=3600');
  const vn = run1(c, fakeReq({ host: 'rosewedding.vn', path: '/x' }));
  assert.equal(vn.nexted, true);
  assert.equal(vn.res.locals.baseUrl, 'https://rosewedding.vn');
  assert.equal(c.status().active, true);
});

test('server: DNS chưa trỏ hoặc tên miền vào nhầm chỗ thì không tính, và đếm lại từ đầu', async () => {
  const db = fakeDb({ site_url: 'https://rosewedding.vn' });
  let t = 0;
  let mode = { dnsOk: false };
  const c = createCanonical({ db, env: {}, now: () => t, autoCheck: false, fetchImpl: (u, o) => fakeFetch(db, mode)(u, o) });
  let r = await c.runCheck();
  assert.equal(r.ok, false);
  assert.match(r.error, /chưa thấy địa chỉ IP/);
  mode = { dnsOk: true, siteOk: false };
  r = await c.runCheck();
  assert.equal(r.ok, false);
  assert.match(r.error, /chưa trả về đúng website/);
  mode = { dnsOk: true, siteOk: true };
  await c.runCheck();
  t = GRACE_MS / 2;
  mode = { dnsOk: false };
  await c.runCheck();
  t = GRACE_MS + 1;
  mode = { dnsOk: true, siteOk: true };
  await c.runCheck();
  assert.equal(c.status().active, false, 'trượt giữa chừng: phải đếm lại đủ 24 giờ');
});

test('server: trang tự kiểm tra trả mã bí mật, không bị chuyển hướng, không cache', () => {
  const db = fakeDb({ site_url: 'https://rosewedding.vn' });
  const c = createCanonical({ db, env: {}, now: () => 0, autoCheck: false, fetchImpl: fakeFetch(db) });
  const { res, nexted } = run1(c, fakeReq({ host: 'www.rosewedding.net', path: '/__domain-check' }));
  assert.equal(nexted, false);
  assert.equal(res.body, 'rose-domain-check:' + db.st.domain_check_token);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.match(db.st.domain_check_token, /^[a-f0-9]{32}$/);
});

test('server: khôi phục bản sao lưu cũ (thiếu marker) đặt lại tên miền chính .vn', () => {
  const db = fakeDb({ site_url: 'https://rosewedding.net' });
  const c = createCanonical({ db, env: { SITE_URL: 'https://rosewedding.net' }, now: () => 0, autoCheck: false, fetchImpl: fakeFetch(db) });
  c.ensurePrimaryDefault();
  assert.equal(db.st.site_url, 'https://rosewedding.vn');
  db.st.site_url = 'https://rosewedding.net';
  delete db.st.primary_vn_v1;
  c.afterRestore();
  assert.equal(db.st.site_url, 'https://rosewedding.vn');
  db.st.site_url = 'https://khac.vn';
  c.afterRestore();
  assert.equal(db.st.site_url, 'https://khac.vn', 'đã có marker thì tôn trọng lựa chọn sau này');
});

test('site_url có www được chuẩn hoá về không www (tránh 301 ngược chiều)', () => {
  assert.equal(parseSiteUrl('https://www.rosewedding.vn/').host, 'rosewedding.vn');
  const p = parseSiteUrl('https://www.rosewedding.vn');
  const base = { method: 'GET', protocol: 'https', search: '', primary: p, lookups: noLookups };
  assert.equal(decide({ ...base, primaryActive: false, hostHeader: 'www.rosewedding.vn', path: '/x' }), 'https://rosewedding.vn/x');
  assert.equal(decide({ ...base, primaryActive: true, hostHeader: 'rosewedding.vn', path: '/x' }), null, 'sau kích hoạt không đẩy ngược sang www');
});

test('/album/<concept> đi thẳng một bước về /concept/<slug>', () => {
  const lk = {
    postExists: () => false,
    albumBySlug: s => (s === 'ao-dai' ? { slug: 'ao-dai', category: 'concept' } : s === 'lam-diep' ? { slug: 'lam-diep', category: 'signature' } : null)
  };
  assert.equal(legacyTarget('/album/ao-dai', lk), '/concept/ao-dai');
  assert.equal(legacyTarget('/album/lam-diep', lk), null);
  const d = decide({ method: 'GET', protocol: 'https', search: '', primary: VN, primaryActive: true, lookups: lk, hostHeader: 'rosewedding.net', path: '/album/ao-dai' });
  assert.equal(d, 'https://rosewedding.vn/concept/ao-dai');
});

/* ---------- Bổ sung sau đợt rà soát 09/10/2026 ---------- */
const { oldHtmlTarget, checkPrimary } = require('../src/canonical');

test('link cũ: bài album Haravan về đúng album/concept tương ứng (tra database), mất album thì lùi về danh sách', () => {
  const albums = { 'fine-art': 'signature', 'han-quoc': 'signature', 'editorial-tap-chi': 'concept', 'phim-truong': 'signature', 'studio-phim-truong': 'concept' };
  const lk = { postExists: () => false, albumBySlug: s => (albums[s] ? { slug: s, category: albums[s] } : null) };
  const cases = {
    '/blogs/anh-cuoi/concept-fine-art-200-bong-hong-white-roses': '/album/fine-art',
    '/blogs/anh-cuoi/concept-han-quoc-nhe-nhang': '/album/han-quoc',
    '/blogs/anh-cuoi/anh-cuoi-tap-chi': '/concept/editorial-tap-chi',
    '/blogs/anh-cuoi/concept-co-dien-sang-trong': '/album/phim-truong',
    '/anh-cuoi/phim-truong-santorini-preweddingmot': '/concept/studio-phim-truong',
    '/blogs/anh-cuoi/studio-tuong-hoa': '/concept/studio-phim-truong'
  };
  for (const [from, to] of Object.entries(cases)) assert.equal(legacyTarget(from, lk), to, from);
  assert.equal(legacyTarget('/blogs/anh-cuoi/concept-han-quoc-nhe-nhang', noLookups), '/concept', 'album bị ẩn/xoá: về danh sách concept');
});

test('link cũ: váy cưới, /pages/news, sản phẩm Haravan, /bang-gia trần', () => {
  assert.equal(legacyTarget('/blogs/news/xu-huong-vay-cuoi-2020', noLookups), '/vay-cuoi');
  assert.equal(legacyTarget('/pages/news', noLookups), '/tin-tuc');
  assert.equal(legacyTarget('/collections/news', noLookups), '/tin-tuc');
  assert.equal(legacyTarget('/products/goi-chup-abc', noLookups), '/bang-gia/anh-cuoi');
  assert.equal(legacyTarget('/products/bang-gia-combo-chup-anh-cuoi', noLookups), '/bang-gia/combo');
  assert.equal(legacyTarget('/bang-gia', noLookups), '/bang-gia/anh-cuoi');
  assert.equal(legacyTarget('/bang-gia/combo', noLookups), null);
});

test('web tĩnh đời đầu (*.html): một bước tới trang mới, chặn tham số lạ', () => {
  const lk = { postExists: () => false, albumBySlug: s => (s === 'studio-phim-truong' ? { slug: s, category: 'concept' } : s === 'lam-diep' ? { slug: s, category: 'signature' } : null) };
  assert.equal(oldHtmlTarget('/index.html', '', lk), '/');
  assert.equal(oldHtmlTarget('/album.html', '?key=studio-phim-truong', lk), '/concept/studio-phim-truong');
  assert.equal(oldHtmlTarget('/album.html', '?key=lam-diep', lk), '/album/lam-diep');
  assert.equal(oldHtmlTarget('/album.html', '?key=khong-co', lk), '/anh-cuoi');
  assert.equal(oldHtmlTarget('/bang-gia.html', '?type=combo', lk), '/bang-gia/combo');
  assert.equal(oldHtmlTarget('/bang-gia.html', '?type=//evil.com', lk), '/bang-gia/anh-cuoi');
  assert.equal(oldHtmlTarget('/post.html', '?id=chuan-bi-chup-cuoi', lk), '/tin-tuc/chuan-bi-chup-cuoi');
  assert.equal(oldHtmlTarget('/post.html', '', lk), '/tin-tuc');
  assert.equal(oldHtmlTarget('/concept', '', lk), null);
  const d = decide({ method: 'GET', protocol: 'https', search: '?key=studio-phim-truong', primary: VN, primaryActive: true, lookups: lk, hostHeader: 'www.rosewedding.net', path: '/album.html' });
  assert.equal(d, 'https://rosewedding.vn/concept/studio-phim-truong', 'đổi host + đường dẫn trong MỘT bước');
});

test('host có cổng hoặc dấu chấm cuối không tự chuyển về chính nó', () => {
  assert.equal(run({ hostHeader: 'rosewedding.vn:443', path: '/concept' }), null);
  assert.equal(run({ hostHeader: 'rosewedding.vn.', path: '/concept' }), null);
  assert.equal(run({ hostHeader: 'rosewedding.net:443', path: '/concept' }), 'https://rosewedding.vn/concept');
});

test('đường dẫn dài toàn dấu / không làm treo server', () => {
  const t0 = Date.now();
  run({ hostHeader: 'rosewedding.vn', path: '/a' + '/'.repeat(200000) + 'x' });
  run({ hostHeader: 'rosewedding.vn', path: '/a' + '/'.repeat(200000) });
  assert.ok(Date.now() - t0 < 500, 'phải xử lý gần như tức thì');
  assert.equal(run({ hostHeader: 'rosewedding.vn', path: '/concept///' }), '/concept');
});

test('ô site_url gõ thiếu https:// vẫn hiểu; tên miền Rosé luôn https', () => {
  assert.equal(parseSiteUrl('rosewedding.vn').origin, 'https://rosewedding.vn');
  assert.equal(parseSiteUrl('http://rosewedding.vn').origin, 'https://rosewedding.vn');
  assert.equal(parseSiteUrl('www.rosewedding.vn/').host, 'rosewedding.vn');
  assert.equal(parseSiteUrl('abc'), null);
  assert.equal(parseSiteUrl('ftp://rosewedding.vn'), null);
});

test('kích hoạt đúng lúc một lần kiểm tra XÁC NHẬN đủ 24 giờ (không sớm hơn)', () => {
  const st = { host: 'rosewedding.vn', firstOkAt: 1000, lastOkAt: 1000 + GRACE_MS - 60000 };
  assert.equal(isActive(VN, st, 1000 + GRACE_MS + 30000), false, 'đồng hồ đã qua 24 giờ nhưng chưa có lần đạt xác nhận');
  assert.equal(isActive(VN, { ...st, lastOkAt: 1000 + GRACE_MS }, 1000 + GRACE_MS + 30000), true);
});

test('sau đợt trượt dài hơn 3 giờ (VD tên miền hết hạn rồi gia hạn): đếm lại đủ 24 giờ', () => {
  const T = 1000;
  let s = nextState({}, 'rosewedding.vn', true, '', T);
  s = nextState(s, 'rosewedding.vn', true, '', T + GRACE_MS);
  assert.equal(isActive(VN, s, T + GRACE_MS), true);
  s = nextState(s, 'rosewedding.vn', false, 'NXDOMAIN', T + GRACE_MS + 60000);
  s = nextState(s, 'rosewedding.vn', false, 'NXDOMAIN', T + GRACE_MS + STALE_MS + 60000);
  assert.equal(isActive(VN, s, T + GRACE_MS + STALE_MS + 60000), false, 'quá 3 giờ: tạm ngừng');
  s = nextState(s, 'rosewedding.vn', true, '', T + GRACE_MS + 3 * STALE_MS);
  assert.equal(isActive(VN, s, T + GRACE_MS + 3 * STALE_MS), false, 'đạt lại nhưng phải chờ thêm 24 giờ');
  assert.equal(s.firstOkAt, T + GRACE_MS + 3 * STALE_MS);
  let r = nextState({}, 'rosewedding.vn', true, '', T);
  r = nextState(r, 'rosewedding.vn', true, '', T + GRACE_MS);
  r = nextState(r, 'rosewedding.vn', true, '', T + GRACE_MS + 5 * STALE_MS);
  assert.equal(isActive(VN, r, T + GRACE_MS + 5 * STALE_MS), true, 'server chỉ tắt (không có lần trượt nào): không đếm lại');
});

test('DNS công khai: một bên tạm không hỏi được thì dựa bên còn lại; trả lời "không có IP"/NXDOMAIN là trượt', async () => {
  const p = parseSiteUrl('https://rosewedding.vn');
  const site = { status: 200, text: async () => 'rose-domain-check:tok' };
  const mk = (google, cloudflare) => async url => {
    const pick = url.includes('dns.google') ? google : url.includes('cloudflare-dns') ? cloudflare : null;
    if (!pick) return site;
    if (pick === 'down') throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } });
    if (pick === 'http500') return { ok: false, status: 500 };
    if (pick === 'nx') return { ok: true, json: async () => ({ Status: 3 }) };
    if (pick === 'empty') return { ok: true, json: async () => ({ Status: 0 }) };
    return { ok: true, json: async () => ({ Status: 0, Answer: [{ type: 1, data: '1.2.3.4' }] }) };
  };
  await checkPrimary(p, 'tok', mk('ip', 'down'));
  await checkPrimary(p, 'tok', mk('http500', 'ip'));
  await assert.rejects(checkPrimary(p, 'tok', mk('down', 'down')), /ECONNRESET/);
  await assert.rejects(checkPrimary(p, 'tok', mk('ip', 'empty')), /chưa thấy địa chỉ IP/);
  await assert.rejects(checkPrimary(p, 'tok', mk('nx', 'ip')), /NXDOMAIN/);
});

test('server: trạng thái admin báo "tạm ngừng" khi đã kích hoạt mà quá 3 giờ không đạt', async () => {
  const db = fakeDb({ site_url: 'https://rosewedding.vn' });
  let t = 1000;
  let mode = { dnsOk: true, siteOk: true };
  const c = createCanonical({ db, env: {}, now: () => t, autoCheck: false, fetchImpl: (u, o) => fakeFetch(db, mode)(u, o) });
  await c.runCheck();
  t += GRACE_MS;
  await c.runCheck();
  assert.equal(c.status().active, true);
  mode = { dnsOk: true, siteOk: false };
  t += 60000;
  await c.runCheck();
  assert.equal(c.status().active, true);
  assert.equal(c.status().failing, true, 'đang trượt nhưng chưa quá 3 giờ');
  t += STALE_MS;
  await c.runCheck();
  const st = c.status();
  assert.equal(st.active, false);
  assert.equal(st.paused, true);
});

test('server: canonical luôn chữ thường', () => {
  const db = fakeDb({ site_url: 'https://rosewedding.vn' });
  const c = createCanonical({ db, env: {}, now: () => 0, autoCheck: false, fetchImpl: fakeFetch(db) });
  const { res } = run1(c, fakeReq({ host: 'Rosewedding.VN', path: '/Concept', url: '/Concept?a=1' }));
  assert.equal(res.locals.pageUrl, 'https://rosewedding.vn/concept');
});

test('header X-Forwarded-Proto giả không đưa được địa chỉ lạ vào Location', () => {
  const d = decide({ method: 'GET', protocol: 'https://evil.example/x?', search: '', primary: VN, primaryActive: false, lookups: noLookups, hostHeader: 'www.rosewedding.net', path: '/concept' });
  assert.equal(d, 'https://rosewedding.net/concept');
});

test('DNS công khai trả SERVFAIL: coi như tạm không hỏi được, bên còn lại quyết định', async () => {
  const p = parseSiteUrl('https://rosewedding.vn');
  const site = { status: 200, text: async () => 'rose-domain-check:tok' };
  const mk = (google, cloudflare) => async url => {
    const pick = url.includes('dns.google') ? google : url.includes('cloudflare-dns') ? cloudflare : null;
    if (!pick) return site;
    if (pick === 'servfail') return { ok: true, json: async () => ({ Status: 2, Comment: ['EDE(9): DNSKEY Missing'] }) };
    return { ok: true, json: async () => ({ Status: 0, Answer: [{ type: 1, data: '1.2.3.4' }] }) };
  };
  await checkPrimary(p, 'tok', mk('ip', 'servfail'));
  await assert.rejects(checkPrimary(p, 'tok', mk('servfail', 'servfail')), /lỗi DNS mã 2/);
});

/**
 * Địa chỉ chuẩn của website (SEO), gộp mọi chuyển hướng thành MỘT bước 301:
 *  1. Tên miền: mọi biến thể tên miền của Rosé (www, .net, .vn) về tên miền chính.
 *  2. Đường dẫn web cũ Haravan trên rosewedding.vn về trang tương ứng của web mới.
 *  3. /album/<concept> về /concept/<slug>; dấu / thừa ở cuối URL về bản không dấu.
 *
 * Tên miền chính = cài đặt site_url trong admin, nếu trống thì biến môi trường SITE_URL.
 * Luôn dùng bản không www.
 *
 * Chống sập web khi đổi tên miền: server TỰ KIỂM TRA tên miền chính mỗi 15 phút:
 * tra DNS công khai (Google, Cloudflare) rồi tự gọi https://<tên miền chính>/__domain-check
 * (kiểm chứng chỉ SSL) và phải nhận lại đúng mã bí mật của chính website. Không tin vào
 * header của request: CDN Hostinger định tuyến theo header Host nên header giả được.
 * Chỉ khi kiểm tra đạt LIÊN TỤC suốt GRACE_MS (24 giờ, dài hơn TTL nameserver 12 giờ
 * của tên miền .vn) mới bắt đầu chuyển các tên miền khác về. Trước đó các tên miền chạy
 * song song. Không bao giờ chuyển tới tên miền khác tên miền chính.
 */
const crypto = require('crypto');

const GRACE_MS = 24 * 60 * 60 * 1000;
const STALE_MS = 3 * 60 * 60 * 1000;   /* lâu hơn mức này không kiểm tra đạt thì thôi chuyển hướng */
const CHECK_EVERY_MS = 15 * 60 * 1000;
/* Trình duyệt và CDN chỉ nhớ lệnh chuyển hướng 1 ngày: có sự cố thì tự gỡ được */
const REDIRECT_CACHE = 'public, max-age=86400';

/* Tên miền gốc thuộc Rosé. Chỉ đổi host khi request đến từ các tên miền này,
   và đích đến luôn là tên miền chính trong cài đặt (không lấy từ header của request) */
const OWN_DOMAINS = ['rosewedding.vn', 'rosewedding.net'];
const DEFAULT_PRIMARY = 'https://rosewedding.vn';

const bare = h => String(h || '').toLowerCase().replace(/^www\./, '');

function parseSiteUrl(siteUrl) {
  const raw = String(siteUrl || '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = bare(u.hostname);
    if (!host) return null;
    return { protocol: u.protocol, host, origin: `${u.protocol}//${host}` };
  } catch (e) {
    return null;
  }
}

/* Tên miền chính dự định: admin trước (anh Thắng tự đổi được), rồi tới biến môi trường */
function intendedPrimary(settings, env) {
  const fromAdmin = parseSiteUrl(settings.site_url);
  if (fromAdmin) return { ...fromAdmin, source: 'admin' };
  const fromEnv = parseSiteUrl(env.SITE_URL);
  if (fromEnv) return { ...fromEnv, source: 'env' };
  return null;
}

function parseJson(raw) {
  try {
    const v = JSON.parse(raw || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch (e) {
    return {};
  }
}

/**
 * Tên miền chính "đang hoạt động" khi: kết quả kiểm tra thuộc đúng tên miền đó,
 * đã đạt liên tục từ firstOkAt đủ GRACE_MS, và lần đạt gần nhất chưa quá STALE_MS.
 */
function isActive(primary, state, now) {
  if (!primary || !state || state.host !== primary.host) return false;
  const first = Number(state.firstOkAt);
  const last = Number(state.lastOkAt);
  return first > 0 && last > 0 && now - first >= GRACE_MS && now - last <= STALE_MS;
}

/* Cập nhật trạng thái sau một lần kiểm tra (hàm thuần) */
function nextState(prev, host, ok, error, now) {
  const s = prev && prev.host === host ? { ...prev } : { host };
  if (ok) {
    if (!s.firstOkAt) s.firstOkAt = now;
    s.lastOkAt = now;
    s.lastError = '';
  } else {
    s.lastFailAt = now;
    s.lastError = String(error || 'không rõ lỗi').slice(0, 200);
    /* Chưa kích hoạt mà trượt một lần: đếm lại 24 giờ từ đầu.
       Đã kích hoạt rồi thì chịu được trục trặc ngắn (xem STALE_MS). */
    const activated = s.firstOkAt && s.lastOkAt && s.lastOkAt - s.firstOkAt >= GRACE_MS;
    if (!activated) s.firstOkAt = null;
  }
  return s;
}

/* ---------- Đường dẫn web cũ Haravan (rosewedding.vn trước 2026) ---------- */
const PRICE = /(bang|bao)-gia/;
const LISTING = new Set(['news', 'index', 'frontpage', 'all']);

function isLegacyPath(segs) {
  if (!segs.length) return false;
  const first = segs[0];
  return first === 'blogs' || first === 'collections' || first === 'pages' ||
    /^news/.test(first) || /^index/.test(first) ||
    ['hot-products', 'lien-he', 'about-us', 'video-cuoi', 'search'].includes(first) ||
    /^(bang|bao)-gia-/.test(first) ||
    (first === 'anh-cuoi' && segs.length > 1);
}

/**
 * Trả về đường dẫn mới cho một đường dẫn web cũ, hoặc null nếu không phải web cũ.
 * lookups.postExists(slug) / lookups.albumBySlug(slug) tra database để giữ đúng bài/album
 * nếu web mới còn cùng slug.
 */
function legacyTarget(pathname, lookups) {
  const segs = String(pathname || '').toLowerCase().split('/').filter(Boolean);

  /* Album đã chuyển thành concept: đi thẳng một bước (không qua route /album rồi mới 301) */
  if (segs.length === 2 && segs[0] === 'album') {
    const a = lookups.albumBySlug(segs[1]);
    return a && a.category === 'concept' ? '/concept/' + a.slug : null;
  }

  if (!isLegacyPath(segs)) return null;
  const first = segs[0];
  const last = segs[segs.length - 1];

  if (/^(about-us|gioi-thieu)/.test(last)) return '/cau-chuyen';
  if (last === 'lien-he') return '/#booking';

  const priceSeg = PRICE.test(last) ? last : (LISTING.has(last) ? segs.find(s => PRICE.test(s)) : null);
  if (priceSeg) {
    if (/combo/.test(priceSeg)) return '/bang-gia/combo';
    if (/phong-su/.test(priceSeg)) return '/bang-gia/phong-su';
    return '/bang-gia/anh-cuoi';
  }

  const blogHandle = first === 'blogs' ? (segs[1] || '') : '';
  const articleSlug = first === 'blogs' ? segs[2] : segs[1];

  if (/^news/.test(first) || blogHandle === 'news') {
    if (articleSlug && !LISTING.has(articleSlug) && lookups.postExists(articleSlug)) return '/tin-tuc/' + articleSlug;
    return '/tin-tuc';
  }
  if (/^phong-su/.test(blogHandle)) return '/phong-su';
  if (/^video/.test(blogHandle) || first === 'video-cuoi') return '/#video';
  if (/^anh-cuoi/.test(blogHandle) || first === 'anh-cuoi') {
    const album = articleSlug && !LISTING.has(articleSlug) ? lookups.albumBySlug(articleSlug) : null;
    if (album) return (album.category === 'concept' ? '/concept/' : '/album/') + album.slug;
    if (articleSlug && /concept|studio|phim-truong/.test(articleSlug)) return '/concept';
    return '/anh-cuoi';
  }
  return '/';
}

/**
 * Quyết định chuyển hướng (hàm thuần, dễ kiểm thử).
 * Trả về chuỗi Location (tuyệt đối khi đổi host, tương đối khi giữ host) hoặc null.
 */
function decide({ method, hostHeader, protocol, path, search, primary, primaryActive, lookups }) {
  if (method !== 'GET' && method !== 'HEAD') return null;
  /* Admin và trang tự kiểm tra miễn mọi chuyển hướng: luôn vào được để sửa cài đặt */
  if (path === '/admin' || path.startsWith('/admin/') || path === '/__domain-check') return null;

  const host = String(hostHeader || '').toLowerCase();
  const hostname = host.replace(/:\d+$/, '');
  const ownHost = OWN_DOMAINS.includes(bare(hostname)) || (primary && bare(hostname) === primary.host);

  let targetHost = host;
  let targetProtocol = `${protocol}:`;
  if (ownHost) {
    if (primary && primaryActive) {
      targetHost = primary.host;
      targetProtocol = primary.protocol;
    } else if (hostname.startsWith('www.')) {
      targetHost = bare(hostname); /* chỉ bỏ www trong cùng tên miền (tên miền chính luôn không www) */
    }
  }

  const mapped = legacyTarget(path, lookups);
  let newPath = mapped || path;
  const newSearch = mapped ? '' : (search || '');
  if (!mapped && newPath.length > 1 && newPath.endsWith('/')) newPath = newPath.replace(/\/+$/, '') || '/';
  /* Gộp các dấu / hoặc \ ở đầu thành một: "//trang-la.com" trong Location sẽ đưa khách
     sang web khác (open redirect) */
  newPath = '/' + newPath.replace(/^[\/\\]+/, '');

  const hostChanged = targetHost !== host;
  if (!hostChanged && newPath === path && newSearch === (search || '')) return null;
  return hostChanged ? `${targetProtocol}//${targetHost}${newPath}${newSearch}` : `${newPath}${newSearch}`;
}

/* ---------- Tự kiểm tra tên miền chính ---------- */
async function checkPrimary(primary, token, fetchImpl) {
  const q = encodeURIComponent(primary.host);
  const resolvers = [
    ['Google DNS', `https://dns.google/resolve?name=${q}&type=A`],
    ['Cloudflare DNS', `https://cloudflare-dns.com/dns-query?name=${q}&type=A`]
  ];
  for (const [name, url] of resolvers) {
    const r = await fetchImpl(url, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const ips = (j.Answer || []).filter(a => a.type === 1).map(a => a.data);
    if (!ips.length) throw new Error(`${name} chưa thấy địa chỉ IP của ${primary.host}`);
  }
  /* Gọi chính mình qua tên miền chính: fetch kiểm chứng chỉ SSL, mã bí mật chứng minh
     tên miền đi đúng vào website này (không phải trang đỗ của nhà cung cấp) */
  const r = await fetchImpl(`${primary.origin}/__domain-check?n=${Date.now()}`, {
    redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { 'cache-control': 'no-cache' }
  });
  const body = (await r.text()).trim();
  if (r.status !== 200 || body !== `rose-domain-check:${token}`) {
    throw new Error(`${primary.origin} chưa trả về đúng website (mã ${r.status})`);
  }
}

/* ---------- Gắn vào Express ---------- */
function createCanonical({ db, env = process.env, now = () => Date.now(), fetchImpl = globalThis.fetch, autoCheck = true }) {
  let settingsCache = null;
  let settingsAt = 0;
  const settings = () => {
    if (!settingsCache || now() - settingsAt > 3000) { settingsCache = db.allSettings(); settingsAt = now(); }
    return settingsCache;
  };

  let state = null;
  let stateAt = 0;
  const loadState = () => {
    if (!state || now() - stateAt > 60000) { state = parseJson(db.setting('domain_check')); stateAt = now(); }
    return state;
  };

  const token = () => {
    let t = db.setting('domain_check_token');
    if (!t) { t = crypto.randomBytes(16).toString('hex'); db.setSetting('domain_check_token', t); }
    return t;
  };

  const lookups = {
    postExists: slug => !!db.get('SELECT 1 FROM posts WHERE slug = ? AND visible = 1', slug),
    albumBySlug: slug => db.get('SELECT slug, category FROM albums WHERE slug = ? AND visible = 1', slug) || null
  };

  /* Tên miền chính lâu dài: rosewedding.vn (anh Thắng chốt 09/10/2026). Chạy lúc khởi động
     và sau khi khôi phục sao lưu cũ (bản cũ không có marker sẽ được đặt lại đúng .vn) */
  function ensurePrimaryDefault() {
    if (db.setting('primary_vn_v1')) return;
    db.setSetting('site_url', DEFAULT_PRIMARY);
    db.setSetting('primary_vn_v1', '1');
    settingsCache = null;
    console.log(`[domain] Tên miền chính dự định: ${DEFAULT_PRIMARY} (tự kích hoạt khi chạy ổn định 24 giờ)`);
  }

  let checking = false;
  async function runCheck() {
    const primary = intendedPrimary(settings(), env);
    if (!primary || checking) return null;
    checking = true;
    let ok = false;
    let error = '';
    try {
      await checkPrimary(primary, token(), fetchImpl);
      ok = true;
    } catch (e) {
      error = e && e.name === 'TimeoutError' ? 'quá thời gian chờ phản hồi' : (e && e.message) || String(e);
    } finally {
      checking = false;
    }
    const prev = parseJson(db.setting('domain_check'));
    const wasActive = isActive(primary, prev, now());
    const next = nextState(prev, primary.host, ok, error, now());
    db.setSetting('domain_check', JSON.stringify(next));
    state = next;
    stateAt = now();
    const active = isActive(primary, next, now());
    if (ok && !prev.firstOkAt) console.log(`[domain] ${primary.host} đã chạy; sẽ thành tên miền chính sau 24 giờ ổn định`);
    if (!ok && prev.firstOkAt && !next.firstOkAt) console.log(`[domain] ${primary.host} kiểm tra trượt (${error}); đếm lại 24 giờ`);
    if (active && !wasActive) console.log(`[domain] ${primary.host} chính thức là tên miền chính`);
    return { ok, error, active };
  }

  function status() {
    const primary = intendedPrimary(settings(), env);
    const s = loadState();
    const mine = primary && s.host === primary.host ? s : {};
    return {
      primary,
      active: isActive(primary, s, now()),
      firstOkAt: Number(mine.firstOkAt) || null,
      lastOkAt: Number(mine.lastOkAt) || null,
      lastFailAt: Number(mine.lastFailAt) || null,
      lastError: mine.lastError || '',
      activatesAt: mine.firstOkAt ? Number(mine.firstOkAt) + GRACE_MS : null
    };
  }

  function middleware(req, res, next) {
    if (req.path === '/__domain-check') {
      res.set('Cache-Control', 'no-store');
      return res.type('text/plain').send(`rose-domain-check:${token()}`);
    }

    const primary = intendedPrimary(settings(), env);
    const primaryActive = isActive(primary, loadState(), now());

    res.set('X-Served-Host', String(req.get('host') || '').toLowerCase());
    res.locals.baseUrl = primary && primaryActive ? primary.origin : `${req.protocol}://${req.get('host')}`;
    res.locals.pageUrl = res.locals.baseUrl + req.originalUrl.split('?')[0];

    const qIndex = req.originalUrl.indexOf('?');
    const location = decide({
      method: req.method,
      hostHeader: req.get('host'),
      protocol: req.protocol,
      path: req.path,
      search: qIndex >= 0 ? req.originalUrl.slice(qIndex) : '',
      primary,
      primaryActive,
      lookups
    });
    if (location) {
      res.set('Cache-Control', REDIRECT_CACHE);
      return res.redirect(301, location);
    }
    next();
  }

  /* Gọi sau khi khôi phục sao lưu: database mới có thể mang cài đặt khác */
  function afterRestore() {
    settingsCache = null;
    state = null;
    ensurePrimaryDefault();
  }

  if (autoCheck) {
    setTimeout(() => runCheck().catch(() => {}), 30 * 1000).unref();
    setInterval(() => runCheck().catch(() => {}), CHECK_EVERY_MS).unref();
  }

  return { middleware, status, runCheck, ensurePrimaryDefault, afterRestore };
}

/* Một bản dùng chung cho server và trang admin */
let instance = null;
function canonical() {
  if (!instance) instance = createCanonical({ db: require('./db') });
  return instance;
}

module.exports = {
  canonical, createCanonical, decide, legacyTarget, intendedPrimary, isActive, nextState,
  parseSiteUrl, checkPrimary, GRACE_MS, STALE_MS, OWN_DOMAINS
};

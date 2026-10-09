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
/* Trình duyệt và CDN Hostinger (hcdn) chỉ nhớ lệnh chuyển hướng 1 giờ: CDN có lưu 301,
   để lâu thì sau khi kích hoạt khách đi 2 bước, và khi tự ngừng chuyển (STALE_MS) khách
   vẫn bị đẩy theo lệnh cũ. Google vẫn coi 301 là vĩnh viễn, không phụ thuộc thời gian nhớ */
const REDIRECT_CACHE = 'public, max-age=3600';

/* Tên miền gốc thuộc Rosé. Chỉ đổi host khi request đến từ các tên miền này,
   và đích đến luôn là tên miền chính trong cài đặt (không lấy từ header của request) */
const OWN_DOMAINS = ['rosewedding.vn', 'rosewedding.net'];
const DEFAULT_PRIMARY = 'https://rosewedding.vn';

/* Chuẩn hoá host: chữ thường, bỏ cổng, bỏ dấu chấm cuối (FQDN), bỏ www */
const hostOnly = h => String(h || '').toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
const bare = h => hostOnly(h).replace(/^www\./, '');

/* Ô site_url do anh Thắng gõ tay: thiếu https:// vẫn hiểu; tên miền của Rosé luôn dùng https */
function parseSiteUrl(siteUrl) {
  let raw = String(siteUrl || '').trim();
  if (!raw) return null;
  if (!raw.includes('://')) raw = 'https://' + raw;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = bare(u.hostname);
    if (!host || !host.includes('.')) return null;
    const protocol = OWN_DOMAINS.includes(host) ? 'https:' : u.protocol;
    return { protocol, host, origin: `${protocol}//${host}` };
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

/* Đã có một lần kiểm tra đạt XÁC NHẬN đủ GRACE_MS chạy liên tục (cùng quy tắc với nextState) */
function confirmed(state) {
  const first = Number(state && state.firstOkAt);
  const last = Number(state && state.lastOkAt);
  return first > 0 && last > 0 && last - first >= GRACE_MS;
}

/**
 * Tên miền chính "đang hoạt động" khi: kết quả kiểm tra thuộc đúng tên miền đó,
 * đã có lần kiểm tra đạt xác nhận đủ GRACE_MS liên tục, và lần đạt gần nhất chưa quá STALE_MS.
 */
function isActive(primary, state, now) {
  if (!primary || !state || state.host !== primary.host) return false;
  return confirmed(state) && now - Number(state.lastOkAt) <= STALE_MS;
}

/* Cập nhật trạng thái sau một lần kiểm tra (hàm thuần) */
function nextState(prev, host, ok, error, now) {
  const s = prev && prev.host === host ? { ...prev } : { host };
  if (ok) {
    /* Lần đầu đạt, hoặc vừa qua một đợt trượt liên tục dài hơn STALE_MS (VD tên miền hết hạn
       rồi gia hạn lại): đếm lại đủ 24 giờ, vì DNS của các nhà mạng có thể chưa cập nhật lại */
    const longOutage = Number(s.lastFailAt) > Number(s.lastOkAt || 0) && now - Number(s.lastOkAt || 0) > STALE_MS;
    if (!s.firstOkAt || longOutage) s.firstOkAt = now;
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
/* Bài album cũ trên Haravan → album/concept tương ứng của web mới (tra qua database:
   album bị ẩn hoặc xoá thì tự lùi về trang danh sách) */
const LEGACY_ALBUM = {
  'concept-fine-art-200-bong-hong-white-roses': 'fine-art',
  'concept-fine-art-chau-au': 'fine-art',
  'concept-han-quoc-nhe-nhang': 'han-quoc',
  'concept-han-quoc-tuong-hoa-flowers-wall': 'han-quoc',
  'anh-cuoi-tap-chi': 'editorial-tap-chi',
  'concept-phim-truong-sang-trong-nhung-khong-kem-phan-lang-man': 'phim-truong',
  'concept-co-dien-sang-trong': 'phim-truong',
  'phim-truong-santorini-preweddingmot': 'studio-phim-truong',
  'concept-vuon-hoa-phim-truong': 'studio-phim-truong',
  'studio-less-is-more': 'studio-phim-truong',
  'studio-tuong-hoa': 'studio-phim-truong'
};
/* Trang của web tĩnh đời đầu (*.html) → trang mới, gộp vào cùng một bước 301 */
const OLD_HTML = {
  '/index.html': '/', '/anh-cuoi.html': '/anh-cuoi', '/vay-cuoi.html': '/vay-cuoi',
  '/cau-chuyen.html': '/cau-chuyen', '/tin-tuc.html': '/tin-tuc'
};
const SLUG = /^[a-z0-9-]+$/;

function isLegacyPath(segs) {
  if (!segs.length) return false;
  const first = segs[0];
  return first === 'blogs' || first === 'collections' || first === 'pages' || first === 'products' ||
    /^news/.test(first) || /^index/.test(first) ||
    ['hot-products', 'lien-he', 'about-us', 'video-cuoi', 'search'].includes(first) ||
    /^(bang|bao)-gia-/.test(first) ||
    (first === 'anh-cuoi' && segs.length > 1);
}

/* Web tĩnh đời đầu: album.html?key=..., bang-gia.html?type=..., post.html?id=... */
function oldHtmlTarget(pathname, search, lookups) {
  const p = String(pathname || '').toLowerCase();
  if (!p.endsWith('.html')) return null;
  if (OLD_HTML[p]) return OLD_HTML[p];
  const q = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const pick = k => String(q.get(k) || '').trim().toLowerCase();
  if (p === '/album.html') {
    const a = SLUG.test(pick('key')) ? lookups.albumBySlug(pick('key')) : null;
    return a ? (a.category === 'concept' ? '/concept/' : '/album/') + a.slug : '/anh-cuoi';
  }
  if (p === '/bang-gia.html') return '/bang-gia/' + (SLUG.test(pick('type')) ? pick('type') : 'anh-cuoi');
  if (p === '/post.html') return SLUG.test(pick('id')) ? '/tin-tuc/' + pick('id') : '/tin-tuc';
  return null;
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
  /* /bang-gia trần trùng nội dung /bang-gia/anh-cuoi: gom về một địa chỉ */
  if (segs.length === 1 && segs[0] === 'bang-gia') return '/bang-gia/anh-cuoi';

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
    if (articleSlug && /vay-cuoi/.test(articleSlug)) return '/vay-cuoi';
    return '/tin-tuc';
  }
  if (/^phong-su/.test(blogHandle)) return '/phong-su';
  if (/^video/.test(blogHandle) || first === 'video-cuoi') return '/#video';
  if (/^anh-cuoi/.test(blogHandle) || first === 'anh-cuoi') {
    const album = articleSlug && !LISTING.has(articleSlug)
      ? lookups.albumBySlug(articleSlug) || (LEGACY_ALBUM[articleSlug] ? lookups.albumBySlug(LEGACY_ALBUM[articleSlug]) : null)
      : null;
    if (album) return (album.category === 'concept' ? '/concept/' : '/album/') + album.slug;
    if (articleSlug && /concept|studio|phim-truong/.test(articleSlug)) return '/concept';
    return '/anh-cuoi';
  }
  if (last === 'news') return '/tin-tuc';
  /* Sản phẩm Haravan cũ đều là gói dịch vụ chụp */
  if (first === 'products') return '/bang-gia/anh-cuoi';
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

  const hostname = hostOnly(hostHeader);
  const ownHost = OWN_DOMAINS.includes(bare(hostname)) || (primary && bare(hostname) === primary.host);

  let targetHost = null; /* null = giữ nguyên host của request */
  /* Chỉ nhận http/https: giao thức lấy từ header X-Forwarded-Proto, người lạ có thể gửi giá trị bất kỳ */
  let targetProtocol = protocol === 'http' ? 'http:' : 'https:';
  if (ownHost) {
    if (primary && primaryActive) {
      if (hostname !== primary.host) {
        targetHost = primary.host;
        targetProtocol = primary.protocol;
      }
    } else if (hostname.startsWith('www.')) {
      targetHost = bare(hostname); /* chỉ bỏ www trong cùng tên miền (tên miền chính luôn không www) */
    }
  }

  const mapped = oldHtmlTarget(path, search, lookups) || legacyTarget(path, lookups);
  let newPath = mapped || path;
  const newSearch = mapped ? '' : (search || '');
  if (!mapped) newPath = stripTrailingSlashes(newPath);
  /* Gộp các dấu / hoặc \ ở đầu thành một: "//trang-la.com" trong Location sẽ đưa khách
     sang web khác (open redirect) */
  newPath = '/' + newPath.replace(/^[\/\\]+/, '');

  if (!targetHost && newPath === path && newSearch === (search || '')) return null;
  return targetHost ? `${targetProtocol}//${targetHost}${newPath}${newSearch}` : `${newPath}${newSearch}`;
}

/* Bỏ các dấu / ở cuối (giữ "/" cho trang chủ). Vòng lặp thay regex /\/+$/ vì regex đó
   chạy rất chậm với chuỗi dài toàn dấu / (đường dẫn do người lạ gửi lên) */
function stripTrailingSlashes(p) {
  let end = p.length;
  while (end > 1 && p.charCodeAt(end - 1) === 47) end--;
  return p.slice(0, end);
}

/* ---------- Tự kiểm tra tên miền chính ---------- */
/* Lỗi mạng của fetch chỉ ghi "fetch failed": kèm mã nguyên nhân (ENOTFOUND, cert...) cho dễ đoán bệnh */
function errText(e) {
  if (e && e.name === 'TimeoutError') return 'quá thời gian chờ phản hồi';
  const cause = e && e.cause && (e.cause.code || e.cause.message);
  return ((e && e.message) || String(e)) + (cause ? ` (${cause})` : '');
}

/* Hỏi một DNS công khai. Trả { ips } khi DNS đó trả lời, { error } khi không hỏi được
   (mạng, HTTP lỗi): không hỏi được thì chưa kết luận gì về tên miền */
async function askResolver(name, url, host, fetchImpl) {
  let j;
  try {
    const r = await fetchImpl(url, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(8000) });
    if (r.ok === false) return { error: `${name} lỗi HTTP ${r.status}` };
    j = await r.json();
  } catch (e) {
    return { error: `${name}: ${errText(e)}` };
  }
  /* SERVFAIL/REFUSED...: DNS đó tạm không trả lời được, chưa kết luận (NXDOMAIN = 3 mới là "không tồn tại") */
  if (j && j.Status && j.Status !== 3) {
    return { error: `${name}: lỗi DNS mã ${j.Status}${j.Comment ? ' (' + [].concat(j.Comment).join(' ') + ')' : ''}` };
  }
  if (j && j.Status === 3) {
    throw new Error(`${name}: ${host} không tồn tại (NXDOMAIN), kiểm tra hạn và trạng thái tên miền`);
  }
  const ips = ((j && j.Answer) || []).filter(a => a.type === 1).map(a => a.data);
  /* Nameserver vừa đổi: nhà mạng còn nhớ nameserver cũ tới hết TTL (.vn là 12 giờ) */
  if (!ips.length) throw new Error(`${name} chưa thấy địa chỉ IP của ${host} (còn nhớ DNS cũ, tự hết trong tối đa 12 giờ sau khi đổi nameserver)`);
  return { ips };
}

async function checkPrimary(primary, token, fetchImpl) {
  const q = encodeURIComponent(primary.host);
  const resolvers = [
    ['Google DNS', `https://dns.google/resolve?name=${q}&type=A`],
    ['Cloudflare DNS', `https://cloudflare-dns.com/dns-query?name=${q}&type=A`]
  ];
  /* DNS nào trả lời "không có IP" là trượt ngay. Một DNS tạm không hỏi được thì dựa vào DNS
     còn lại; cả hai đều không hỏi được thì trượt (chưa có bằng chứng tên miền chạy) */
  const answers = [];
  for (const [name, url] of resolvers) answers.push(await askResolver(name, url, primary.host, fetchImpl));
  if (!answers.some(a => a.ips)) throw new Error(answers.map(a => a.error).join('; '));
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

  let lastActive = null; /* { host, active } để ghi log đúng lúc bắt đầu / ngừng chuyển hướng */

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
      error = errText(e);
    } finally {
      checking = false;
    }
    const prev = parseJson(db.setting('domain_check'));
    const next = nextState(prev, primary.host, ok, error, now());
    db.setSetting('domain_check', JSON.stringify(next));
    state = next;
    stateAt = now();
    const active = isActive(primary, next, now());
    const h = primary.host;
    if (ok && next.firstOkAt !== prev.firstOkAt) console.log(`[domain] ${h} đã chạy; sẽ thành tên miền chính sau 24 giờ ổn định`);
    if (!ok && prev.firstOkAt && !next.firstOkAt) console.log(`[domain] ${h} kiểm tra trượt (${error}); đếm lại 24 giờ`);
    if (!ok && confirmed(next) && !(Number(prev.lastFailAt) > Number(prev.lastOkAt || 0))) {
      console.log(`[domain] ${h} bắt đầu kiểm tra trượt (${error}); quá 3 giờ không đạt sẽ tạm ngừng chuyển hướng`);
    }
    /* Lần đầu sau khởi động (hoặc vừa đổi tên miền chính): lấy trạng thái tại lần kiểm tra
       gần nhất đã lưu, không phải "bây giờ", kẻo bỏ sót log NGỪNG khi server tắt quá 3 giờ */
    const wasActive = lastActive && lastActive.host === h
      ? lastActive.active
      : isActive(primary, prev, Math.max(Number(prev.lastOkAt) || 0, Number(prev.lastFailAt) || 0));
    if (active !== wasActive) {
      console.log(active ? `[domain] ${h} chính thức là tên miền chính: các tên miền khác chuyển về đây`
        : `[domain] ${h} NGỪNG chuyển hướng (${error || 'quá lâu không kiểm tra đạt'}); các tên miền chạy song song`);
    }
    lastActive = { host: h, active };
    return { ok, error, active };
  }

  function status() {
    const primary = intendedPrimary(settings(), env);
    const s = loadState();
    const mine = primary && s.host === primary.host ? s : {};
    const active = isActive(primary, s, now());
    const lastOkAt = Number(mine.lastOkAt) || null;
    const lastFailAt = Number(mine.lastFailAt) || null;
    return {
      primary,
      active,
      /* đã từng kích hoạt nhưng quá STALE_MS không kiểm tra đạt: đang tạm ngừng chuyển hướng */
      paused: !active && confirmed(mine),
      failing: !!lastFailAt && lastFailAt > (lastOkAt || 0),
      firstOkAt: Number(mine.firstOkAt) || null,
      lastOkAt,
      lastFailAt,
      lastError: mine.lastError || '',
      activatesAt: mine.firstOkAt ? Number(mine.firstOkAt) + GRACE_MS : null,
      /* đang chuyển hướng mà kiểm tra trượt liên tục: tới mốc này sẽ tạm ngừng */
      pausesAt: lastOkAt ? lastOkAt + STALE_MS : null
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
    const proto = req.protocol === 'http' ? 'http' : 'https';
    res.locals.baseUrl = primary && primaryActive ? primary.origin : `${proto}://${String(req.get('host') || '').toLowerCase()}`;
    /* Canonical luôn chữ thường: /Concept và /concept là một trang (slug trên web đều chữ thường) */
    res.locals.pageUrl = res.locals.baseUrl + req.path.toLowerCase();

    const qIndex = req.originalUrl.indexOf('?');
    const location = decide({
      method: req.method,
      hostHeader: req.get('host'),
      protocol: proto,
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
  canonical, createCanonical, decide, legacyTarget, oldHtmlTarget, intendedPrimary, isActive, nextState,
  parseSiteUrl, checkPrimary, GRACE_MS, STALE_MS, OWN_DOMAINS, REDIRECT_CACHE
};

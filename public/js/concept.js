/* Rosé · trang hạng mục concept: lưới so le giữ thứ tự + xem ảnh lớn (phóng to, vuốt, link riêng từng concept) */
(function () {
  'use strict';

  const gal = document.getElementById('ccGal');
  if (!gal) return;
  const items = [].slice.call(gal.querySelectorAll('.cc-it'));
  if (!items.length) return;
  const albumName = gal.dataset.name || '';
  const zalo = gal.dataset.zalo || '';

  /* ---------- Thanh tab dính ngay dưới header (header cao khác nhau giữa máy tính và điện thoại) ---------- */
  const header = document.getElementById('header');
  const setHdr = () => {
    if (header) document.documentElement.style.setProperty('--hdr', header.offsetHeight + 'px');
  };
  setHdr();
  window.addEventListener('resize', setHdr);
  if (header) header.addEventListener('transitionend', setHdr);

  /* Tab đang xem nằm ngoài khung trên điện thoại: cuộn ngang cho lộ ra */
  const onTab = document.querySelector('.cc-tab.on');
  if (onTab) {
    const bar = onTab.parentElement;
    if (bar.scrollWidth > bar.clientWidth) bar.scrollLeft = onTab.offsetLeft - (bar.clientWidth - onTab.offsetWidth) / 2;
  }

  /* ---------- Lưới so le ----------
     Mỗi bảng concept vào cột đang thấp nhất, chiều cao tính từ tỉ lệ thật lưu sẵn trong database
     (không chờ ảnh tải). Hàng trên cùng luôn là các concept đầu tiên theo thứ tự kéo thả trong admin. */
  const colsFor = w => (w < 600 ? 1 : w < 1000 ? 2 : 3);
  let curCols = 0;
  const layout = () => {
    const W = gal.clientWidth;
    if (!W) return;
    const n = colsFor(W);
    if (n === curCols) return;
    curCols = n;
    const cols = [];
    for (let k = 0; k < n; k++) {
      const el = document.createElement('div');
      el.className = 'cc-col';
      cols.push({ el, h: 0 });
    }
    items.forEach(it => {
      const ratio = (+it.dataset.h || 1) / (+it.dataset.w || 1);
      let best = cols[0];
      for (let k = 1; k < n; k++) if (cols[k].h < best.h - 0.001) best = cols[k];
      best.el.appendChild(it);
      best.h += ratio + 0.03; /* + khe giữa các ô, quy theo bề ngang cột */
    });
    gal.textContent = '';
    cols.forEach(c => gal.appendChild(c.el));
    gal.classList.add('ready');
  };
  layout();
  let lt;
  window.addEventListener('resize', () => { clearTimeout(lt); lt = setTimeout(layout, 120); });

  /* ---------- Xem ảnh lớn ---------- */
  const cl = document.createElement('div');
  cl.className = 'cl';
  cl.setAttribute('role', 'dialog');
  cl.setAttribute('aria-modal', 'true');
  cl.setAttribute('aria-label', 'Xem concept ' + albumName);
  cl.innerHTML =
    '<div class="cl-top"><span class="cl-count" aria-live="polite"></span><span class="cl-title"></span>' +
    '<button type="button" class="cl-btn cl-close" aria-label="Đóng">&times;</button></div>' +
    '<div class="cl-stage"><img class="cl-img" alt="" draggable="false" /></div>' +
    '<button type="button" class="cl-btn cl-nav cl-prev" aria-label="Concept trước">&lsaquo;</button>' +
    '<button type="button" class="cl-btn cl-nav cl-next" aria-label="Concept sau">&rsaquo;</button>' +
    '<div class="cl-bottom"><span class="cl-hint">Chạm vào ảnh để phóng to</span>' +
    (zalo ? '<a class="cl-zalo" href="https://zalo.me/' + zalo + '" target="_blank" rel="noopener"></a>' : '') +
    '</div>';
  document.body.appendChild(cl);
  const stage = cl.querySelector('.cl-stage');
  const img = cl.querySelector('.cl-img');
  const countEl = cl.querySelector('.cl-count');
  const titleEl = cl.querySelector('.cl-title');
  const closeBtn = cl.querySelector('.cl-close');
  const zaloBtn = cl.querySelector('.cl-zalo');
  const total = items.length;
  const fullOf = i => items[i].getAttribute('href');
  const wrapIdx = i => (i + total) % total;

  let cur = 0;
  let isOpen = false;
  let pushed = false;
  let lastFocus = null;

  const setZoom = on => {
    cl.classList.toggle('zoom', on);
    if (!on) { stage.scrollLeft = 0; stage.scrollTop = 0; }
  };

  const show = i => {
    cur = wrapIdx(i);
    setZoom(false);
    const it = items[cur];
    const grid = it.querySelector('img');
    const full = fullOf(cur);
    /* Hiện ngay bản đang có trong lưới, bản nét nhất tải xong thì thay vào */
    const placeholder = (grid && (grid.currentSrc || grid.src)) || full;
    img.src = placeholder;
    img.alt = albumName + ' · concept ' + (cur + 1);
    if (placeholder !== full) {
      const want = cur;
      const pre = new Image();
      pre.onload = () => { if (want === cur) img.src = full; };
      pre.src = full;
    }
    countEl.textContent = (cur + 1) + ' / ' + total;
    titleEl.textContent = albumName + ' · Concept ' + (cur + 1);
    if (zaloBtn) zaloBtn.textContent = 'Nhắn Rosé về Concept ' + (cur + 1);
    [cur + 1, cur - 1].forEach(j => { new Image().src = fullOf(wrapIdx(j)); });
    if (isOpen) history.replaceState(history.state, '', '#concept-' + (cur + 1));
  };

  const open = (i, fromLink) => {
    lastFocus = document.activeElement;
    show(i); /* isOpen còn false: chưa đụng lịch sử trình duyệt */
    isOpen = true;
    cl.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    /* Nút Back của điện thoại đóng khung xem thay vì rời trang */
    if (!fromLink) {
      history.pushState({ cl: 1 }, '', '#concept-' + (cur + 1));
      pushed = true;
    } else {
      history.replaceState(history.state, '', '#concept-' + (cur + 1));
    }
    closeBtn.focus();
  };

  const close = fromPop => {
    if (!isOpen) return;
    isOpen = false;
    setZoom(false);
    cl.classList.remove('open');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    if (!fromPop) {
      if (pushed) history.back();
      else history.replaceState(history.state, '', location.pathname + location.search);
    }
    pushed = false;
    const back = items[cur];
    if (back && back.focus) back.focus({ preventScroll: true });
    else if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  items.forEach((it, i) => it.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; /* mở tab mới vẫn theo link ảnh */
    e.preventDefault();
    open(i, false);
  }));
  closeBtn.addEventListener('click', () => close(false));
  cl.querySelector('.cl-prev').addEventListener('click', () => show(cur - 1));
  cl.querySelector('.cl-next').addEventListener('click', () => show(cur + 1));
  if (zaloBtn) zaloBtn.addEventListener('click', () => { if (window.roseTrack) window.roseTrack('zalo'); });

  /* Chạm nền tối quanh ảnh để đóng; chạm vào ảnh để phóng to đúng chỗ vừa chạm */
  /* Phần ảnh thật sự hiện ra trong khung (object-fit: contain chừa viền tối hai bên) */
  const contentRect = () => {
    const r = img.getBoundingClientRect();
    const nw = img.naturalWidth || r.width, nh = img.naturalHeight || r.height;
    const k = Math.min(r.width / nw, r.height / nh);
    const w = nw * k, h = nh * k;
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
  };
  stage.addEventListener('click', e => {
    if (cl.classList.contains('zoom')) { setZoom(false); return; }
    const c = contentRect();
    const inside = e.target === img && e.clientX >= c.left && e.clientX <= c.left + c.width &&
      e.clientY >= c.top && e.clientY <= c.top + c.height;
    if (!inside) { close(false); return; }
    if (img.naturalWidth <= c.width * 1.15) return; /* ảnh đã hiện gần đủ cỡ, phóng thêm không rõ hơn */
    const rx = (e.clientX - c.left) / c.width;
    const ry = (e.clientY - c.top) / c.height;
    setZoom(true);
    stage.scrollLeft = rx * img.offsetWidth - stage.clientWidth / 2;
    stage.scrollTop = ry * img.offsetHeight - stage.clientHeight / 2;
  });

  window.addEventListener('popstate', () => { if (isOpen) close(true); });

  document.addEventListener('keydown', e => {
    if (!isOpen) return;
    if (e.key === 'Escape') { if (cl.classList.contains('zoom')) setZoom(false); else close(false); }
    else if (e.key === 'ArrowLeft' && !cl.classList.contains('zoom')) show(cur - 1);
    else if (e.key === 'ArrowRight' && !cl.classList.contains('zoom')) show(cur + 1);
    else if (e.key === 'Tab') {
      /* Giữ tiêu điểm bàn phím trong khung xem */
      const f = [].slice.call(cl.querySelectorAll('button, a[href]')).filter(el => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* Vuốt ngang để chuyển concept (bỏ qua khi đang phóng to hoặc dùng hai ngón) */
  let sx = null, sy = 0;
  const pinched = () => window.visualViewport && window.visualViewport.scale > 1.01;
  stage.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || cl.classList.contains('zoom') || pinched()) { sx = null; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) show(cur + (dx < 0 ? 1 : -1));
  }, { passive: true });

  /* Link riêng từng concept: rosewedding.vn/concept/<hạng mục>#concept-12 mở thẳng concept 12 */
  const m = location.hash.match(/^#concept-(\d+)$/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= total) open(n - 1, true);
  }
})();

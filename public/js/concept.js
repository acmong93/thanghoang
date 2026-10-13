/* Rosé · trang hạng mục concept: lưới so le giữ thứ tự + xem ảnh lớn (phóng to, vuốt, link riêng từng concept) */
(function () {
  'use strict';

  const gal = document.getElementById('ccGal');
  if (!gal) return;
  const items = [].slice.call(gal.querySelectorAll('.cc-it'));
  if (!items.length) return;
  const albumName = gal.dataset.name || '';
  const zalo = gal.dataset.zalo || '';
  const touch = window.matchMedia('(hover:none)').matches;
  let isOpen = false;

  /* ---------- Thanh tab dính ngay dưới header (header cao khác nhau giữa máy tính và điện thoại) ---------- */
  const header = document.getElementById('header');
  const setHdr = () => {
    if (header) document.documentElement.style.setProperty('--hdr', header.offsetHeight + 'px');
  };
  setHdr();
  window.addEventListener('resize', setHdr);
  if (header) header.addEventListener('transitionend', setHdr);

  /* Tab đang xem nằm ngoài khung trên điện thoại: cuộn ngang cho lộ ra (chạy lại khi font tải xong vì chữ rộng ra);
     cuộn tới cuối thì bỏ hiệu ứng mờ mép phải (không còn tab nào phía sau) */
  const onTab = document.querySelector('.cc-tab.on');
  const bar = document.querySelector('.cc-tabs-in');
  if (bar) {
    const markEnd = () => bar.classList.toggle('at-end', bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 1);
    const center = () => {
      if (onTab && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = onTab.offsetLeft - (bar.clientWidth - onTab.offsetWidth) / 2;
      markEnd();
    };
    center();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(center);
    bar.addEventListener('scroll', markEnd, { passive: true });
  }

  /* ---------- Lưới so le ----------
     Mỗi bảng concept vào cột đang thấp nhất, chiều cao tính từ tỉ lệ thật lưu sẵn trong database (không chờ ảnh tải).
     Định vị tại chỗ nên thứ tự trong trang (phím Tab, trình đọc màn hình) vẫn là 1, 2, 3...
     Hàng trên cùng luôn là các concept đầu tiên theo thứ tự kéo thả trong admin. */
  const colsFor = w => (w < 600 ? 1 : w < 1000 ? 2 : 3);
  let lastW = 0;
  const layout = () => {
    const W = gal.clientWidth;
    if (!W || W === lastW) return;
    const firstRun = !lastW;
    lastW = W;
    /* Giữ chỗ đang xem khi xoay máy / đổi cỡ cửa sổ */
    const topLine = 140;
    const anchor = !firstRun && !isOpen ? items.find(it => it.getBoundingClientRect().bottom > topLine) : null;
    const anchorTop = anchor ? anchor.getBoundingClientRect().top : 0;

    const n = colsFor(W);
    const gap = parseFloat(getComputedStyle(gal).getPropertyValue('--cc-gap')) || 12;
    const colW = (W - gap * (n - 1)) / n;
    const tops = new Array(n).fill(0);
    items.forEach(it => {
      let k = 0;
      for (let j = 1; j < n; j++) if (tops[j] < tops[k] - 0.5) k = j;
      const h = colW * (+it.dataset.h || 1) / (+it.dataset.w || 1);
      it.style.width = colW + 'px';
      it.style.left = k * (colW + gap) + 'px';
      it.style.top = tops[k] + 'px';
      tops[k] += h + gap;
    });
    gal.style.height = Math.max(0, Math.max.apply(null, tops) - gap) + 'px';
    gal.classList.add('ready');
    if (anchor) window.scrollBy(0, anchor.getBoundingClientRect().top - anchorTop);
  };
  layout();
  if (window.ResizeObserver) {
    let raf = 0;
    new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); }).observe(gal);
  } else {
    let lt;
    window.addEventListener('resize', () => { clearTimeout(lt); lt = setTimeout(layout, 120); });
  }

  /* ---------- Xem ảnh lớn ---------- */
  const cl = document.createElement('div');
  cl.className = 'cl';
  cl.setAttribute('role', 'dialog');
  cl.setAttribute('aria-modal', 'true');
  cl.setAttribute('aria-label', 'Xem concept ' + albumName);
  cl.innerHTML =
    '<div class="cl-top"><span class="cl-count" aria-live="polite"></span>' +
    '<span class="cl-title"><span class="cl-title-cat"></span><span class="cl-title-n"></span></span>' +
    '<button type="button" class="cl-btn cl-close" aria-label="Đóng">&times;</button></div>' +
    '<div class="cl-stage"><img class="cl-img" alt="" draggable="false" /></div>' +
    '<button type="button" class="cl-btn cl-nav cl-prev" aria-label="Concept trước">&lsaquo;</button>' +
    '<button type="button" class="cl-btn cl-nav cl-next" aria-label="Concept sau">&rsaquo;</button>' +
    '<div class="cl-bottom"><span class="cl-hint"></span>' +
    (zalo ? '<a class="cl-zalo" href="https://zalo.me/' + zalo + '" target="_blank" rel="noopener">Nhắn Rosé về <span class="cl-zalo-cat"></span><span class="cl-zalo-n"></span></a>' : '') +
    '</div>';
  document.body.appendChild(cl);
  const stage = cl.querySelector('.cl-stage');
  const img = cl.querySelector('.cl-img');
  const countEl = cl.querySelector('.cl-count');
  const closeBtn = cl.querySelector('.cl-close');
  const hintEl = cl.querySelector('.cl-hint');
  const zaloBtn = cl.querySelector('.cl-zalo');
  cl.querySelector('.cl-title-cat').textContent = albumName + ' · ';
  if (zaloBtn) zaloBtn.querySelector('.cl-zalo-cat').textContent = albumName + ' · ';
  const HINT = touch ? 'Vuốt để xem tiếp · chạm ảnh để phóng to' : 'Bấm vào ảnh để phóng to';
  const total = items.length;
  const fullOf = i => items[i].getAttribute('href');
  const wrapIdx = i => (i + total) % total;
  const isZoom = () => cl.classList.contains('zoom');

  let cur = 0;
  let pushed = false;
  let openedAt = 0;
  let inerted = [];

  const setZoom = on => {
    cl.classList.toggle('zoom', on);
    if (!on) {
      img.style.width = '';
      stage.scrollLeft = 0;
      stage.scrollTop = 0;
    }
  };

  const show = i => {
    cur = wrapIdx(i);
    setZoom(false);
    const it = items[cur];
    const grid = it.querySelector('img');
    const full = fullOf(cur);
    /* Hiện ngay bản đang có trong lưới, bản nét nhất tải xong thì thay vào (giữ nguyên cỡ đang phóng to) */
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
    cl.querySelector('.cl-title-n').textContent = 'Concept ' + (cur + 1);
    if (zaloBtn) zaloBtn.querySelector('.cl-zalo-n').textContent = 'Concept ' + (cur + 1);
    hintEl.textContent = HINT;
    [cur + 1, cur - 1].forEach(j => { new Image().src = fullOf(wrapIdx(j)); });
    if (isOpen) history.replaceState(history.state, '', '#concept-' + (cur + 1));
  };

  const open = (i, fromLink) => {
    if (isOpen) { show(i); return; }
    show(i); /* isOpen còn false: chưa đụng lịch sử trình duyệt */
    isOpen = true;
    openedAt = performance.now();
    cl.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    /* Phần trang phía sau không nhận tiêu điểm / trình đọc màn hình khi đang xem */
    inerted = [].slice.call(document.body.children).filter(el => el !== cl && !el.hasAttribute('inert'));
    inerted.forEach(el => el.setAttribute('inert', ''));
    /* Nút Back của điện thoại đóng khung xem thay vì rời trang, kể cả khi vào từ link #concept-N */
    if (fromLink && history.state && history.state.cl) {
      pushed = true;
    } else {
      if (fromLink) history.replaceState(null, '', location.pathname + location.search);
      history.pushState({ cl: 1 }, '', '#concept-' + (cur + 1));
      pushed = true;
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
    inerted.forEach(el => el.removeAttribute('inert'));
    inerted = [];
    if (!fromPop && pushed) history.back();
    pushed = false;
    /* Đưa khách về đúng concept vừa xem trong lưới */
    const back = items[cur];
    if (back) {
      back.focus({ preventScroll: true });
      const r = back.getBoundingClientRect();
      if (r.bottom < 120 || r.top > window.innerHeight) back.scrollIntoView({ block: 'center' });
    }
  };

  items.forEach((it, i) => it.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; /* mở tab mới vẫn theo link ảnh */
    e.preventDefault();
    open(i, false);
  }));
  closeBtn.addEventListener('click', () => close(false));
  cl.querySelector('.cl-prev').addEventListener('click', () => show(cur - 1));
  cl.querySelector('.cl-next').addEventListener('click', () => show(cur + 1));

  /* Nhắn Zalo: chép sẵn tên hạng mục + số concept + link để khách dán vào tin nhắn (số concept lặp lại giữa các hạng mục) */
  if (zaloBtn) zaloBtn.addEventListener('click', () => {
    if (window.roseTrack) window.roseTrack('zalo');
    const label = albumName + ' · Concept ' + (cur + 1);
    const text = 'Rosé ơi, mình thích ' + label + ': ' + location.href;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        hintEl.textContent = 'Đã chép “' + label + '”, dán vào Zalo để gửi Rosé';
      }, () => {});
    }
  });

  /* Phần ảnh thật sự hiện ra trong khung (object-fit: contain chừa viền tối hai bên) */
  const contentRect = () => {
    const r = img.getBoundingClientRect();
    const nw = img.naturalWidth || r.width, nh = img.naturalHeight || r.height;
    const k = Math.min(r.width / nw, r.height / nh);
    const w = nw * k, h = nh * k;
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
  };
  const inContent = (x, y) => {
    const c = contentRect();
    return x >= c.left && x <= c.left + c.width && y >= c.top && y <= c.top + c.height;
  };

  /* Chạm nền tối quanh ảnh để đóng; chạm vào ảnh để phóng to đúng chỗ vừa chạm */
  stage.addEventListener('click', e => {
    if (performance.now() - openedAt < 400) return; /* cú bấm đúp lúc mở không đóng/phóng ngay */
    if (isZoom()) { setZoom(false); return; }
    if (!(e.target === img && inContent(e.clientX, e.clientY))) { close(false); return; }
    const c = contentRect();
    const fullW = +items[cur].dataset.w || img.naturalWidth;
    if (fullW <= c.width * 1.15) return; /* ảnh đã hiện gần đủ cỡ, phóng thêm không rõ hơn */
    /* Phóng vừa đủ đọc rõ: tối đa cỡ thật của ảnh, không phóng quá mức làm nhoè */
    const zw = Math.min(fullW, Math.max(c.width * 2.5, fullW / (window.devicePixelRatio || 1)));
    const rx = (e.clientX - c.left) / c.width;
    const ry = (e.clientY - c.top) / c.height;
    img.style.width = zw + 'px';
    setZoom(true);
    stage.scrollLeft = rx * img.offsetWidth - stage.clientWidth / 2;
    stage.scrollTop = ry * img.offsetHeight - stage.clientHeight / 2;
  });
  /* Con trỏ kính lúp chỉ khi đang ở trên ảnh (vùng tối bên cạnh bấm vào là đóng) */
  stage.addEventListener('mousemove', e => {
    img.style.cursor = isZoom() || inContent(e.clientX, e.clientY) ? '' : 'default';
  });

  window.addEventListener('popstate', () => { if (isOpen) close(true); });

  document.addEventListener('keydown', e => {
    if (!isOpen) return;
    if (e.key === 'Escape') { if (isZoom()) setZoom(false); else close(false); }
    else if (e.key === 'ArrowLeft' && !isZoom()) show(cur - 1);
    else if (e.key === 'ArrowRight' && !isZoom()) show(cur + 1);
    else if (e.key === 'Tab') {
      /* Giữ tiêu điểm bàn phím trong khung xem */
      const f = [].slice.call(cl.querySelectorAll('button, a[href]')).filter(el => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (!cl.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* Vuốt ngang để chuyển concept (bỏ qua khi đang phóng to hoặc dùng hai ngón) */
  let sx = null, sy = 0;
  const pinched = () => window.visualViewport && window.visualViewport.scale > 1.01;
  /* Đã phóng bằng hai ngón: trả quyền kéo ảnh cho trình duyệt để khách kéo xem các góc */
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => { stage.style.touchAction = pinched() ? 'auto' : ''; });
  }
  stage.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || isZoom() || pinched()) { sx = null; return; }
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
  const openFromHash = () => {
    const m = location.hash.match(/^#concept-(\d+)$/);
    if (!m || isOpen) return;
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= total) open(n - 1, true);
  };
  openFromHash();
  /* Dán link #concept-N khác khi đang ở cùng trang (trình duyệt không tải lại trang) */
  window.addEventListener('hashchange', openFromHash);
})();

/* Rosé Wedding — JS dùng chung cho trang public */
(function () {
  'use strict';

  /* ---------- Header đổi nền khi cuộn ---------- */
  const header = document.getElementById('header');
  if (header && !header.classList.contains('static')) {
    const onScroll = () => header.classList.toggle('solid', window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Menu mobile ---------- */
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  if (burger && menu) {
    const closeMenu = () => {
      menu.classList.remove('open');
      burger.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      document.body.classList.remove('menu-open');
      // Thu gọn lại các menu con để lần mở sau sạch sẽ
      menu.querySelectorAll('.has-drop.open').forEach(d => d.classList.remove('open'));
    };
    burger.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
      document.body.classList.toggle('menu-open', open);
      if (!open) menu.querySelectorAll('.has-drop.open').forEach(d => d.classList.remove('open'));
    });
    // Dropdown trên mobile: chạm lần 1 mở menu con, chạm lần 2 đi tới link
    menu.querySelectorAll('.has-drop > .drop-toggle').forEach(t => {
      t.addEventListener('click', e => {
        if (window.innerWidth <= 680) {
          const parent = t.parentElement;
          if (!parent.classList.contains('open')) {
            e.preventDefault();
            parent.classList.add('open');
          }
        }
      });
    });
    menu.querySelectorAll('a:not(.drop-toggle)').forEach(a =>
      a.addEventListener('click', closeMenu)
    );
  }

  /* ---------- Đo lượt bấm liên hệ (thống kê nội bộ + Meta Pixel/GA nếu có) ---------- */
  const trackContact = (channel) => {
    try {
      navigator.sendBeacon('/track', JSON.stringify({ c: channel }));
      if (typeof fbq === 'function') fbq('track', 'Contact');
      if (typeof gtag === 'function') gtag('event', 'contact', { channel: channel });
      if (typeof ttq === 'object' && ttq && typeof ttq.track === 'function') ttq.track('Contact');
    } catch (e) { /* đo đạc không được làm hỏng thao tác của khách */ }
  };
  const CONTACT_MAP = [
    ['.qc-zalo, .qd-zalo', 'zalo'],
    ['.qc-mess, .qd-mess', 'messenger'],
    ['.qc-call, .qd-call', 'call'],
    ['a[href="/#booking"], a[href="#booking"]', 'booking']
  ];
  CONTACT_MAP.forEach(([sel, channel]) => {
    document.querySelectorAll(sel).forEach(el =>
      el.addEventListener('click', () => trackContact(channel))
    );
  });
  document.querySelectorAll('.foot-social a').forEach(el => {
    const label = (el.textContent || '').trim().toLowerCase();
    if (['facebook', 'instagram', 'zalo', 'tiktok', 'youtube'].includes(label)) {
      el.addEventListener('click', () => trackContact(label));
    }
  });

  /* ---------- Đường nối trượt (trang chủ): khối Ảnh Cưới ghim lại,
     frame Concept tối trượt lên phủ dần, khối bị đè lùi nhẹ và chìm tối ---------- */
  const seamPin = document.querySelector('.seam-pin');
  const seamCover = document.querySelector('.seam-cover');
  if (seamPin && seamCover && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Đáy khối ghim luôn chạm đáy màn hình, dù khối cao hay thấp hơn viewport
    const setTop = () => {
      seamPin.style.top = Math.min(0, window.innerHeight - seamPin.offsetHeight) + 'px';
    };
    const onSeam = () => {
      const t = seamCover.getBoundingClientRect().top;
      const p = 1 - Math.min(1, Math.max(0, t / window.innerHeight));
      if (p > 0) {
        seamPin.style.transform = 'scale(' + (1 - p * 0.045) + ')';
        seamPin.style.filter = 'brightness(' + (1 - p * 0.38) + ')';
      } else {
        seamPin.style.transform = '';
        seamPin.style.filter = '';
      }
    };
    window.addEventListener('resize', setTop);
    window.addEventListener('scroll', onSeam, { passive: true });
    // Ảnh trong khối nạp xong có thể đổi chiều cao khối
    window.addEventListener('load', setTop);
    setTop();
    onSeam();
  }

  /* ---------- Hero slider ---------- */
  const slidesEl = document.getElementById('slides');
  if (slidesEl) {
    let images = [], pos = [];
    try { images = JSON.parse(slidesEl.dataset.images || '[]'); } catch (e) { /* bỏ qua */ }
    try { pos = JSON.parse(slidesEl.dataset.pos || '[]'); } catch (e) { /* bỏ qua */ }
    // Điện thoại: dùng bộ ảnh dọc riêng nếu đã upload trong admin
    if (window.matchMedia('(max-width:680px)').matches) {
      let mi = [], mp = [];
      try { mi = JSON.parse(slidesEl.dataset.imagesMobile || '[]'); } catch (e) { /* bỏ qua */ }
      try { mp = JSON.parse(slidesEl.dataset.posMobile || '[]'); } catch (e) { /* bỏ qua */ }
      const bo = mi.map((src, i) => ({ src, p: mp[i] })).filter(x => x.src);
      if (bo.length) {
        images = bo.map(x => x.src);
        pos = bo.map(x => x.p || '50% 50%');
      }
    }
    const dotsEl = document.getElementById('dots');
    const slides = [], dots = [];

    images.forEach((src, i) => {
      const d = document.createElement('div');
      d.className = 'slide' + (i === 0 ? ' active' : '');
      const im = document.createElement('img');
      im.src = src;
      im.alt = 'Rosé Wedding';
      if (pos[i]) im.style.objectPosition = pos[i];
      im.loading = i === 0 ? 'eager' : 'lazy';
      if (i === 0) im.fetchPriority = 'high';
      d.appendChild(im);
      slidesEl.appendChild(d);
      slides.push(d);

      if (dotsEl) {
        const b = document.createElement('button');
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-label', 'Ảnh ' + (i + 1));
        if (i === 0) b.className = 'active';
        b.addEventListener('click', () => go(i));
        dotsEl.appendChild(b);
        dots.push(b);
      }
    });

    let cur = 0, timer = null;
    function go(n) {
      slides[cur].classList.remove('active');
      dots[cur] && dots[cur].classList.remove('active');
      cur = (n + slides.length) % slides.length;
      slides[cur].classList.add('active');
      dots[cur] && dots[cur].classList.add('active');
      // reset hiệu ứng kenburns
      const img = slides[cur].querySelector('img');
      img.style.animation = 'none';
      void img.offsetWidth;
      img.style.animation = '';
      restart();
    }
    function restart() {
      clearInterval(timer);
      if (slides.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        timer = setInterval(() => go(cur + 1), 6000);
      }
    }
    restart();
  }

  /* ---------- Reveal khi cuộn ----------
     IntersectionObserver là chính; kèm kiểm tra trực tiếp lúc tải trang và khi cuộn
     để nội dung không bao giờ bị kẹt ẩn nếu IO không phát sự kiện. */
  const revealEls = new Set(document.querySelectorAll('.reveal'));
  const inView = el => {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight * 0.96 && r.bottom > 0;
  };
  function revealVisible() {
    revealEls.forEach(el => {
      if (inView(el)) { el.classList.add('in'); revealEls.delete(el); }
    });
    if (!revealEls.size) window.removeEventListener('scroll', onRevealScroll);
  }
  let rafPending = false;
  function onRevealScroll() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { revealVisible(); rafPending = false; });
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); revealEls.delete(e.target); io.unobserve(e.target); }
      });
    }, { threshold: .1, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(el => io.observe(el));
  }
  window.addEventListener('scroll', onRevealScroll, { passive: true });
  revealVisible();

  /* ---------- Lightbox album ---------- */
  const lightbox = document.getElementById('lightbox');
  const gallery = document.getElementById('gallery');
  if (lightbox && gallery) {
    const lbImg = document.getElementById('lbImg');
    const lbCount = document.getElementById('lbCount');
    const imgs = [...gallery.querySelectorAll('img')];
    let idx = 0;

    function show(i) {
      idx = (i + imgs.length) % imgs.length;
      lbImg.src = imgs[idx].src;
      lbImg.alt = imgs[idx].alt;
      lbCount.textContent = (idx + 1) + ' / ' + imgs.length;
    }
    function open(i) {
      show(i);
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
      document.getElementById('lbClose').focus();
    }
    function close() {
      lightbox.hidden = true;
      document.body.style.overflow = '';
      imgs[idx].focus();
    }

    imgs.forEach((im, i) => {
      im.addEventListener('click', () => open(i));
      im.addEventListener('keydown', e => { if (e.key === 'Enter') open(i); });
    });
    document.getElementById('lbClose').addEventListener('click', close);
    document.getElementById('lbPrev').addEventListener('click', () => show(idx - 1));
    document.getElementById('lbNext').addEventListener('click', () => show(idx + 1));
    lightbox.addEventListener('click', e => { if (e.target === lightbox) close(); });
    document.addEventListener('keydown', e => {
      if (lightbox.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  /* ---------- Carousel khách VIP ---------- */
  const vipTrack = document.getElementById('vipTrack');
  if (vipTrack) {
    const step = () => {
      const card = vipTrack.querySelector('.vip-card');
      return card ? card.getBoundingClientRect().width + 22 : 440;
    };
    const prev = document.getElementById('vipPrev');
    const next = document.getElementById('vipNext');
    prev && prev.addEventListener('click', () => vipTrack.scrollBy({ left: -step(), behavior: 'smooth' }));
    next && next.addEventListener('click', () => vipTrack.scrollBy({ left: step(), behavior: 'smooth' }));
  }

  /* ---------- Đếm số liệu tăng dần khi cuộn tới (dải cặp đôi/năm kinh nghiệm) ---------- */
  const counters = document.querySelectorAll('.count-up[data-count]');
  if (counters.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const animate = el => {
      const raw = el.dataset.count;                       // VD "1000+", "4.9★", "6"
      const m = raw.match(/^([\d.,]+)(.*)$/);
      if (!m) return;
      const target = parseFloat(m[1].replace(/,/g, ''));
      const suffix = m[2] || '';
      const decimals = (m[1].split('.')[1] || '').length;
      const t0 = performance.now(), dur = 1400;
      const tick = now => {
        const p = Math.min((now - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toFixed(decimals) + suffix;
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = raw;
      };
      requestAnimationFrame(tick);
    };
    const cio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { animate(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: .6 });
    counters.forEach(el => cio.observe(el));
  }

  /* ---------- Concept: gallery justified kiểu Flickr ----------
     Xếp ảnh thành hàng theo tỉ lệ thật (data-w/data-h), mỗi hàng lấp kín bề ngang.
     Không chờ ảnh tải vì kích thước đã lưu sẵn trong database. */
  const jg = document.getElementById('jg');
  if (jg) {
    const items = [].slice.call(jg.querySelectorAll('.jg-i'));
    const layout = () => {
      const W = jg.clientWidth;
      if (!W) return;
      // Đo GAP trong từng lần xếp: CSS đổi 8px/5px qua mốc 680px (xoay máy) — chốt cứng là vỡ hàng
      const GAP = window.matchMedia('(max-width:680px)').matches ? 5 : 8;
      const targetH = Math.max(200, Math.min(340, W * 0.24));
      let row = [], rowRatio = 0;
      const flush = (isLast) => {
        if (!row.length) return;
        const gaps = (row.length - 1) * GAP;
        // Trừ 1px đệm: hàng vừa khít 100% dễ bị làm tròn sub-pixel đẩy ảnh cuối rơi xuống hàng dưới
        let h = (W - gaps - 1) / rowRatio;
        // Hàng cuối chưa đầy: không phóng to quá 15% chiều cao chuẩn
        if (isLast && h > targetH * 1.15) h = targetH * 1.15;
        row.forEach(it => {
          const r = (+it.dataset.w || 3) / (+it.dataset.h || 2);
          it.style.width = (h * r).toFixed(2) + 'px';
          it.style.height = h.toFixed(2) + 'px';
          it.style.flexGrow = '0';
        });
        row = []; rowRatio = 0;
      };
      items.forEach(it => {
        const r = (+it.dataset.w || 3) / (+it.dataset.h || 2);
        row.push(it); rowRatio += r;
        if (rowRatio * targetH >= W - (row.length - 1) * GAP) flush(false);
      });
      flush(true);
      jg.classList.add('ready');
    };
    layout();
    let jgT;
    window.addEventListener('resize', () => { clearTimeout(jgT); jgT = setTimeout(layout, 150); });
    /* Thanh cuộn xuất hiện sau khi ảnh tải làm bề ngang hụt ~15px — theo dõi
       bề ngang thật của khung, đổi là xếp lại ngay (chỉ khi lệch ≥1px, tránh lặp) */
    if (window.ResizeObserver) {
      let lastW = jg.clientWidth;
      new ResizeObserver(() => {
        if (Math.abs(jg.clientWidth - lastW) >= 1) { lastW = jg.clientWidth; layout(); }
      }).observe(jg);
    } else {
      window.addEventListener('load', layout);
    }

    /* ---------- Lightbox xem ảnh lớn: phím mũi tên, vuốt, đếm ảnh ---------- */
    const lb = document.createElement('div');
    lb.className = 'lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Xem ảnh lớn');
    lb.innerHTML = '<span class="lb-count" aria-live="polite"></span>' +
      '<button class="lb-btn lb-close" aria-label="Đóng">&times;</button>' +
      '<button class="lb-btn lb-prev" aria-label="Ảnh trước">&lsaquo;</button>' +
      '<img alt="" />' +
      '<button class="lb-btn lb-next" aria-label="Ảnh sau">&rsaquo;</button>';
    document.body.appendChild(lb);
    const lbImg = lb.querySelector('img');
    const lbCount = lb.querySelector('.lb-count');
    const lbClose = lb.querySelector('.lb-close');
    let cur = 0, lastFocus = null;
    const srcOf = i => items[i].getAttribute('href');
    const show = (i) => {
      cur = (i + items.length) % items.length;
      lbImg.src = srcOf(cur);
      const thumbAlt = items[cur].querySelector('img');
      lbImg.alt = thumbAlt ? thumbAlt.alt : '';
      lbCount.textContent = (cur + 1) + ' / ' + items.length;
      // Tải trước ảnh liền kề cho mượt
      [cur + 1, cur - 1].forEach(j => { new Image().src = srcOf((j + items.length) % items.length); });
    };
    const open = (i) => {
      lastFocus = document.activeElement;
      show(i); lb.classList.add('open'); document.body.style.overflow = 'hidden';
      lbClose.focus();
    };
    const close = () => {
      lb.classList.remove('open'); document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };
    items.forEach((it, i) => it.addEventListener('click', e => { e.preventDefault(); open(i); }));
    lbClose.addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', () => show(cur - 1));
    lb.querySelector('.lb-next').addEventListener('click', () => show(cur + 1));
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    document.addEventListener('keydown', e => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(cur - 1);
      if (e.key === 'ArrowRight') show(cur + 1);
    });
    let tx = null;
    lb.addEventListener('touchstart', e => { tx = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => {
      if (tx === null) return;
      const dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1));
      tx = null;
    }, { passive: true });
  }

  /* ---------- Video YouTube: chỉ tải iframe khi bấm play (nhẹ trang) ---------- */
  document.querySelectorAll('.v[data-yt]').forEach(v => {
    const play = () => {
      const id = v.dataset.yt;
      const f = document.createElement('iframe');
      f.src = 'https://www.youtube.com/embed/' + id + '?autoplay=1';
      f.title = v.dataset.title || 'Video Rosé Wedding';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      f.allowFullscreen = true;
      v.replaceChildren(f);
    };
    v.addEventListener('click', play);
    v.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
  });
})();

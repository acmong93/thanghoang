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
    burger.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    // Dropdown trên mobile: chạm lần 1 mở, lần 2 đi tới link
    menu.querySelectorAll('.has-drop > .drop-toggle').forEach(t => {
      t.addEventListener('click', e => {
        if (window.innerWidth <= 900) {
          const parent = t.parentElement;
          if (!parent.classList.contains('open')) {
            e.preventDefault();
            parent.classList.add('open');
          }
        }
      });
    });
    menu.querySelectorAll('a:not(.drop-toggle)').forEach(a =>
      a.addEventListener('click', () => {
        menu.classList.remove('open');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      })
    );
  }

  /* ---------- Hero slider ---------- */
  const slidesEl = document.getElementById('slides');
  if (slidesEl) {
    let images = [];
    try { images = JSON.parse(slidesEl.dataset.images || '[]'); } catch (e) { /* bỏ qua */ }
    const dotsEl = document.getElementById('dots');
    const slides = [], dots = [];

    images.forEach((src, i) => {
      const d = document.createElement('div');
      d.className = 'slide' + (i === 0 ? ' active' : '');
      const im = document.createElement('img');
      im.src = src;
      im.alt = 'Rosé Wedding';
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

  /* ---------- Form đặt lịch ---------- */
  const form = document.getElementById('bookForm');
  if (form) {
    const msg = document.getElementById('formMsg');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = form.name.value.trim();
      const phone = form.phone.value.trim();
      msg.className = 'form-msg';

      if (!name || !phone) {
        msg.classList.add('err');
        msg.textContent = 'Vui lòng nhập họ tên và số điện thoại.';
        (!name ? form.name : form.phone).focus();
        return;
      }

      const btn = form.querySelector('button[type=submit]');
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Đang gửi...';

      try {
        const res = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, phone,
            service: form.service.value,
            message: form.message.value.trim()
          })
        });
        const data = await res.json();
        if (data.ok) {
          msg.classList.add('ok');
          msg.textContent = 'Cảm ơn ' + name + '! Rosé sẽ liên hệ với bạn trong thời gian sớm nhất.';
          form.reset();
        } else {
          msg.classList.add('err');
          msg.textContent = data.error || 'Có lỗi xảy ra, vui lòng thử lại hoặc gọi hotline.';
        }
      } catch (err) {
        msg.classList.add('err');
        msg.textContent = 'Không gửi được yêu cầu. Vui lòng thử lại hoặc gọi hotline.';
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    });
  }
})();

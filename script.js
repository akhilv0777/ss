/* ================================================================
   main.js — Performance-Optimized
   Key changes vs original:
   • Lazy section init via IntersectionObserver (sections only init
     when they enter the viewport — eliminates upfront DOM/style work)
   • requestIdleCallback for non-critical work (fireflies, dot viz)
   • data.json fetched once; bootstrap deferred past loader
   • Spinner resize debounced
   • Carousel/Spinner/Gallery only init when visible
   • Music player deferred until first user interaction or scroll
   • createDocumentFragment used consistently (was already there)
   • Removed redundant document.addEventListener('click') re-queries
================================================================ */

/* ================================================================
   1. UTILS
================================================================ */
const PI2 = Math.PI * 2;

const utils = {
  rand   : (min, max) => (Math.random() * (max - min + 1) + min) | 0,
  clamp  : (val, lo, hi) => Math.max(lo, Math.min(val, hi)),
  pick   : arr => arr[Math.floor(Math.random() * arr.length)],
  swapClass: (el, remove, add) => { el?.classList.remove(remove); el?.classList.add(add); },
  el     : (tag, cls = '', html = '') => {
    const e = document.createElement(tag);
    if (cls)  e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  },
  buildFragment: (items, mapper) => {
    const f = document.createDocumentFragment();
    items.forEach(item => f.appendChild(mapper(item)));
    return f;
  },
  // Debounce helper — prevents resize/scroll flooding
  debounce: (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; },
  // Schedule low-priority work without blocking paint
  idle: fn => (window.requestIdleCallback || (cb => setTimeout(cb, 1)))(fn),
};

/* ================================================================
   2. DOM
================================================================ */
const $    = (sel, ctx = document) => ctx.querySelector(sel);
const $$   = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const byId = id => document.getElementById(id);

/* ================================================================
   3. LAZY OBSERVER
   Usage: lazyInit('#mySection', () => initMySection())
   The callback fires once when the section scrolls into view (+ 200px
   root margin so init happens just before it becomes visible).
================================================================ */
function lazyInit(selectorOrEl, callback, rootMargin = '0px 0px 200px 0px') {
  const el = typeof selectorOrEl === 'string' ? $(selectorOrEl) : selectorOrEl;
  if (!el) return;

  const obs = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    obs.disconnect();
    callback();
  }, { rootMargin });

  obs.observe(el);
}

/* ================================================================
   4. DRAG ENGINE
================================================================ */
function attachDrag(target, { onStart, onMove, onEnd }) {
  if (!target) return;
  const norm = e => ({
    clientX: e.touches ? e.touches[0].clientX : e.clientX,
    clientY: e.touches ? e.touches[0].clientY : e.clientY,
    raw: e,
  });
  target.addEventListener('mousedown',  e => onStart?.(norm(e)));
  target.addEventListener('touchstart', e => onStart?.(norm(e)), { passive: false });
  target.addEventListener('mousemove',  e => { e.preventDefault(); onMove?.(norm(e)); });
  target.addEventListener('touchmove',  e => { e.preventDefault(); onMove?.(norm(e)); }, { passive: false });
  target.addEventListener('mouseup',    e => onEnd?.(norm(e)));
  target.addEventListener('touchend',   e => onEnd?.(norm(e)));
  target.addEventListener('mouseleave', e => onEnd?.(norm(e)));
}

/* ================================================================
   5. BOOK
================================================================ */
let currentPage = 1;
let maxPages    = 0;
let appData     = [];

function renderBook(book) {
  const container = byId('book');
  if (!container || !book?.length) return;
  appData   = book;
  maxPages  = book.length;

  container.innerHTML = book.map((p, i) => {
    const front = p.isCover
      ? `<div class="front" id="cover"><h1 class="cover-title">${p.frontContent.title}</h1><p>${p.frontContent.chapter}</p><small onclick="goNext()">${p.frontContent.footer}</small></div>`
      : `<div class="front"><img src="${p.frontContent.img}" class="photo-frame" loading="lazy" decoding="async"><p>${p.frontContent.text}</p></div>`;

    const back = p.isCover
      ? `<div class="back"><h3>${p.backContent.title}</h3><p>${p.backContent.text}</p><p class="heart-symbol">${p.backContent.symbol}</p></div>`
      : i === maxPages - 1
        ? `<div class="back" id="back-cover"><h2>${p.backContent.title}</h2><p>${p.backContent.text}</p></div>`
        : `<div class="back"><img src="${p.backContent.img}" class="photo-frame" loading="lazy" decoding="async"><p>${p.backContent.text}</p></div>`;

    return `<div class="page" id="${p.id}">${front}${back}</div>`;
  }).join('');

  updateBookState();
}

function updateBookState() {
  appData.forEach((p, i) => {
    const el = byId(p.id);
    if (el) el.style.zIndex = (i + 1) < currentPage ? (i + 1) : (maxPages - i + 10);
  });
  const cl = $('.book-container')?.classList;
  if (cl) {
    cl.toggle('closed-back', currentPage > maxPages);
    cl.toggle('open-book',   currentPage > 1 && currentPage <= maxPages);
  }
  const show = (id, flag) => { const b = byId(id); if (b) b.style.display = flag ? 'inline-block' : 'none'; };
  show('prevBtn', currentPage > 1);
  show('nextBtn', currentPage <= maxPages);
}

function goNext() {
  if (currentPage > maxPages) return;
  byId(`p${currentPage}`).style.transform = 'rotateY(-180deg)';
  currentPage++;
  updateBookState();
}
function goPrev() {
  if (currentPage <= 1) return;
  currentPage--;
  byId(`p${currentPage}`).style.transform = 'rotateY(0deg)';
  updateBookState();
}

/* ================================================================
   6. SLIDER
   Slider controls wired once; no per-click re-query of all items.
================================================================ */
function renderSlider(memories) {
  const slider = byId('sliderList');
  if (!slider || !memories?.length) return;

  slider.appendChild(utils.buildFragment(memories, ({ img, title, desc }) => {
    const li = utils.el('li', 'item');
    li.style.backgroundImage = `url('${img}')`;
    li.innerHTML = `<div class="content"><h2 class="title">${title}</h2><p class="description">${desc}</p></div>`;
    return li;
  }));

  // Wire controls once on the parent section (event delegation)
  const section = slider.closest('section') || slider.parentElement;
  section?.addEventListener('click', e => {
    const items = slider.children;
    if (!items.length) return;
    if (e.target.closest('.next') || e.target.closest('.item')) {
      slider.append(items[0]);
    } else if (e.target.closest('.prev')) {
      slider.prepend(items[items.length - 1]);
    }
  });
}

/* ================================================================
   7. 3D CAROUSEL  — init deferred until section visible
================================================================ */
function renderCarousel(carousel) {
  const container = byId('dragCarousel');
  if (!container || !carousel?.length) return;

  container.appendChild(utils.buildFragment(carousel, ({ img, title, num }) => {
    const div = utils.el('div', 'carousel-item');
    div.innerHTML = `<div class="carousel-box"><div class="title">${title}</div><div class="num">${num}</div>${img ? `<img src="${img}" loading="lazy" decoding="async">` : ''}</div>`;
    return div;
  }));

  lazyInit(byId('carouselSection'), initCarousel);
}

function initCarousel() {
  let progress = 50, activeIndex = 0;
  const items   = $$('.carousel-item');
  const section = byId('carouselSection');
  if (!items.length || !section) return;

  const update = () => {
    progress    = utils.clamp(progress, 0, 100);
    activeIndex = Math.floor(progress / 100 * (items.length - 1));
    items.forEach((item, i) => {
      item.style.setProperty('--zIndex',  i === activeIndex ? items.length : items.length - Math.abs(activeIndex - i));
      item.style.setProperty('--active', (i - activeIndex) / items.length);
    });
  };
  update();

  items.forEach((item, i) =>
    item.addEventListener('click', () => { progress = (i / items.length) * 100 + 10; update(); })
  );

  let startX = 0;
  attachDrag(section, {
    onStart: ({ clientX }) => { startX = clientX; },
    onMove : ({ clientX }) => { progress += (clientX - startX) * -0.1; startX = clientX; update(); },
  });
}

/* ================================================================
   8. 3D SPINNER  — init deferred until section visible
================================================================ */
function renderSpinner(spinner, spinLabel) {
  const container = byId('spin-container');
  if (!container || !spinner?.length) return;

  const pTag = container.querySelector('p');
  if (pTag && spinLabel) pTag.textContent = spinLabel;

  container.insertBefore(
    utils.buildFragment(spinner, ({ img }) => {
      const imgEl   = utils.el('img');
      imgEl.src     = img;
      imgEl.loading = 'lazy';
      imgEl.decoding = 'async';
      return imgEl;
    }),
    pTag
  );

  lazyInit(byId('spinSection'), initSpinner);
}

function initSpinner() {
  const radius = 240, rotateSpeed = -60, imgWidth = 120, imgHeight = 170;
  const spinSection = byId('spinSection');
  const odrag       = byId('drag-container');
  const ospin       = byId('spin-container');
  if (!ospin || !odrag || !spinSection) return;

  const aEle = [...ospin.getElementsByTagName('img'), ...ospin.getElementsByTagName('video')];
  ospin.style.width  = imgWidth  + 'px';
  ospin.style.height = imgHeight + 'px';

  const ground = byId('ground');
  if (ground) { ground.style.width = ground.style.height = radius * 3 + 'px'; }

  // Stagger transform so browser spreads the style recalcs
  aEle.forEach((el, i) => {
    el.style.transform       = `rotateY(${i * (360 / aEle.length)}deg) translateZ(${radius}px)`;
    el.style.transition      = 'transform 1s';
    el.style.transitionDelay = (aEle.length - i) / 4 + 's';
  });

  ospin.style.animation = `${rotateSpeed > 0 ? 'spin' : 'spinRevert'} ${Math.abs(rotateSpeed)}s infinite linear`;

  let sX, sY, nX, nY, desX = 0, desY = 0, tX = 0, tY = 10;

  const applyTransform = () => {
    tY = utils.clamp(tY, 0, 180);
    odrag.style.transform = `rotateX(${-tY}deg) rotateY(${tX}deg)`;
  };
  const playSpin = yes => { ospin.style.animationPlayState = yes ? 'running' : 'paused'; };

  spinSection.onpointerdown = e => {
    clearInterval(odrag._timer);
    sX = e.clientX; sY = e.clientY;

    document.onpointermove = e => {
      nX = e.clientX; nY = e.clientY;
      desX = nX - sX; desY = nY - sY;
      tX += desX * 0.1; tY += desY * 0.1;
      applyTransform();
      sX = nX; sY = nY;
    };

    document.onpointerup = () => {
      odrag._timer = setInterval(() => {
        desX *= 0.95; desY *= 0.95;
        tX   += desX * 0.1; tY += desY * 0.1;
        applyTransform();
        playSpin(false);
        if (Math.abs(desX) < 0.5 && Math.abs(desY) < 0.5) {
          clearInterval(odrag._timer);
          playSpin(true);
        }
      }, 17);
      document.onpointermove = document.onpointerup = null;
    };
    return false;
  };
}

/* ================================================================
   9. JHOOMAR (CHANDELIER)
================================================================ */
function renderJhoomar(items) {
  const container = byId('jhoomar-container');
  if (!container || !items?.length) return;

  const section    = byId('jhoomarSection');

  // Insert title block before container
  if (section && !byId('jhoomarTitleBlock')) {
    const tb = utils.el('div', 'jhoomar-title-block');
    tb.id    = 'jhoomarTitleBlock';
    tb.innerHTML =
      `<h2 class="jhoomar-title">Frames of Love 💕</h2>` +
      `<p class="jhoomar-sub">Every heart holds a memory worth keeping</p>`;
    section.insertBefore(tb, container);
  }

  const w          = window.innerWidth;
  const maxPerRow  = w < 600 ? 4 : w < 900 ? 6 : 9;
  const rows       = [];

  for (let i = 0; i < items.length; i += maxPerRow) {
    const row = items.slice(i, i + maxPerRow);
    const n   = row.length;
    const mid = Math.max((n - 1) / 2, 1);

    const cells = row.map(({ img }, j) => {
      const dist  = (j - mid) / mid;
      const strH  = 30 + 80 * (dist * dist);
      const dur   = (2.2 + Math.random() * 1.8).toFixed(1) + 's';
      const delay = (Math.random() * 0.8).toFixed(1) + 's';
      return `<div class="jhoomar-item" style="animation:swing ${dur} ease-in-out ${delay} infinite alternate;">` +
             `<div class="string" style="height:${strH}px"></div>` +
             `<div class="heart-frame"><img src="${img}" class="hanging-img" loading="lazy" decoding="async"></div></div>`;
    }).join('');

    rows.push(`<div class="jhoomar-row">${cells}</div>`);
  }

  container.innerHTML = rows.join('');
}

/* ================================================================
   10. MAGICAL GALLERY  — init deferred until section visible
================================================================ */
function renderMagicalGallery(gallery) {
  const container = byId('magical-cards-container');
  if (!container || !gallery?.length) return;

  container.innerHTML = gallery.map(({ id, isMain, type, src, frontNote, backNote }) => {
    const sizeClass = isMain ? 'card-video' : 'card-photo';
    const media     = type === 'video'
      ? `<div class="drag-handle"></div><video src="${src}" controls playsinline preload="none"></video>`
      : `<img src="${src}" loading="lazy" decoding="async">`;

    return `<div class="magical-card ${sizeClass}" id="${id}">` +
           `<div class="card-inner">` +
           `<div class="card-front">${media}<div class="card-note">${frontNote}<span class="tap-hint">(Tap to flip)</span></div></div>` +
           `<div class="card-back" style="background-image:url('${src}');"><div class="back-overlay"></div><div class="back-note">${backNote}</div></div>` +
           `</div></div>`;
  }).join('');

  lazyInit(container, initMagicalGallery);
}

function initMagicalGallery() {
  let topZ = 100;
  $$('.magical-card').forEach(card => {
    const isVideo = card.classList.contains('card-video');
    const range   = isVideo ? 0 : 120;
    let offsetX   = (Math.random() - 0.5) * range * 2;
    let offsetY   = (Math.random() - 0.5) * range * 2;
    const rotate  = isVideo ? 0 : (Math.random() - 0.5) * 30;

    const applyPos = (extra = '') =>
      card.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) rotate(${rotate}deg)${extra}`;
    applyPos();

    let startX, startY, moved = 0, startTime = 0;
    attachDrag(card, {
      onStart: ({ clientX, clientY, raw }) => {
        if (raw.target.tagName.toLowerCase() === 'video') return;
        moved = 0; startTime = Date.now();
        card.style.zIndex      = ++topZ;
        card.style.transition  = 'none';
        startX = clientX; startY = clientY;
      },
      onMove: ({ clientX, clientY }) => {
        moved   += Math.abs(clientX - startX) + Math.abs(clientY - startY);
        offsetX += clientX - startX;
        offsetY += clientY - startY;
        const tiltX = (clientY - startY) * -0.5;
        const tiltY = (clientX - startX) *  0.5;
        applyPos(` rotateX(${tiltX}deg) rotateY(${tiltY}deg)`);
        startX = clientX; startY = clientY;
      },
      onEnd: () => {
        card.style.transition = 'transform 0.5s ease-out';
        applyPos();
        if (Date.now() - startTime < 300 && moved < 20) card.classList.toggle('flipped');
      },
    });
  });
}

/* ================================================================
   11. CIRCULAR GALLERY & HALO FRAME
================================================================ */
function renderAnimatedFrame(imgUrl, textContent = 'HAPPY BIRTHDAY SAUMYA') {
  const bg            = byId('frameBg');
  const textContainer = byId('dynamicTextContainer');
  if (!bg || !textContainer || !imgUrl) return;

  bg.style.backgroundImage = `url('${imgUrl}')`;
  bg.style.backgroundSize  = 'cover';

  const chars = (textContent + ' • ').repeat(4).split('');
  const deg   = 360 / chars.length;
  textContainer.innerHTML = chars.map((ch, i) =>
    `<span style="transform:rotate(${i * deg}deg) translateY(calc(var(--size) * -0.65));">${ch}</span>`
  ).join('');
}

window.changeCenterFrame = (imgUrl, label) => renderAnimatedFrame(imgUrl, label || 'HAPPY BIRTHDAY SAUMYA');

function initCircularGallery(animatedFrameImages, frameText) {
  const wrapper = byId('gallery-wrapper');
  if (!wrapper || !animatedFrameImages?.length) return;

  const label = frameText || 'HAPPY BIRTHDAY SAUMYA';

  const frag = document.createDocumentFragment();
  animatedFrameImages.forEach((item, index) => {
    const imgUrl = item.imgUrl || item.img;
    const div    = utils.el('div', 'thumb');
    div.dataset.title   = item.title;
    div.style.setProperty('--i', index + 1);
    div.innerHTML = `<a href="javascript:void(0)" onclick="changeCenterFrame('${imgUrl}','${label}')">` +
                    `<img src="${imgUrl}" alt="${item.title}" loading="lazy" decoding="async"></a>`;
    frag.appendChild(div);
  });
  wrapper.appendChild(frag);

  const firstImg = animatedFrameImages[0].imgUrl || animatedFrameImages[0].img;
  renderAnimatedFrame(firstImg, label);
}

/* ================================================================
   12. MUSIC PLAYER  — deferred until first scroll or interaction
================================================================ */
let _musicInited = false;
function scheduleMusicInit() {
  if (_musicInited) return;

  const go = () => {
    if (_musicInited) return;
    _musicInited = true;
    initMusicPlayer();
  };

  // Kick off on first scroll or after a generous idle timeout
  window.addEventListener('scroll', go, { once: true, passive: true });
  utils.idle(go);   // also fires during idle time if user doesn't scroll
}

async function initMusicPlayer() {
  const audio        = $('#bgMusic');
  const playBtn3D    = $('#mp-btn-3d-play');
  const playBtnPanel = $('#mp-btn-play-pause');
  const playIcon     = $('#mp-play-icon');
  const cas          = $('#mp-cas');
  const tsh          = $('#mp-tsh');
  const lgh          = $('#mp-lgh');
  const saumyaImg    = $('#music-popup img');
  const saumyaPopup  = $('#music-popup');
  const fileUpload   = byId('mp-file-upload');
  const prevBtn      = byId('mp-btn-prev');
  const nextBtn      = byId('mp-btn-next');
  const volumeRadios = $$('#music-player-section input[name="switch"]');

  let saumyaImages = [], playlist = [], currentIndex = 0;

  try {
    const data   = await fetch('data.json').then(r => r.json());
    saumyaImages = data.saumyaImages || [];
    playlist     = data.musicList    || [];
    if (audio && playlist.length) { audio.src = playlist[0].src; audio.loop = playlist.length === 1; }
  } catch (e) { console.error('Music player data load failed:', e); }

  const setUI = playing => {
    cas.classList.toggle('is-radio-playing', playing);
    tsh.classList.toggle('is-tape-close',   playing);
    playBtn3D.classList.toggle('is-button-pressed', playing);
    if (playing) setTimeout(() => lgh.classList.add('is-wave-playing'), 1000);
    else          lgh.classList.remove('is-wave-playing');
    utils.swapClass(playIcon, playing ? 'fa-play' : 'fa-pause', playing ? 'fa-pause' : 'fa-play');

    if (saumyaPopup) {
      if (playing && saumyaImages.length) { saumyaImg.src = utils.pick(saumyaImages); saumyaPopup.classList.add('show'); }
      else saumyaPopup.classList.remove('show');
    }
  };

  const safePlay = async () => {
    if (!audio) return; setUI(true);
    try { await audio.play(); } catch { setUI(false); }
  };
  const toggle = () => {
    if (!audio || !playlist.length) return;
    audio.paused ? safePlay() : (setUI(false), audio.pause());
  };
  const changeSong = dir => {
    if (!audio || playlist.length <= 1) return;
    saumyaPopup?.classList.remove('show');
    currentIndex = dir === 'next'
      ? (currentIndex + 1) % playlist.length
      : (currentIndex - 1 + playlist.length) % playlist.length;
    audio.src = playlist[currentIndex].src;
    setTimeout(safePlay, 400);
  };

  playBtn3D?.addEventListener('click',  toggle);
  playBtnPanel?.addEventListener('click', toggle);
  prevBtn?.addEventListener('click', () => changeSong('prev'));
  nextBtn?.addEventListener('click', () => changeSong('next'));
  audio?.addEventListener('ended',  () => changeSong('next'));

  fileUpload?.addEventListener('change', ({ target: { files } }) => {
    if (!files.length || !audio) return;
    playlist     = Array.from(files).map(f => ({ name: f.name, src: URL.createObjectURL(f) }));
    currentIndex = 0;
    audio.src    = playlist[0].src;
    audio.loop   = playlist.length === 1;
    safePlay();
  });

  const VOL_MAP = { switch_off: 0, switch_1: 0.2, switch_2: 0.4, switch_3: 0.6, switch_4: 0.8, switch_5: 1.0 };
  volumeRadios.forEach(r =>
    r.addEventListener('change', ({ target }) => { if (audio) audio.volume = VOL_MAP[target.id] ?? 1; })
  );

  document.body.addEventListener('click', () => { if (audio?.paused && playlist.length) safePlay(); }, { once: true });
}

/* ================================================================
   13. DOT VISUALIZER  — built during idle time
================================================================ */
function createDotVisualizer() {
  const container = byId('dot-visualizer');
  if (!container) return;

  utils.idle(() => {
    let html = '';
    for (let r = 1; r <= 10; r++) {
      const numDots = 18 + (r - 1) * 6;
      const radius  = 40 + (r - 1) * 11;
      const delay   = (r * 0.333333).toFixed(5);
      let   ring    = `<div class="ring" style="position:absolute;width:80px;height:80px;top:160px;left:160px;">`;

      for (let d = 1; d <= numDots; d++) {
        const angle = ((d - 1) * (360 / numDots)).toFixed(4);
        ring += `<div class="dot" style="position:absolute;width:8px;height:8px;top:40px;left:40px;` +
                `transform:translate3d(0,-${radius}px,0) rotate(${angle}deg);transform-origin:0 ${radius}px;">` +
                `<div class="fill" style="width:8px;height:8px;background:#fff;border-radius:50%;` +
                `box-shadow:0 0 8px rgba(255,255,255,0.8);` +
                `animation:pulsate 2s ease-in-out ${delay}s alternate infinite both;"></div></div>`;
      }
      ring += '</div>';
      html += ring;
    }
    container.innerHTML = html;
  });
}

document.addEventListener('DOMContentLoaded', createDotVisualizer);

/* ================================================================
   14. CLOCK
================================================================ */
function initClock() {
  const hour = byId('hour'), minute = byId('minute'), second = byId('second');
  if (!hour || !minute || !second) return;
  const tick = () => {
    const d = new Date();
    hour.style.transform   = `rotate(${30 * d.getHours() + d.getMinutes() / 2}deg)`;
    minute.style.transform = `rotate(${6  * d.getMinutes()}deg)`;
    second.style.transform = `rotate(${6  * d.getSeconds()}deg)`;
  };
  tick();
  setInterval(tick, 1000);
}

/* ================================================================
   15. CAKE FINALE
================================================================ */
let isDeskBlown = false;
function blowCandleAndReveal() {
  if (isDeskBlown) return;
  const desk    = byId('mainContainerDesk');
  const flame   = byId('flame');
  const tapText = byId('tap-text');
  const cake    = byId('cake');
  const canvas  = byId('grandReveal');
  const section = byId('cakeFinaleSection');

  desk?.classList.add('blowing');
  if (tapText) tapText.style.opacity = '0';

  setTimeout(() => {
    if (flame) flame.style.display = 'none';
    isDeskBlown = true;
    if (cake)   cake.style.cursor  = 'default';

    setTimeout(() => {
      desk?.classList.remove('blowing');
      setTimeout(() => {
        if (desk)    desk.style.opacity    = '0';
        if (section) section.style.background = '#0a0a0a';

        setTimeout(() => {
          canvas?.classList.remove('hidden');
          if (typeof BirthdayEffect !== 'undefined') {
            const fx = new BirthdayEffect();
            let then = Date.now();
            const loop = () => {
              requestAnimationFrame(loop);
              const now = Date.now();
              fx.update((now - then) / 1000);
              then = now;
            };
            loop();
          }
        }, 800);
      }, 800);
    }, 600);
  }, 500);
}

/* ================================================================
   16. FIREFLIES  — created during idle time
================================================================ */
function createFireflies() {
  const container = byId('firefly-container');
  if (!container) return;

  utils.idle(() => {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 30; i++) {
      const el = utils.el('div', 'firefly');
      el.style.left              = `${Math.random() * 100}vw`;
      el.style.animationDuration = `${Math.random() * 5 + 5}s`;
      el.style.animationDelay   = `${Math.random() * 5}s`;
      frag.appendChild(el);
    }
    container.appendChild(frag);
  });
}

/* ================================================================
   17. CANVAS FIREWORKS
================================================================ */
class BirthdayEffect {
  constructor() {
    this.canvas    = byId('birthdayCanvas');
    this.ctx       = this.canvas.getContext('2d');
    this.fireworks = [];
    this.counter   = 0;
    this.resize();
    window.addEventListener('resize', utils.debounce(() => this.resize(), 200));
  }
  resize() {
    this.width  = this.canvas.width  = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
    const cx    = (this.width / 2) | 0;
    this.spawnA = (cx - cx / 4) | 0;
    this.spawnB = (cx + cx / 4) | 0;
    this.spawnC = this.height * 0.1;
    this.spawnD = this.height * 0.5;
  }
  update(delta) {
    const { ctx } = this;
    ctx.globalCompositeOperation = 'hard-light';
    ctx.fillStyle = `rgba(20,20,20,${7 * delta})`;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = 'lighter';
    this.fireworks.forEach(fw => fw.draw(ctx, delta, this));
    this.counter += delta * 3;
    if (this.counter >= 1) {
      this.fireworks.push(new FireworkPiece(
        utils.rand(this.spawnA, this.spawnB), this.height,
        utils.rand(0, this.width),             utils.rand(this.spawnC, this.spawnD),
        utils.rand(0, 360),                    utils.rand(30, 110)
      ));
      this.counter = 0;
    }
    if (this.fireworks.length > 1000) this.fireworks = this.fireworks.filter(fw => !fw.dead);
  }
}

class FireworkPiece {
  constructor(x, y, tx, ty, shade, offsprings) {
    Object.assign(this, { x, y, targetX: tx, targetY: ty, shade, offsprings });
    this.history = []; this.madeChilds = false; this.dead = false;
  }
  draw(ctx, delta, parent) {
    if (this.dead) return;
    const dx = this.targetX - this.x, dy = this.targetY - this.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      this.x += dx * 2 * delta; this.y += dy * 2 * delta;
      this.history.push({ x: this.x, y: this.y });
      if (this.history.length > 20) this.history.shift();
    } else {
      if (this.offsprings && !this.madeChilds) {
        const half = this.offsprings / 2;
        for (let i = 0; i < half; i++) {
          parent.fireworks.push(new FireworkPiece(
            this.x, this.y,
            (this.x + this.offsprings * Math.cos((PI2 * i) / half)) | 0,
            (this.y + this.offsprings * Math.sin((PI2 * i) / half)) | 0,
            this.shade, 0
          ));
        }
        this.madeChilds = true;
      }
      this.history.shift();
    }
    if (!this.history.length) { this.dead = true; return; }
    ctx.beginPath();
    ctx.fillStyle = `hsl(${this.shade},100%,50%)`;
    ctx.arc(this.x, this.y, 1, 0, PI2);
    ctx.fill();
  }
}

/* ================================================================
   18. ROSE OVERLAY
================================================================ */
function openMagicalRose()  { byId('roseOverlay')?.classList.add('active');    setTimeout(() => byId('magicGlass')?.classList.add('lift-up'),    800); }
function closeMagicalRose() { byId('roseOverlay')?.classList.remove('active'); setTimeout(() => byId('magicGlass')?.classList.remove('lift-up'), 500); }

/* ================================================================
   19-A. POPULATE DYNAMIC TEXTS FROM DATA.JSON
================================================================ */
function populateDynamicTexts(data) {
  const set  = (id, txt)  => { const el = byId(id); if (el && txt != null) el.textContent = txt; };
  const setH = (id, html) => { const el = byId(id); if (el && html != null) el.innerHTML  = html; };

  // ── Site meta ──────────────────────────────────────────────────────────────
  if (data.site) {
    if (data.site.title)   document.title = data.site.title;
    if (data.site.favicon) {
      const setFav = id => { const l = byId(id); if (l) l.href = data.site.favicon; };
      setFav('siteFavicon'); setFav('siteFaviconApple');
    }
    if (data.site.bgVideo) {
      const v = byId('bgVideo');
      if (v) { v.src = data.site.bgVideo; v.load(); }
    }
  }

  // ── Loader ─────────────────────────────────────────────────────────────────
  if (data.loader) {
    set('loaderWaitText', data.loader.waitText || 'Please Wait');
    set('loaderHint',     data.loader.hint);
  }

  // ── Welcome toast ──────────────────────────────────────────────────────────
  if (data.welcomeToast) {
    set('wtTitle',    data.welcomeToast.title);
    set('wtSubtitle', data.welcomeToast.subtitle);
  }

  // ── Hero CTA ───────────────────────────────────────────────────────────────
  if (data.hero?.ctaText) set('heroCtaText', data.hero.ctaText);

  // Wire hero CTA scroll
  const heroCta = byId('heroCta');
  if (heroCta) {
    heroCta.addEventListener('click', () => {
      byId('statsSection')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // ── Section titles — from data.sectionTitles ───────────────────────────────
  const st = data.sectionTitles || {};
  const applyTitle = (headingId, subId, obj) => {
    if (!obj) return;
    set(headingId, obj.heading);
    set(subId,     obj.sub);
  };
  applyTitle('statsSectionTitle',  'statsSectionSub',  st.stats);
  applyTitle('polaroidHeading',    'polaroidSub',       st.polaroid);
  applyTitle('filmReelHeading',    'filmReelSub',       st.filmReel);
  applyTitle('timelineHeading',    'timelineSub',       st.timeline);
  applyTitle('qualitiesHeading',   'qualitiesSub',      st.qualities);
  applyTitle('wjTitle',            'wjSub',             st.wishJar);

  if (st.wishJar) {
    set('wjTapHint', st.wishJar.tapHint);
    const jarLabel = byId('wjJarLabel');
    if (jarLabel && st.wishJar.jarLabel) {
      jarLabel.innerHTML = st.wishJar.jarLabel.map(t => `<span>${t}</span>`).join('');
    }
  }

  // ── Letter envelope hint ───────────────────────────────────────────────────
  if (data.letter?.openHint) set('envHint', data.letter.openHint);

  // ── Grand reveal ───────────────────────────────────────────────────────────
  if (data.grandReveal) {
    const grt = byId('grandRevealText');
    if (grt) {
      setH('grandRevealText',
        `${data.grandReveal.line1}<br>${data.grandReveal.line2}<br>` +
        `<i class="fa-solid fa-heart fa-beat" style="color:rgb(107,0,0)"></i>`);
    }
    const tapEl = byId('tap-text');
    if (tapEl && data.grandReveal.tapHint) {
      tapEl.innerHTML = `${data.grandReveal.tapHint} <i class="fa-solid fa-cake-candles"></i>`;
    }
  }

  // ── Spin label ─────────────────────────────────────────────────────────────
  if (data.spinLabel) set('spinLabelText', data.spinLabel);

  // ── Rose overlay ───────────────────────────────────────────────────────────
  set('roseText', data.roseText);
}

/* ================================================================
   19-B. HERO SECTION
================================================================ */
function renderHero(hero) {
  if (!hero) return;

  const setTxt = (id, t) => { const el = byId(id); if (el && t) el.textContent = t; };
  setTxt('heroGreeting',   hero.greeting);
  setTxt('heroTagline',    hero.tagline);
  setTxt('heroSubtitle',   hero.subtitle);
  setTxt('heroScrollHint', hero.scrollHint);

  // Animate name letters
  const lettersEl = byId('heroNameLetters');
  if (lettersEl && hero.name) {
    lettersEl.innerHTML = hero.name.split('').map((ch, i) =>
      `<span class="hero-letter" style="--delay:${0.5 + i * 0.12}s">${ch}</span>`
    ).join('');
  }

  // Create stars
  const starsEl = byId('heroStars');
  if (starsEl) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 120; i++) {
      const s = document.createElement('div');
      const sz = Math.random() * 3 + 1;
      s.className = 'hero-star';
      s.style.cssText = `width:${sz}px;height:${sz}px;top:${Math.random()*100}%;left:${Math.random()*100}%;--dur:${(Math.random()*4+2).toFixed(1)}s;animation-delay:${(Math.random()*5).toFixed(1)}s;`;
      frag.appendChild(s);
    }
    starsEl.appendChild(frag);
  }
}

/* ================================================================
   19-C. POLAROID WALL
================================================================ */
function renderPolaroidWall(cards) {
  const track = byId('polaroidTrack');
  if (!track || !cards?.length) return;

  const rots = [-3, 2, -1.5, 3, -2.5, 1, -4, 2.5, -1, 3.5];
  track.appendChild(utils.buildFragment(cards, ({ img, title }, i) => {
    const card = utils.el('div', 'polaroid-card');
    card.style.setProperty('--rot', (rots[i % rots.length]) + 'deg');
    card.innerHTML =
      `<div class="pol-img-wrap"><img src="${img}" loading="lazy" decoding="async" alt="${title}"></div>` +
      `<div class="polaroid-caption">${title}</div>`;
    return card;
  }));

  // ── Drag scroll (mouse + touch) ──────────────────────────────────
  let isDown = false, startX = 0, scrollLeft = 0;
  track.addEventListener('mousedown',   e => { isDown = true; startX = e.pageX - track.offsetLeft; scrollLeft = track.scrollLeft; track.style.cursor = 'grabbing'; });
  track.addEventListener('mouseleave',  () => { isDown = false; track.style.cursor = ''; });
  track.addEventListener('mouseup',     () => { isDown = false; track.style.cursor = ''; });
  track.addEventListener('mousemove',   e => {
    if (!isDown) return;
    e.preventDefault();
    track.scrollLeft = scrollLeft - (e.pageX - track.offsetLeft - startX);
    updatePolScrollbar();
  });
  // Touch scroll
  let touchStartX = 0, touchScrollLeft = 0;
  track.addEventListener('touchstart',  e => { touchStartX = e.touches[0].pageX; touchScrollLeft = track.scrollLeft; }, { passive: true });
  track.addEventListener('touchmove',   e => { track.scrollLeft = touchScrollLeft - (e.touches[0].pageX - touchStartX); updatePolScrollbar(); }, { passive: true });

  // ── Custom scrollbar ─────────────────────────────────────────────
  const thumb = byId('polScrollThumb');
  function updatePolScrollbar() {
    if (!thumb) return;
    const ratio   = track.clientWidth / track.scrollWidth;
    const thumbW  = Math.max(ratio * 100, 8);
    const thumbL  = (track.scrollLeft / (track.scrollWidth - track.clientWidth)) * (100 - thumbW);
    thumb.style.width = thumbW + '%';
    thumb.style.left  = (thumbL || 0) + '%';
  }
  track.addEventListener('scroll', updatePolScrollbar, { passive: true });
  // init after images load
  setTimeout(updatePolScrollbar, 400);
}

/* ================================================================
   19-D. TIMELINE
================================================================ */
function renderTimeline(items) {
  const track = byId('timelineTrack');
  if (!track || !items?.length) return;

  track.appendChild(utils.buildFragment(items, ({ label, title, desc, img, color }, i) => {
    const item = utils.el('div', 'tl-item');
    item.style.transitionDelay = (i * 0.1) + 's';
    item.style.setProperty('--color', color || '#f5c842');
    item.innerHTML =
      `<div class="tl-card">` +
        `<img class="tl-card-img" src="${img}" loading="lazy" decoding="async" alt="${title}">` +
        `<div class="tl-label">${label}</div>` +
        `<div class="tl-card-title">${title}</div>` +
        `<div class="tl-card-desc">${desc}</div>` +
      `</div>` +
      `<div class="tl-dot" style="--color:${color}"></div>`;
    return item;
  }));

  // Drag scroll
  let isDown = false, startX = 0, scrollLeft = 0;
  track.addEventListener('mousedown',  e => { isDown = true; startX = e.pageX - track.offsetLeft; scrollLeft = track.scrollLeft; });
  track.addEventListener('mouseleave', () => isDown = false);
  track.addEventListener('mouseup',    () => isDown = false);
  track.addEventListener('mousemove',  e => {
    if (!isDown) return; e.preventDefault();
    track.scrollLeft = scrollLeft - (e.pageX - track.offsetLeft - startX);
  });

  // Animate items into view
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.3 });
  track.querySelectorAll('.tl-item').forEach(el => obs.observe(el));
}

/* ================================================================
   19-E. WISH JAR
================================================================ */
function initWishJar(wishes) {
  if (!wishes?.length) return;
  const jar     = byId('wjJar');
  const layer   = byId('wjBubbles');
  if (!jar || !layer) return;

  let wishIndex = 0;

  const releaseWish = () => {
    const wish  = wishes[wishIndex % wishes.length];
    wishIndex++;

    const bubble = utils.el('div', 'wj-bubble');
    bubble.textContent = wish.wish;
    bubble.style.background = `linear-gradient(135deg, ${wish.color}cc, ${wish.color}88)`;
    bubble.style.borderColor = wish.color + '55';
    bubble.style.left  = `${utils.rand(15, 65)}vw`;
    bubble.style.setProperty('--dur', `${utils.rand(5, 8)}s`);
    layer.appendChild(bubble);

    // Jiggle the jar
    jar.style.transform = 'scale(0.93) rotate(-3deg)';
    setTimeout(() => { jar.style.transform = ''; }, 250);

    setTimeout(() => bubble.remove(), 8500);
  };

  jar.addEventListener('click', releaseWish);
  jar.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') releaseWish(); });

  // Auto-release first wish after 1s
  setTimeout(releaseWish, 1000);
}

/* ================================================================
   19-F. LETTER SECTION
================================================================ */
function renderLetter(letter) {
  if (!letter) return;

  const setTxt = (id, t) => { const el = byId(id); if (el && t) el.textContent = t; };
  setTxt('letterSectionTitle', letter.sectionTitle);
  setTxt('letterGreeting',     letter.greeting);
  setTxt('letterClosing',      letter.closing);
  setTxt('letterSig',          letter.signature);

  const linesEl = byId('letterLines');
  if (linesEl && letter.lines?.length) {
    linesEl.innerHTML = letter.lines.map(line =>
      `<p class="letter-line">${line}</p>`
    ).join('');
  }

  // Envelope open interaction
  const envWrap  = byId('envWrap');
  const letterCard = byId('letterCard');
  const envHint  = byId('envHint');
  let opened = false;

  const openLetter = () => {
    if (opened) return;
    opened = true;
    envWrap.classList.add('open');
    if (envHint) envHint.style.opacity = '0';

    setTimeout(() => {
      envWrap.style.opacity    = '0';
      envWrap.style.transform  = 'scale(0.85)';
      envWrap.style.transition = 'opacity 0.5s ease, transform 0.5s ease';

      setTimeout(() => {
        envWrap.style.display = 'none';
        letterCard.classList.remove('hidden');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            letterCard.classList.add('open');
            // Animate letter lines
            const lines = letterCard.querySelectorAll('.letter-line');
            lines.forEach((l, i) => setTimeout(() => l.classList.add('visible'), 400 + i * 220));
          });
        });
      }, 500);
    }, 600);
  };

  envWrap?.addEventListener('click', openLetter);
  envWrap?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openLetter(); });
}

/* ================================================================
   19-G. STATS COUNTER
================================================================ */
function renderStats(stats, titles) {
  const grid = byId('statsGrid');
  if (!grid || !stats?.length) return;

  const frag = document.createDocumentFragment();
  stats.forEach(s => {
    const card = utils.el('div', 'stat-card');
    card.innerHTML = `
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-num" data-target="${s.value}" data-suffix="${s.suffix || ''}">0</div>
      <div class="stat-label">${s.label}</div>`;
    frag.appendChild(card);
  });
  grid.appendChild(frag);

  // Animate numbers when section enters view
  const animateCounters = () => {
    grid.querySelectorAll('.stat-num').forEach(el => {
      const target  = +el.dataset.target;
      const suffix  = el.dataset.suffix || '';
      const dur     = 2000;
      const start   = performance.now();
      const tick = now => {
        const prog = Math.min((now - start) / dur, 1);
        const ease = 1 - Math.pow(1 - prog, 3);
        el.textContent = Math.floor(ease * target) + (prog >= 1 ? suffix : '');
        if (prog < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };
  lazyInit('#statsSection', animateCounters, '0px 0px -80px 0px');
}

/* ================================================================
   19-H. FILM REEL STRIP
================================================================ */
function renderFilmReel(images) {
  const top = byId('frStripTop');
  const bot = byId('frStripBot');
  if (!top || !bot || !images?.length) return;

  // Build a doubled list for seamless infinite loop
  const buildStrip = imgs => {
    const doubled = [...imgs, ...imgs];
    return doubled.map(src => `
      <div class="fr-frame">
        <div class="fr-sprocket fr-sp-t"></div>
        <img src="${src}" alt="Memory" loading="lazy">
        <div class="fr-sprocket fr-sp-b"></div>
      </div>`).join('');
  };

  top.innerHTML = buildStrip(images);
  bot.innerHTML = buildStrip([...images].reverse());

  // Inject keyframe & animation dynamically (once)
  if (!document.getElementById('fr-anim-style')) {
    const style = document.createElement('style');
    style.id = 'fr-anim-style';
    const frameW   = 160; // px per frame (matches CSS)
    const totalPx  = images.length * frameW;
    style.textContent = `
      @keyframes frScrollL { from { transform: translateX(0) } to { transform: translateX(-${totalPx}px) } }
      @keyframes frScrollR { from { transform: translateX(-${totalPx}px) } to { transform: translateX(0) } }
      .fr-strip-top { animation: frScrollL ${images.length * 1.8}s linear infinite; }
      .fr-strip-bot { animation: frScrollR ${images.length * 1.8}s linear infinite; }
      .fr-strip-top:hover, .fr-strip-bot:hover { animation-play-state: paused; }
    `;
    document.head.appendChild(style);
  }
}

/* ================================================================
   19-I. QUALITIES WALL
================================================================ */
function renderQualities(qualities) {
  const grid = byId('qlGrid');
  if (!grid || !qualities?.length) return;

  const frag = document.createDocumentFragment();
  qualities.forEach((q, i) => {
    const card = utils.el('div', 'ql-card');
    card.style.setProperty('--ql-color', q.color || '#f5c842');
    card.style.animationDelay = `${i * 0.12}s`;
    card.innerHTML = `
      <div class="ql-icon-wrap">
        <i class="fa-solid ${q.icon} ql-icon"></i>
      </div>
      <h3 class="ql-title">${q.title}</h3>
      <p  class="ql-desc">${q.desc}</p>
      <div class="ql-line"></div>`;
    frag.appendChild(card);
  });
  grid.appendChild(frag);

  // Stagger-reveal cards on scroll-into-view
  lazyInit('#qualitiesSection', () => {
    grid.querySelectorAll('.ql-card').forEach((c, i) => {
      setTimeout(() => c.classList.add('ql-visible'), i * 120);
    });
  }, '0px 0px -60px 0px');
}

/* ================================================================
   19. BOOTSTRAP
   Single fetch — split into critical (above-fold) vs deferred.
================================================================ */
fetch('data.json')
  .then(r => r.json())
  .then(data => {
    // ── Populate all dynamic texts (site meta, headings, etc.) ───
    populateDynamicTexts(data);

    // ── Critical path (above fold) ───────────────────────────────
    renderHero(data.hero);
    renderBook(data.book);
    initClock();

    // ── New sections ─────────────────────────────────────────────
    renderStats(data.stats, data.sectionTitles?.stats);
    lazyInit('#filmReelSection',  () => renderFilmReel(data.filmReel));
    lazyInit('#qualitiesSection', () => renderQualities(data.qualities));

    // ── Existing deferred renders ─────────────────────────────────
    renderSlider(data.memories);
    renderCarousel(data.carousel);
    renderPolaroidWall(data.carouselCards);
    renderSpinner(data.spinner, data.spinLabel);
    renderJhoomar(data.jhoomar);
    lazyInit('#timelineSection', () => renderTimeline(data.timeline));
    renderMagicalGallery(data.magicalGallery);
    initCircularGallery(data.AnimatedFrameImages, data.frameText);
    lazyInit('#wishJarSection', () => initWishJar(data.wishJar));
    lazyInit('#letterSection',  () => renderLetter(data.letter));

    // ── Idle tasks ───────────────────────────────────────────────
    createFireflies();
    scheduleMusicInit();

    // ── Hide loader after critical content is ready ──────────────
    requestAnimationFrame(() => {
      setTimeout(() => {
        byId('loader')?.classList.add('hidden');
        $('.book-controls')?.classList.remove('d-none');
      }, 600);
    });
  })
  .catch(err => console.error('Failed to load data.json:', err));


/* ================================================================
   20. ENHANCED UI / UX  — added on top of original logic
   • scroll progress bar
   • side section nav dots + scroll spy
   • top control rail (mute / celebrate / fullscreen / scroll-top)
   • welcome toast (first visit, localStorage)
   • cursor heart trail (throttled, respects reduced-motion)
   • loader fake progress
================================================================ */

(() => {
  // ── reduced motion check ──
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // ── Sections list (id -> label) — must mirror index.html order ──
  const SECTIONS = [
    { id: 'heroSection',          label: 'Welcome'        },
    { id: 'statsSection',         label: 'Our Numbers'    },
    { id: 'bookSection',          label: 'The Book'       },
    { id: 'sliderSection',        label: 'Memories'       },
    { id: 'carouselSection',      label: 'Carousel'       },
    { id: 'polaroidSection',      label: 'Polaroids'      },
    { id: 'filmReelSection',      label: 'Film Reel'      },
    { id: 'spinSection',          label: '3D Spin'        },
    { id: 'jhoomarSection',       label: 'Hanging Hearts' },
    { id: 'timelineSection',      label: 'Our Journey'    },
    { id: 'qualitiesSection',     label: 'Qualities'      },
    { id: 'magicalGallerySection',label: 'Magical Gallery'},
    { id: 'music-player-section', label: 'Music Player'   },
    { id: 'wishJarSection',       label: 'Wish Jar'       },
    { id: 'frameSection',         label: 'Circular Frame' },
    { id: 'letterSection',        label: 'Letter'         },
    { id: 'cakeFinaleSection',    label: 'Finale'         },
  ];

  /* ── 1. SCROLL PROGRESS BAR ── */
  const sp = byId('scrollProgress');
  if (sp) {
    let ticking = false;
    const update = () => {
      const max = (document.documentElement.scrollHeight - window.innerHeight) || 1;
      const pct = Math.min(100, Math.max(0, (window.scrollY / max) * 100));
      sp.style.width = pct + '%';
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ── 2. SIDE NAV DOTS + SCROLL SPY ── */
  const sn = byId('sideNav');
  if (sn) {
    const present = SECTIONS.filter(s => byId(s.id));
    sn.innerHTML = present.map(s =>
      `<button class="sn-dot" data-target="${s.id}" data-label="${s.label}" aria-label="Jump to ${s.label}"></button>`
    ).join('');
    sn.addEventListener('click', e => {
      const dot = e.target.closest('.sn-dot');
      if (!dot) return;
      const tgt = byId(dot.dataset.target);
      if (tgt) tgt.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    });

    const dotMap = new Map();
    sn.querySelectorAll('.sn-dot').forEach(d => dotMap.set(d.dataset.target, d));
    const setActive = id => {
      sn.querySelectorAll('.sn-dot.active').forEach(d => d.classList.remove('active'));
      dotMap.get(id)?.classList.add('active');
    };

    const obs = new IntersectionObserver(entries => {
      // pick the most visible section
      const visible = entries.filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible.length) setActive(visible[0].target.id);
    }, { threshold: [0.35, 0.55, 0.75] });
    present.forEach(s => { const el = byId(s.id); if (el) obs.observe(el); });

    // reveal once loader hides
    setTimeout(() => sn.classList.add("ready"), 800);
  }

  /* ── 3. TOP CONTROL RAIL ── */
  const tc      = byId('topControls');
  const tcMute  = byId('tcMute');
  const tcCel   = byId('tcCelebrate');
  const tcFull  = byId('tcFullscreen');
  const tcTop   = byId('tcTop');

  if (tc) setTimeout(() => tc.classList.add("ready"), 800);

  // mute / unmute (toggles the bgMusic + 3d music player audio)
  tcMute?.addEventListener('click', () => {
    const audios = $$('audio, video');
    const muted  = !tcMute.classList.contains('is-muted');
    audios.forEach(a => { a.muted = muted; });
    tcMute.classList.toggle('is-muted', muted);
    tcMute.querySelector('i').className = muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
    tcMute.title = muted ? 'Unmute music' : 'Mute music';
  });

  // celebrate — global confetti burst
  tcCel?.addEventListener('click', () => spawnConfetti(80));

  // fullscreen
  tcFull?.addEventListener('click', () => {
    const doc = document;
    const isFs = doc.fullscreenElement || doc.webkitFullscreenElement;
    if (!isFs) {
      const el = doc.documentElement;
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
      tcFull.querySelector('i').className = 'fa-solid fa-compress';
    } else {
      (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
      tcFull.querySelector('i').className = 'fa-solid fa-expand';
    }
  });
  document.addEventListener('fullscreenchange', () => {
    if (!tcFull) return;
    const isFs = !!document.fullscreenElement;
    tcFull.querySelector('i').className = isFs ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
  });

  // back to top — cross-browser fix
  tcTop?.addEventListener('click', () => {
    const behavior = prefersReduced ? 'auto' : 'smooth';
    try { window.scrollTo({ top: 0, behavior }); } catch(e) {}
    try { document.documentElement.scrollTo({ top: 0, behavior }); } catch(e) {}
    try { document.body.scrollTo({ top: 0, behavior }); } catch(e) {}
    // hard fallback for edge cases
    setTimeout(() => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 50);
  });

  /* ── 4. CONFETTI BURST (used by Celebrate button) ── */
  function spawnConfetti(count = 60) {
    const layer = document.createElement('div');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9500;overflow:hidden;';
    document.body.appendChild(layer);
    const colors = ['#ff7eb3', '#f5c842', '#ffae75', '#7ad7ff', '#b388ff', '#ff5e8a', '#fff5fc'];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      const sz = 6 + Math.random() * 8;
      const dur = 2 + Math.random() * 2.4;
      const xDrift = (Math.random() - 0.5) * 200;
      p.style.cssText =
        `position:absolute;top:-30px;left:${Math.random() * 100}%;` +
        `width:${sz}px;height:${sz * 1.6}px;background:${colors[i % colors.length]};` +
        `border-radius:${Math.random() < 0.4 ? '50%' : '2px'};opacity:.95;` +
        `transform:rotate(${Math.random() * 360}deg);` +
        `animation:confettiBurst ${dur}s cubic-bezier(.2,.7,.3,1) ${Math.random() * 0.3}s forwards;` +
        `--tx:${xDrift}px;`;
      layer.appendChild(p);
    }
    setTimeout(() => layer.remove(), 4500);
  }
  // confetti keyframes (inject once)
  if (!document.getElementById('confetti-burst-style')) {
    const st = document.createElement('style');
    st.id = 'confetti-burst-style';
    st.textContent =
      '@keyframes confettiBurst{0%{transform:translate(0,0) rotate(0)}' +
      '100%{transform:translate(var(--tx),110vh) rotate(720deg);opacity:0}}';
    document.head.appendChild(st);
  }

  /* ── 5. WELCOME TOAST (first visit) ── */
  const wt = byId('welcomeToast');
  if (wt) {
    const KEY = 'somu_welcome_seen_v1';
    const dismiss = () => {
      wt.classList.remove('show');
      wt.classList.add('hide');
      localStorage.setItem(KEY, '1');
      setTimeout(() => wt.remove(), 600);
    };
    byId('welcomeClose')?.addEventListener('click', dismiss);
    if (!localStorage.getItem(KEY)) {
      setTimeout(() => wt.classList.add("show"), 1200);
      setTimeout(dismiss, 12000); // auto-hide after 12s
    } else {
      wt.remove();
    }
  }

  /* ── 6. CURSOR HEART TRAIL (throttled, hover-only desktop) ── */
  const ch = byId('cursorHearts');
  const hasFinePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  if (ch && hasFinePointer && !prefersReduced) {
    let last = 0;
    const HEARTS = ['♥', '✦', '✧', '❤'];
    document.addEventListener('mousemove', e => {
      const now = performance.now();
      if (now - last < 80) return;
      last = now;
      const piece = document.createElement('span');
      piece.className = 'ch-piece';
      piece.textContent = HEARTS[(Math.random() * HEARTS.length) | 0];
      piece.style.left = e.clientX + 'px';
      piece.style.top  = e.clientY + 'px';
      piece.style.fontSize = (10 + Math.random() * 8) + 'px';
      piece.style.color = Math.random() < 0.5 ? '#ff7eb3' : '#f5c842';
      ch.appendChild(piece);
      setTimeout(() => piece.remove(), 1300);
    }, { passive: true });
  }

  /* ── 7. LOADER FAKE PROGRESS (visual sync with 3s reveal) ── */
  const lp = byId('loaderProgressBar');
  if (lp) {
    let p = 0;
    const tick = () => {
      // ease toward 95% over ~2.6s
      p += Math.max(0.6, (95 - p) * 0.05);
      if (p > 95) p = 95;
      lp.style.width = p + '%';
      if (p < 95) setTimeout(tick, 90);
    };
    tick();
    // jump to 100% just before loader hides (script.js line ~755 hides at 3000ms)
    setTimeout(() => { lp.style.width = '100%'; }, 700);
  }

})();

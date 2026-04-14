/* ================================================================
   main.js — Fully Optimized & Reusable
   Architecture:
     1. Utils        — Tiny helpers used everywhere
     2. DOM          — Safe element access
     3. DragEngine   — Reusable pointer/touch drag logic
     4. Book         — Flip-book rendering & navigation
     5. Slider       — Memory slider
     6. Carousel     — 3D drag carousel
     7. Spinner      — 3D image spinner
     8. Jhoomar      — Hanging chandelier
     9. MagicalGallery — Draggable + flippable cards
    10. CircularGallery & Halo Frame — Rotating thumb gallery
    11. MusicPlayer   — Playlist, volume, UI sync
    12. Clock         — Analog clock hands
    13. CakeFinale    — Candle blow + fireworks reveal
    14. Fireflies     — Ambient particles
    15. BirthdayEffect / FireworkPiece — Canvas fireworks
    16. RoseOverlay   — Magical rose modal
    17. Bootstrap     — data.json fetch → init all
================================================================ */

/* ================================================================
   1. UTILS
================================================================ */
const PI2 = Math.PI * 2;
const COLORS = ['#ff7eb3', '#f5c842', '#33ccff', '#ff9933', '#cc33ff'];

const utils = {
  rand: (min, max) => (Math.random() * (max - min + 1) + min) | 0,
  now: () => Date.now(),
  clamp: (val, lo, hi) => Math.max(lo, Math.min(val, hi)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  toggleClass: (el, cls, condition) => el?.classList.toggle(cls, condition),
  swapClass: (el, remove, add) => { el?.classList.remove(remove); el?.classList.add(add); },
  buildFragment: (items, mapper) => {
    const frag = document.createDocumentFragment();
    items.forEach(item => frag.appendChild(mapper(item)));
    return frag;
  },
  el: (tag, className = '', html = '') => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (html) e.innerHTML = html;
    return e;
  },
};

/* ================================================================
   2. DOM
================================================================ */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const byId = id => document.getElementById(id);

/* ================================================================
   3. DRAG ENGINE
================================================================ */
function attachDrag(target, { onStart, onMove, onEnd }) {
  if (!target) return;
  const norm = e => ({
    clientX: e.touches ? e.touches[0].clientX : e.clientX,
    clientY: e.touches ? e.touches[0].clientY : e.clientY,
    raw: e,
  });
  const start = e => onStart?.(norm(e));
  const move = e => { e.preventDefault(); onMove?.(norm(e)); };
  const end = e => onEnd?.(norm(e));

  target.addEventListener('mousedown', start);
  target.addEventListener('touchstart', start, { passive: false });
  target.addEventListener('mousemove', move);
  target.addEventListener('touchmove', move, { passive: false });
  target.addEventListener('mouseup', end);
  target.addEventListener('touchend', end);
  target.addEventListener('mouseleave', end);
}

/* ================================================================
   4. BOOK
================================================================ */
let currentPage = 1;
let maxPages = 0;
let appData = [];

function renderBook(book) {
  const container = byId('book');
  if (!container || !book?.length) return;
  appData = book;
  maxPages = book.length;

  container.innerHTML = book.map((p, i) => {
    const front = p.isCover
      ? `<div class="front" id="cover"><h1 class="cover-title">${p.frontContent.title}</h1><p>${p.frontContent.chapter}</p><small onclick="goNext()">${p.frontContent.footer}</small></div>`
      : `<div class="front"><img src="${p.frontContent.img}" class="photo-frame" loading="lazy"><p>${p.frontContent.text}</p></div>`;

    const back = p.isCover
      ? `<div class="back"><h3>${p.backContent.title}</h3><p>${p.backContent.text}</p><p class="heart-symbol">${p.backContent.symbol}</p></div>`
      : i === maxPages - 1
        ? `<div class="back" id="back-cover"><h2>${p.backContent.title}</h2><p>${p.backContent.text}</p></div>`
        : `<div class="back"><img src="${p.backContent.img}" class="photo-frame" loading="lazy"><p>${p.backContent.text}</p></div>`;

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
    cl.toggle('open-book', currentPage > 1 && currentPage <= maxPages);
  }
  const setDisplay = (id, show) => {
    const btn = byId(id);
    if (btn) btn.style.display = show ? 'inline-block' : 'none';
  };
  setDisplay('prevBtn', currentPage > 1);
  setDisplay('nextBtn', currentPage <= maxPages);
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
   5. SLIDER
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
}

document.addEventListener('click', e => {
  const slider = byId('sliderList');
  if (!slider) return;
  const items = $$('.slider .item');
  if (!items.length) return;
  
  if (e.target.closest('.next')) {
    slider.append(items[0]);
  } else if (e.target.closest('.prev')) {
    slider.prepend(items[items.length - 1]);
  } 
  else if (e.target.closest('.item')) {
    slider.append(items[0]);
  }
});

/* ================================================================
   6. 3D CAROUSEL
================================================================ */
function renderCarousel(carousel) {
  const container = byId('dragCarousel');
  if (!container || !carousel?.length) return;
  container.appendChild(utils.buildFragment(carousel, ({ img, title, num }) => {
    const div = utils.el('div', 'carousel-item');
    div.innerHTML = `<div class="carousel-box"><div class="title">${title}</div><div class="num">${num}</div>${img ? `<img src="${img}" loading="lazy">` : ''}</div>`;
    return div;
  }));
  initCarousel();
}

function initCarousel() {
  let progress = 50, activeIndex = 0;
  const items = $$('.carousel-item');
  const section = byId('carouselSection');
  if (!items.length || !section) return;

  const update = () => {
    progress = utils.clamp(progress, 0, 100);
    activeIndex = Math.floor(progress / 100 * (items.length - 1));
    items.forEach((item, i) => {
      item.style.setProperty('--zIndex', i === activeIndex ? items.length : items.length - Math.abs(activeIndex - i));
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
    onMove: ({ clientX }) => { progress += (clientX - startX) * -0.1; startX = clientX; update(); },
  });
}

/* ================================================================
   7. 3D SPINNER
================================================================ */
function renderSpinner(spinner) {
  const container = byId('spin-container');
  if (!container || !spinner?.length) return;
  const pTag = container.querySelector('p');
  container.insertBefore(
    utils.buildFragment(spinner, ({ img }) => {
      const imgEl = utils.el('img');
      imgEl.src = img;
      imgEl.loading = 'lazy';
      return imgEl;
    }),
    pTag
  );
  initSpinner();
}

function initSpinner() {
  const radius = 240, rotateSpeed = -60, imgWidth = 120, imgHeight = 170;
  const spinSection = byId('spinSection'), odrag = byId('drag-container'), ospin = byId('spin-container');
  if (!ospin || !odrag || !spinSection) return;

  const aImg = ospin.getElementsByTagName('img'), aVid = ospin.getElementsByTagName('video');
  const aEle = [...aImg, ...aVid];
  ospin.style.width = imgWidth + "px"; ospin.style.height = imgHeight + "px";

  const ground = byId('ground');
  if (ground) { ground.style.width = radius * 3 + "px"; ground.style.height = radius * 3 + "px"; }

  setTimeout(() => {
    for (let i = 0; i < aEle.length; i++) {
      aEle[i].style.transform = `rotateY(${i * (360 / aEle.length)}deg) translateZ(${radius}px)`;
      aEle[i].style.transition = "transform 1s";
      aEle[i].style.transitionDelay = (aEle.length - i) / 4 + "s";
    }
  }, 1000);

  let sX, sY, nX, nY, desX = 0, desY = 0, tX = 0, tY = 10;
  ospin.style.animation = `${rotateSpeed > 0 ? 'spin' : 'spinRevert'} ${Math.abs(rotateSpeed)}s infinite linear`;

  function applyTransform(obj) {
    if (tY > 180) tY = 180;
    if (tY < 0) tY = 0;
    obj.style.transform = `rotateX(${-tY}deg) rotateY(${tX}deg)`;
  }
  function playSpin(yes) { ospin.style.animationPlayState = yes ? 'running' : 'paused'; }

  spinSection.onpointerdown = function (e) {
    clearInterval(odrag.timer);
    e = e || window.event;
    sX = e.clientX; sY = e.clientY;

    document.onpointermove = function (e) {
      e = e || window.event;
      nX = e.clientX; nY = e.clientY;
      desX = nX - sX; desY = nY - sY;
      tX += desX * 0.1; tY += desY * 0.1;
      applyTransform(odrag);
      sX = nX; sY = nY;
    };

    document.onpointerup = function () {
      odrag.timer = setInterval(function () {
        desX *= 0.95; desY *= 0.95;
        tX += desX * 0.1; tY += desY * 0.1;
        applyTransform(odrag);
        playSpin(false);
        if (Math.abs(desX) < 0.5 && Math.abs(desY) < 0.5) {
          clearInterval(odrag.timer);
          playSpin(true);
        }
      }, 17);
      document.onpointermove = document.onpointerup = null;
    };
    return false;
  };
}

/* ================================================================
   8. JHOOMAR (CHANDELIER)
================================================================ */
function renderJhoomar(items) {
  const container = byId('jhoomar-container');
  if (!container || !items?.length) return;
  const w = window.innerWidth;
  const maxPerRow = w < 600 ? 4 : w < 900 ? 6 : 9;

  let html = '';
  for (let i = 0; i < items.length; i += maxPerRow) {
    const row = items.slice(i, i + maxPerRow);
    const n = row.length;
    const mid = Math.max((n - 1) / 2, 1);

    html += `<div class="jhoomar-row">` +
      row.map(({ img }, j) => {
        const dist = (j - mid) / mid;
        const strH = 40 + 90 * (dist * dist);
        const dur = (2.5 + Math.random() * 1.5).toFixed(1) + 's';
        const delay = Math.random().toFixed(1) + 's';
        return `<div class="jhoomar-item" style="animation:swing ${dur} ease-in-out ${delay} infinite alternate;"><div class="string" style="height:${strH}px"></div><div class="heart-frame"><img src="${img}" class="hanging-img" loading="lazy"></div></div>`;
      }).join('') + `</div>`;
  }
  container.innerHTML = html;
}

/* ================================================================
   9. MAGICAL GALLERY
================================================================ */
function renderMagicalGallery(gallery) {
  const container = byId('magical-cards-container');
  if (!container || !gallery?.length) return;

  container.innerHTML = gallery.map(({ id, isMain, type, src, frontNote, backNote }) => {
    const sizeClass = isMain ? 'card-video' : 'card-photo';
    const media = type === 'video'
      ? `<div class="drag-handle"></div><video src="${src}" controls playsinline></video>`
      : `<img src="${src}" loading="lazy">`;

    return `<div class="magical-card ${sizeClass}" id="${id}"><div class="card-inner"><div class="card-front">${media}<div class="card-note">${frontNote}<span class="tap-hint">(Tap to flip)</span></div></div><div class="card-back" style="background-image:url('${src}');"><div class="back-overlay"></div><div class="back-note">${backNote}</div></div></div></div>`;
  }).join('');
  initMagicalGallery();
}

function initMagicalGallery() {
  let topZ = 100;
  $$('.magical-card').forEach(card => {
    const isVideo = card.classList.contains('card-video');
    const range = isVideo ? 0 : 120;
    let offsetX = (Math.random() - 0.5) * range * 2;
    let offsetY = (Math.random() - 0.5) * range * 2;
    const rotate = isVideo ? 0 : (Math.random() - 0.5) * 30;

    const applyPos = (extra = '') => card.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) rotate(${rotate}deg)${extra}`;
    applyPos();

    let startX, startY, moved = 0, startTime = 0;
    attachDrag(card, {
      onStart: ({ clientX, clientY, raw }) => {
        if (raw.target.tagName.toLowerCase() === 'video') return;
        moved = 0; startTime = Date.now(); card.style.zIndex = ++topZ; card.style.transition = 'none';
        startX = clientX; startY = clientY;
      },
      onMove: ({ clientX, clientY }) => {
        moved += Math.abs(clientX - startX) + Math.abs(clientY - startY);
        offsetX += clientX - startX; offsetY += clientY - startY;
        const tiltX = (clientY - startY) * -0.5, tiltY = (clientX - startX) * 0.5;
        applyPos(` rotateX(${tiltX}deg) rotateY(${tiltY}deg)`);
        startX = clientX; startY = clientY;
      },
      onEnd: () => {
        card.style.transition = 'transform 0.5s ease-out'; applyPos();
        if (Date.now() - startTime < 300 && moved < 20) card.classList.toggle('flipped');
      },
    });
  });
}

/* ================================================================
   10. CIRCULAR GALLERY & HALO FRAME
================================================================ */

// Updates the center photo and the surrounding glowing text
function renderAnimatedFrame(imgUrl, textContent = 'HAPPY BIRTHDAY SAUMYA') {
  const bg = byId('frameBg');
  const textContainer = byId('dynamicTextContainer');
  if (!bg || !textContainer || !imgUrl) return;

  bg.style.background = `url('${imgUrl}') no-repeat center`;
  bg.style.backgroundSize = 'cover';

  const chars = (textContent + ' • ').repeat(4).split('');
  const deg = 360 / chars.length;
  textContainer.innerHTML = chars.map((ch, i) =>
    `<span style="transform:rotate(${i * deg}deg) translateY(calc(var(--size) * -0.65));">${ch}</span>`
  ).join('');
}

// Global function to be called from HTML onclick
window.changeCenterFrame = function(imgUrl) {
    renderAnimatedFrame(imgUrl, 'HAPPY BIRTHDAY SAUMYA');
};

function initCircularGallery(animatedFrameImages) {
  const wrapper = byId('gallery-wrapper');
  if (!wrapper || !animatedFrameImages || animatedFrameImages.length === 0) return;

  let generatedHTML = '';
  animatedFrameImages.forEach((item, index) => {
    const i = index + 1;
    const imgUrl = item.imgUrl || item.img; // Support both naming styles
    generatedHTML += `
      <div class="thumb" data-title="${item.title}" style="--i:${i};">
        <a href="javascript:void(0)" onclick="changeCenterFrame('${imgUrl}')">
            <img src="${imgUrl}" alt="${item.title}" loading="lazy">
        </a>
      </div>`;
  });

  // Append new thumbs without overwriting the center frame
  wrapper.insertAdjacentHTML('beforeend', generatedHTML);

  // Set the first image as default in center
  const firstImg = animatedFrameImages[0].imgUrl || animatedFrameImages[0].img;
  renderAnimatedFrame(firstImg, 'HAPPY BIRTHDAY SAUMYA');
}

/* ================================================================
   11. MUSIC PLAYER
================================================================ */
async function initMusicPlayer() {
  const audio = $('#bgMusic'), playBtn3D = $('#mp-btn-3d-play'), playBtnPanel = $('#mp-btn-play-pause'),
    playIcon = $('#mp-play-icon'), cas = $('#mp-cas'), tsh = $('#mp-tsh'), lgh = $('#mp-lgh'),
    saumyaImg = $('#music-popup img'), saumyaPopup = $('#music-popup'), fileUpload = byId('mp-file-upload'),
    prevBtn = byId('mp-btn-prev'), nextBtn = byId('mp-btn-next'), volumeRadios = $$('#music-player-section input[name="switch"]');

  let saumyaImages = [], playlist = [], currentIndex = 0;

  try {
    const data = await fetch('data.json').then(r => r.json());
    saumyaImages = data.saumyaImages || [];
    playlist = data.musicList || [];
    if (audio && playlist.length) {
      audio.src = playlist[0].src; audio.loop = playlist.length === 1;
    }
  } catch (e) { console.error('Music player data load failed:', e); }

  audio?.addEventListener('error', () => console.error('Audio error: file not found or unsupported format.'));

  const setLoopMode = () => { if (audio) audio.loop = playlist.length === 1; };
  const setUI = (playing) => {
    cas.classList.toggle('is-radio-playing', playing); tsh.classList.toggle('is-tape-close', playing);
    playBtn3D.classList.toggle('is-button-pressed', playing);
    if (playing) setTimeout(() => lgh.classList.add('is-wave-playing'), 1000); else lgh.classList.remove('is-wave-playing');
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
  const changeSong = (dir) => {
    if (!audio || playlist.length <= 1) return;
    saumyaPopup?.classList.remove('show');
    currentIndex = dir === 'next' ? (currentIndex + 1) % playlist.length : (currentIndex - 1 + playlist.length) % playlist.length;
    audio.src = playlist[currentIndex].src; setTimeout(safePlay, 400);
  };

  playBtn3D?.addEventListener('click', toggle); playBtnPanel?.addEventListener('click', toggle);
  prevBtn?.addEventListener('click', () => changeSong('prev')); nextBtn?.addEventListener('click', () => changeSong('next'));
  audio?.addEventListener('ended', () => changeSong('next'));

  fileUpload?.addEventListener('change', ({ target: { files } }) => {
    if (!files.length || !audio) return;
    playlist = Array.from(files).map(f => ({ name: f.name, src: URL.createObjectURL(f) }));
    currentIndex = 0; audio.src = playlist[0].src; setLoopMode(); safePlay();
  });

  const VOL_MAP = { switch_off: 0, switch_1: 0.2, switch_2: 0.4, switch_3: 0.6, switch_4: 0.8, switch_5: 1.0 };
  volumeRadios.forEach(r => r.addEventListener('change', ({ target }) => { if (audio) audio.volume = VOL_MAP[target.id] ?? 1; }));
  document.body.addEventListener('click', () => { if (audio?.paused && playlist.length > 0) { safePlay(); } }, { once: true });
}

/* =============================================================
   GENERATE EXACT DOT RINGS VISUALIZER
============================================================= */
function createDotVisualizer() {
  const container = document.getElementById('dot-visualizer');
  if (!container) return;
  let html = '';
  for (let r = 1; r <= 10; r++) {
    let numDots = 18 + (r - 1) * 6;
    let radius = 40 + (r - 1) * 11; 
    let delay = (r * 0.333333).toFixed(5);
    let ringHtml = `<div class="ring" style="position: absolute; width: 80px; height: 80px; top: 160px; left: 160px;">`;
    
    for (let d = 1; d <= numDots; d++) {
      let angle = ((d - 1) * (360 / numDots)).toFixed(4);
      ringHtml += `
        <div class="dot" style="position: absolute; width: 8px; height: 8px; top: 40px; left: 40px; transform: translate3d(0, -${radius}px, 0) rotate(${angle}deg); transform-origin: 0 ${radius}px;">
          <div class="fill" style="width: 8px; height: 8px; background: #fff; border-radius: 50%; box-shadow: 0 0 8px rgba(255,255,255,0.8); animation: pulsate 2s ease-in-out ${delay}s alternate infinite both;"></div>
        </div>`;
    }
    ringHtml += `</div>`;
    html += ringHtml;
  }
  
  container.innerHTML = html;
}

// Page load hone par dots bana do
document.addEventListener('DOMContentLoaded', createDotVisualizer);

/* ================================================================
   12. CLOCK
================================================================ */
function initClock() {
  const hour = byId('hour'), minute = byId('minute'), second = byId('second');
  if (!hour || !minute || !second) return;
  const tick = () => {
    const d = new Date();
    hour.style.transform = `rotate(${30 * d.getHours() + d.getMinutes() / 2}deg)`;
    minute.style.transform = `rotate(${6 * d.getMinutes()}deg)`;
    second.style.transform = `rotate(${6 * d.getSeconds()}deg)`;
  };
  tick(); setInterval(tick, 1000);
}

/* ================================================================
   13. CAKE FINALE
================================================================ */
let isDeskBlown = false;
function blowCandleAndReveal() {
  if (isDeskBlown) return;
  const desk = byId('mainContainerDesk'), flame = byId('flame'), tapText = byId('tap-text'), cake = byId('cake'), canvas = byId('grandReveal'), section = byId('cakeFinaleSection');
  desk?.classList.add('blowing');
  if (tapText) tapText.style.opacity = '0';
  setTimeout(() => {
    if (flame) flame.style.display = 'none';
    isDeskBlown = true;
    if (cake) cake.style.cursor = 'default';
    setTimeout(() => {
      desk?.classList.remove('blowing');
      setTimeout(() => {
        if (desk) desk.style.opacity = '0';
        if (section) section.style.background = '#0a0a0a';
        setTimeout(() => {
          canvas?.classList.remove('hidden');
          if (typeof BirthdayEffect !== 'undefined') {
            const fx = new BirthdayEffect(); let then = Date.now();
            const loop = () => { requestAnimationFrame(loop); const now = Date.now(); fx.update((now - then) / 1000); then = now; };
            loop();
          }
        }, 800);
      }, 800);
    }, 600);
  }, 500);
}

/* ================================================================
   14. FIREFLIES
================================================================ */
function createFireflies() {
  const container = byId('firefly-container');
  if (!container) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 30; i++) {
    const el = utils.el('div', 'firefly');
    el.style.left = `${Math.random() * 100}vw`; el.style.animationDuration = `${Math.random() * 5 + 5}s`; el.style.animationDelay = `${Math.random() * 5}s`;
    frag.appendChild(el);
  }
  container.appendChild(frag);
}

/* ================================================================
   15. CANVAS FIREWORKS
================================================================ */
class BirthdayEffect {
  constructor() {
    this.canvas = byId('birthdayCanvas'); this.ctx = this.canvas.getContext('2d');
    this.fireworks = []; this.counter = 0; this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    this.width = this.canvas.width = window.innerWidth; this.height = this.canvas.height = window.innerHeight;
    const cx = (this.width / 2) | 0; this.spawnA = (cx - cx / 4) | 0; this.spawnB = (cx + cx / 4) | 0;
    this.spawnC = this.height * 0.1; this.spawnD = this.height * 0.5;
  }
  update(delta) {
    const { ctx } = this; ctx.globalCompositeOperation = 'hard-light'; ctx.fillStyle = `rgba(20,20,20,${7 * delta})`; ctx.fillRect(0, 0, this.width, this.height); ctx.globalCompositeOperation = 'lighter';
    this.fireworks.forEach(fw => fw.draw(ctx, delta, this));
    this.counter += delta * 3;
    if (this.counter >= 1) {
      this.fireworks.push(new FireworkPiece(utils.rand(this.spawnA, this.spawnB), this.height, utils.rand(0, this.width), utils.rand(this.spawnC, this.spawnD), utils.rand(0, 360), utils.rand(30, 110)));
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
      this.x += dx * 2 * delta; this.y += dy * 2 * delta; this.history.push({ x: this.x, y: this.y });
      if (this.history.length > 20) this.history.shift();
    } else {
      if (this.offsprings && !this.madeChilds) {
        const half = this.offsprings / 2;
        for (let i = 0; i < half; i++) {
          parent.fireworks.push(new FireworkPiece(this.x, this.y, (this.x + this.offsprings * Math.cos((PI2 * i) / half)) | 0, (this.y + this.offsprings * Math.sin((PI2 * i) / half)) | 0, this.shade, 0));
        }
        this.madeChilds = true;
      }
      this.history.shift();
    }
    if (!this.history.length) { this.dead = true; return; }
    ctx.beginPath(); ctx.fillStyle = `hsl(${this.shade},100%,50%)`; ctx.arc(this.x, this.y, 1, 0, PI2); ctx.fill();
  }
}

/* ================================================================
   16. ROSE OVERLAY
================================================================ */
function openMagicalRose() { byId('roseOverlay')?.classList.add('active'); setTimeout(() => byId('magicGlass')?.classList.add('lift-up'), 800); }
function closeMagicalRose() { byId('roseOverlay')?.classList.remove('active'); setTimeout(() => byId('magicGlass')?.classList.remove('lift-up'), 500); }

/* ================================================================
   17. BOOTSTRAP
================================================================ */
fetch('data.json')
  .then(r => r.json())
  .then(data => {
    renderBook(data.book);
    renderSlider(data.memories);
    renderCarousel(data.carousel);
    renderSpinner(data.spinner);
    renderJhoomar(data.jhoomar);
    renderMagicalGallery(data.magicalGallery);
    initCircularGallery(data.AnimatedFrameImages); 

    initClock();
    createFireflies();
    initMusicPlayer();

    setTimeout(() => {
      byId('loader')?.classList.add('hidden');
      $('.book-controls')?.classList.remove('d-none');
    }, 3000);
  })
  .catch(err => console.error('Failed to load data.json:', err));

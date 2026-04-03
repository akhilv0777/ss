
/* =============================================================
   GLOBAL STATE
   Core variables shared across all book and animation logic
============================================================= */
let maxPages = 0;
let currentPage = 1;
let appData = [];


/* =============================================================
   CONSTANTS
============================================================= */
const PI2 = Math.PI * 2;
const COLORS = ['#ff7eb3', '#f5c842', '#33ccff', '#ff9933', '#cc33ff'];
const random = (min, max) => (Math.random() * (max - min + 1) + min) | 0;
const now = () => new Date().getTime();


/* =============================================================
   DATA LOADER
   Fetches data.json and initializes all UI sections
============================================================= */
fetch('data.json')
  .then(r => r.json())
  .then(data => {
    renderBook(data.book);
    renderSlider(data.memories);
    renderCarousel(data.carousel);
    renderSpinner(data.spinner);
    renderJhoomar(data.jhoomar);
    renderMagicalGallery(data.magicalGallery);
    renderAnimatedFrame(data.animatedFrame);
    document.getElementById('loader')?.classList.add('hidden');
    document.querySelector('.book-controls')?.classList.remove('d-none');
  })
  .catch(err => console.error('Failed to load data.json:', err));


/* =============================================================
   BOOK — RENDER
   Builds all pages using a DocumentFragment for performance
============================================================= */
function renderBook(book) {
  if (!book?.length) return;

  const container = document.getElementById('book');
  if (!container) return;

  appData = book;
  maxPages = book.length;

  const fragment = document.createDocumentFragment();

  book.forEach((page, index) => {
    const div = document.createElement('div');
    div.className = 'page';
    div.id = page.id;
    div.innerHTML = buildFront(page) + buildBack(page, index === maxPages - 1);
    fragment.appendChild(div);
  });

  container.appendChild(fragment);
  updateZIndex();
}

/** Builds the front face of a book page */
function buildFront({ isCover, frontContent }) {
  if (isCover) {
    return `
      <div class="front" id="cover">
        <h1 class="cover-title">${frontContent.title}</h1>
        <p>${frontContent.chapter}</p>
        <small onclick="goNext()">${frontContent.footer}</small>
      </div>`;
  }
  return `
    <div class="front">
      <img src="${frontContent.img}" class="photo-frame" loading="lazy">
      <p>${frontContent.text}</p>
    </div>`;
}

/** Builds the back face of a book page */
function buildBack({ isCover, backContent }, isLast) {
  if (isCover) {
    return `
      <div class="back">
        <h3>${backContent.title}</h3>
        <p>${backContent.text}</p>
        <p class="heart-symbol">${backContent.symbol}</p>
      </div>`;
  }
  if (isLast) {
    return `
      <div class="back" id="back-cover">
        <h2>${backContent.title}</h2>
        <p>${backContent.text}</p>
      </div>`;
  }
  return `
    <div class="back">
      <img src="${backContent.img}" class="photo-frame" loading="lazy">
      <p>${backContent.text}</p>
    </div>`;
}


/* =============================================================
   BOOK — NAVIGATION
   Handles page flipping, z-index stacking, and CSS class state
============================================================= */

/** Recalculates z-index so pages stack correctly while flipping */
function updateZIndex() {
  appData.forEach((page, i) => {
    const el = document.getElementById(page.id);
    if (!el) return;
    // Flipped pages sit at the bottom; unflipped pages stack on top
    el.style.zIndex = (i + 1) < currentPage ? (i + 1) : (maxPages - i + 10);
  });
}

/** Syncs container CSS classes based on the current page position */
function toggleBookState() {
  const cl = document.querySelector('.book-container')?.classList;
  if (!cl) return;
  cl.toggle('closed-back', currentPage > maxPages);
  cl.toggle('open-book', currentPage > 1 && currentPage <= maxPages);
}

/** Flips to the next page */
function goNext() {
  if (currentPage > maxPages) return;
  document.getElementById(`p${currentPage}`).style.transform = 'rotateY(-180deg)';
  currentPage++;
  updateZIndex();
  toggleBookState();
}

/** Flips back to the previous page */
function goPrev() {
  if (currentPage <= 1) return;
  currentPage--;
  document.getElementById(`p${currentPage}`).style.transform = 'rotateY(0deg)';
  updateZIndex();
  toggleBookState();
}


/* =============================================================
   SLIDER — RENDER & NAVIGATION
============================================================= */

/** Populates the memory slider list */
function renderSlider(memories) {
  const slider = document.getElementById('sliderList');
  if (!slider || !memories?.length) return;

  const fragment = document.createDocumentFragment();
  memories.forEach(({ img, title, desc }) => {
    const li = document.createElement('li');
    li.className = 'item';
    li.style.backgroundImage = `url('${img}')`;
    li.innerHTML = `
      <div class="content">
        <h2 class="title">${title}</h2>
        <p class="description">${desc}</p>
        <button>Read More</button>
      </div>`;
    fragment.appendChild(li);
  });

  slider.appendChild(fragment);
}

/** Handles next/prev clicks for the slider via event delegation */
document.addEventListener('click', e => {
  const slider = document.getElementById('sliderList');
  if (!slider) return;

  const items = document.querySelectorAll('.slider .item');
  if (!items.length) return;

  if (e.target.closest('.next')) slider.append(items[0]);
  if (e.target.closest('.prev')) slider.prepend(items[items.length - 1]);
});


/* =============================================================
   3D CAROUSEL
============================================================= */

/** Renders carousel items and sets up drag + click interaction */
function renderCarousel(carousel) {
  const container = document.getElementById('dragCarousel');
  if (!container || !carousel?.length) return;

  const fragment = document.createDocumentFragment();
  carousel.forEach(({ img, title, num }) => {
    const div = document.createElement('div');
    div.className = 'carousel-item';
    div.innerHTML = `
      <div class="carousel-box">
        <div class="title">${title}</div>
        <div class="num">${num}</div>
        ${img ? `<img src="${img}" loading="lazy">` : ''}
      </div>`;
    fragment.appendChild(div);
  });

  container.appendChild(fragment);
  initCarousel();
}

/** Initializes 3D carousel drag and click interactions */
function initCarousel() {
  let progress = 50, startX = 0, activeIndex = 0, isDragging = false;

  const items = document.querySelectorAll('.carousel-item');
  const section = document.getElementById('carouselSection');
  if (!items.length || !section) return;

  const update = () => {
    progress = Math.max(0, Math.min(progress, 100));
    activeIndex = Math.floor(progress / 100 * (items.length - 1));
    items.forEach((item, i) => {
      const z = i === activeIndex ? items.length : items.length - Math.abs(activeIndex - i);
      item.style.setProperty('--zIndex', z);
      item.style.setProperty('--active', (i - activeIndex) / items.length);
    });
  };
  update();

  // Click on item to bring it to focus
  items.forEach((item, i) => {
    item.addEventListener('click', () => { progress = (i / items.length) * 100 + 10; update(); });
  });

  const handleMove = x => {
    if (!isDragging) return;
    progress += (x - startX) * -0.1;
    startX = x;
    update();
  };

  // Mouse events
  section.addEventListener('mousedown', e => { isDragging = true; startX = e.clientX; });
  section.addEventListener('mousemove', e => handleMove(e.clientX));
  section.addEventListener('mouseup', () => isDragging = false);
  section.addEventListener('mouseleave', () => isDragging = false);

  // Touch events
  section.addEventListener('touchstart', e => { isDragging = true; startX = e.touches[0].clientX; });
  section.addEventListener('touchmove', e => handleMove(e.touches[0].clientX));
  section.addEventListener('touchend', () => isDragging = false);
}


/* =============================================================
   3D SPINNER
============================================================= */

/** Renders spinner images and initializes the 3D rotation */
function renderSpinner(spinner) {
  const container = document.getElementById('spin-container');
  if (!container || !spinner?.length) return;

  const pTag = container.querySelector('p');
  const fragment = document.createDocumentFragment();

  spinner.forEach(({ img }) => {
    const imgEl = document.createElement('img');
    imgEl.src = img;
    imgEl.loading = 'lazy';
    fragment.appendChild(imgEl);
  });

  container.insertBefore(fragment, pTag);
  initSpinner();
}

/** Initializes the draggable 3D image spinner */
function initSpinner() {
  const imgW = 120, imgH = 170, radius = 240, rotateSpeed = -60;

  const spinContainer = document.getElementById('spin-container');
  const dragContainer = document.getElementById('drag-container');
  const spinSection = document.getElementById('spinSection');
  const images = spinContainer?.getElementsByTagName('img');

  if (!images?.length) return;

  spinContainer.style.width = `${imgW}px`;
  spinContainer.style.height = `${imgH}px`;

  // Arrange images in a circle after a brief delay
  const arrange = (delay) => {
    Array.from(images).forEach((img, i) => {
      img.style.transform = `rotateY(${i * (360 / images.length)}deg) translateZ(${radius}px)`;
      img.style.transition = 'transform 1s';
      img.style.transitionDelay = delay ?? `${(images.length - i) / 4}s`;
    });
  };
  setTimeout(arrange, 1000);

  spinContainer.style.animation = `${rotateSpeed > 0 ? 'spin' : 'spinRevert'} ${Math.abs(rotateSpeed)}s infinite linear`;

  // Drag state
  let sX, sY, nX, nY, desX = 0, desY = 0, tX = 0, tY = 10;

  const applyTransform = () => {
    tY = Math.max(0, Math.min(tY, 180));
    dragContainer.style.transform = `rotateX(${-tY}deg) rotateY(${tX}deg)`;
  };

  spinSection.addEventListener('pointerdown', function (e) {
    clearInterval(dragContainer.timer);
    sX = e.clientX;
    sY = e.clientY;

    this.onpointermove = e => {
      nX = e.clientX; nY = e.clientY;
      desX = nX - sX; desY = nY - sY;
      tX += desX * 0.1; tY += desY * 0.1;
      applyTransform();
      sX = nX; sY = nY;
    };

    // On release, apply inertia and gradually slow down
    this.onpointerup = () => {
      dragContainer.timer = setInterval(() => {
        desX *= 0.95; desY *= 0.95;
        tX += desX * 0.1; tY += desY * 0.1;
        applyTransform();
        spinContainer.style.animationPlayState = 'paused';

        if (Math.abs(desX) < 0.5 && Math.abs(desY) < 0.5) {
          clearInterval(dragContainer.timer);
          spinContainer.style.animationPlayState = 'running';
        }
      }, 17);
      this.onpointermove = this.onpointerup = null;
    };
  });
}


/* =============================================================
   JHOOMAR (HANGING DECORATION)
============================================================= */

/** Renders alternating strings and hanging images */
function renderJhoomar(items) {
  const container = document.getElementById('jhoomar-container');
  if (!container || !items?.length) return;

  // First item gets a taller string to anchor the decoration
  container.innerHTML = items.map(({ img }, i) => `
    <div class="string" style="height:${i === 0 ? '80px' : '50px'}"></div>
    <img src="${img}" class="hanging-img" loading="lazy">
  `).join('');
}


/* =============================================================
   MAGICAL GALLERY
============================================================= */

/** Renders draggable/flippable media cards */
function renderMagicalGallery(gallery) {
  const container = document.getElementById('magical-cards-container');
  if (!container || !gallery?.length) return;

  container.innerHTML = gallery.map(({ id, isMain, type, src, frontNote, backNote }) => {
    const sizeClass = isMain ? 'card-video' : 'card-photo';
    const media = type === 'video'
      ? `<div class="drag-handle"></div><video src="${src}" controls playsinline></video>`
      : `<img src="${src}" loading="lazy">`;

    return `
      <div class="magical-card ${sizeClass}" id="${id}">
        <div class="card-inner">
          <div class="card-front">
            ${media}
            <div class="card-note">${frontNote}<span class="tap-hint">(Tap to flip)</span></div>
          </div>
          <div class="card-back">
            <div class="back-note">${backNote}</div>
          </div>
        </div>
      </div>`;
  }).join('');

  initMagicalGallery();
}

/** Adds drag-to-move and tap-to-flip behavior to each card */
function initMagicalGallery() {
  const cards = document.querySelectorAll('.magical-card');
  let topZ = 100;

  cards.forEach(card => {
    const isVideo = card.classList.contains('card-video');
    const range = isVideo ? 0 : 120;

    // Random initial position and rotation (video stays centered)
    let offsetX = (Math.random() - 0.5) * range * 2;
    let offsetY = (Math.random() - 0.5) * range * 2;
    let rotation = isVideo ? 0 : (Math.random() - 0.5) * 30;

    card.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) rotate(${rotation}deg)`;

    let isDragging = false, startX, startY;
    let moveDistance = 0, startTime = 0;

    const startDrag = e => {
      // Let the browser handle native video controls
      if (e.target.tagName.toLowerCase() === 'video') return;

      isDragging = true;
      moveDistance = 0;
      startTime = Date.now();

      // Bring this card to the front
      card.style.zIndex = ++topZ;
      card.style.transition = 'none';

      startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
      startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

      document.addEventListener('mousemove', onDrag);
      document.addEventListener('touchmove', onDrag, { passive: false });
      document.addEventListener('mouseup', endDrag);
      document.addEventListener('touchend', endDrag);
    };

    const onDrag = e => {
      if (!isDragging) return;
      e.preventDefault();

      const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
      const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

      moveDistance += Math.abs(clientX - startX) + Math.abs(clientY - startY);
      offsetX += clientX - startX;
      offsetY += clientY - startY;

      // Slight tilt in the direction of drag
      const tiltX = (clientY - startY) * -0.5;
      const tiltY = (clientX - startX) * 0.5;

      card.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) rotate(${rotation}deg) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;

      startX = clientX;
      startY = clientY;
    };

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;

      const elapsed = Date.now() - startTime;

      // Snap back to flat rotation after drag
      card.style.transition = 'transform 0.5s ease-out';
      card.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) rotate(${rotation}deg)`;

      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('touchmove', onDrag);
      document.removeEventListener('mouseup', endDrag);
      document.removeEventListener('touchend', endDrag);

      // Short tap with minimal movement = flip the card
      if (elapsed < 300 && moveDistance < 20) card.classList.toggle('flipped');
    };

    card.addEventListener('mousedown', startDrag);
    card.addEventListener('touchstart', startDrag);
  });
}


/* =============================================================
   ANIMATED FRAME TEXT
============================================================= */

/** Fills the animated frame with character spans for staggered animation */
function renderAnimatedFrame({ img, text } = {}) {
  const frame = document.getElementById('dynamicFrame');
  const textContainer = document.getElementById('dynamicTextContainer');
  if (!frame || !textContainer || !text) return;

  frame.style.background = `url('${img}') no-repeat center`;

  const totalSpans = 54;
  // Repeat text until we have enough characters, then take exactly totalSpans
  const chars = text.repeat(Math.ceil(totalSpans / text.length))
    .slice(0, totalSpans)
    .split('')
    .reverse();

  textContainer.innerHTML = chars.map((char, i) =>
    `<span style="animation-delay:${0.22 * (i + 1)}s">${char}</span>`
  ).join('');
}


/* =============================================================
   BACKGROUND MUSIC
   Deferred autoplay on first user interaction (browser policy)
============================================================= */
document.body.addEventListener('click', () => {
  const music = document.getElementById('bgMusic');
  if (music?.paused) music.play().catch(console.warn);
}, { once: true });

/* =============================================================
   FIREFLIES (OPTIONAL)
============================================================= */

/** Creates ambient firefly elements in the firefly container */
function createFireflies() {
  const container = document.getElementById('firefly-container');
  if (!container) return;

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 30; i++) {
    const el = document.createElement('div');
    el.className = 'firefly';
    el.style.left = `${Math.random() * 100}vw`;
    el.style.animationDuration = `${Math.random() * 5 + 5}s`;
    el.style.animationDelay = `${Math.random() * 5}s`;
    fragment.appendChild(el);
  }
  container.appendChild(fragment);
}


// Clock Logic
const hour = document.getElementById('hour');
const minute = document.getElementById('minute');
const second = document.getElementById('second');

if (hour && minute && second) {
  setInterval(() => {
    const todayDate = new Date();
    const hRotation = 30 * todayDate.getHours() + todayDate.getMinutes() / 2;
    const mRotation = 6 * todayDate.getMinutes();
    const sRotation = 6 * todayDate.getSeconds();
    
    hour.style.transform = `rotate(${hRotation}deg)`;
    minute.style.transform = `rotate(${mRotation}deg)`;
    second.style.transform = `rotate(${sRotation}deg)`;
  }, 1000);
}

let isDeskBlown = false; 

function blowCandleAndReveal() {
  if (isDeskBlown) return;
  
  let containerDesk = document.getElementById('mainContainerDesk');
  let flame = document.getElementById('flame');
  let tapText = document.getElementById('tap-text');
  let cake = document.getElementById('cake');
  let revealCanvas = document.getElementById('grandReveal');
  let section = document.getElementById('cakeFinaleSection');

  // Ladki aage jhukegi
  if (containerDesk) containerDesk.classList.add('blowing');
  if (tapText) tapText.style.opacity = '0';

  setTimeout(() => {
    // 1. Aag bujhegi
    if (flame) flame.style.display = 'none';
    isDeskBlown = true; 
    if (cake) cake.style.cursor = 'default'; 

    setTimeout(() => {
      // 2. Ladki wapas peeche hogi
      if (containerDesk) containerDesk.classList.remove('blowing');
      
      // 3. Desk ko gayab karo aur background dark karo
      setTimeout(() => {
        if (containerDesk) containerDesk.style.opacity = '0';
        if (section) section.style.background = '#0a0a0a';
        
        // 4. Grand Canvas Reveal chalu karo!
        setTimeout(() => {
          if (revealCanvas) revealCanvas.classList.remove('hidden');
          
          // START THE FIREWORKS LOOP (TIMESTAMP ERROR FIXED)
          if(typeof BirthdayEffect !== 'undefined') {
            let birthdayAnim = new BirthdayEffect();
            let then = Date.now(); // <-- Yahan theek kiya
            
            (function loop() {
              requestAnimationFrame(loop);
              let currentTime = Date.now(); // <-- Yahan theek kiya
              let delta = currentTime - then;
              then = currentTime;
              birthdayAnim.update(delta / 1000);
            })();
          }
        }, 800);
      }, 800);
    }, 600);
  }, 500);
}


/* =============================================================
   DOM FIREWORK BURST — CSS PARTICLE EXPLOSION
============================================================= */

/** Creates a single burst of CSS-animated particles at a random position */
function createFireworkBurst() {
  const container = document.getElementById('fireworks-container');
  if (!container) return;

  const palette = [...COLORS, '#fff', '#ff3366'];
  const originX = 10 + Math.random() * 80; // % from left
  const originY = 10 + Math.random() * 60; // % from top

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < 60; i++) {
    const p = document.createElement('div');
    p.className = 'fw-particle';
    p.style.backgroundColor = palette[Math.floor(Math.random() * palette.length)];
    p.style.left = `${originX}vw`;
    p.style.top = `${originY}vh`;

    const angle = Math.random() * PI2;
    const distance = Math.random() * 200 + 50;
    p.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
    p.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
    p.style.animationDuration = `${Math.random() * 0.8 + 0.8}s`;

    fragment.appendChild(p);

    // Auto-clean particle from DOM after animation ends
    setTimeout(() => p.remove(), 2000);
  }

  container.appendChild(fragment);
}


/* =============================================================
   CANVAS FIREWORKS — BIRTHDAY EFFECT
   Continuous particle-based firework animation on a canvas
============================================================= */

class BirthdayEffect {
  constructor() {
    this.canvas = document.getElementById('birthdayCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.fireworks = [];
    this.counter = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Resizes canvas and recalculates spawn zones */
  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
    const center = (this.width / 2) | 0;
    this.spawnA = (center - center / 4) | 0;
    this.spawnB = (center + center / 4) | 0;
    this.spawnC = this.height * 0.1;
    this.spawnD = this.height * 0.5;
  }

  /** Called each animation frame — clears canvas and updates all particles */
  update(delta) {
    this.ctx.globalCompositeOperation = 'hard-light';
    this.ctx.fillStyle = `rgba(20,20,20,${7 * delta})`;
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.globalCompositeOperation = 'lighter';
    this.fireworks.forEach(fw => fw.draw(this.ctx, delta, this));

    // Spawn a new firework every frame cycle
    this.counter += delta * 3;
    if (this.counter >= 1) {
      this.fireworks.push(new FireworkPiece(
        random(this.spawnA, this.spawnB), this.height,
        random(0, this.width), random(this.spawnC, this.spawnD),
        random(0, 360), random(30, 110)
      ));
      this.counter = 0;
    }

    // Prune dead fireworks to prevent memory bloat
    if (this.fireworks.length > 1000)
      this.fireworks = this.fireworks.filter(fw => !fw.dead);
  }
}

class FireworkPiece {
  constructor(x, y, targetX, targetY, shade, offsprings) {
    this.x = x; this.y = y;
    this.targetX = targetX; this.targetY = targetY;
    this.shade = shade;
    this.offsprings = offsprings;
    this.history = [];
    this.madeChilds = false;
    this.dead = false;
  }

  draw(ctx, delta, parent) {
    if (this.dead) return;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      // Still travelling toward target — move and record trail
      this.x += dx * 2 * delta;
      this.y += dy * 2 * delta;
      this.history.push({ x: this.x, y: this.y });
      if (this.history.length > 20) this.history.shift();
    } else {
      // Reached target — spawn child particles if this is a parent firework
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

    // Trail exhausted — mark dead
    if (!this.history.length) { this.dead = true; return; }

    ctx.beginPath();
    ctx.fillStyle = `hsl(${this.shade},100%,50%)`;
    ctx.arc(this.x, this.y, 1, 0, PI2);
    ctx.fill();
  }
}


// ===================== CUTE DESK & GRAND REVEAL LOGIC =====================

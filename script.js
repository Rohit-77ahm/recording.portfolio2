
// =========================================================
// TOBI — PORTFOLIO CAROUSEL
// Add another video by adding one object to VIDEOS below.
// =========================================================


const VIDEOS = [
  {
    title: "Minecraft Cinematic",
    description: "Cinematic camera work and smooth movement.",
    src: "videos/recording2.mp4",
    type: "mp4"
  },
  {
    title: "Minecraft Film",
    description: "Captured moments from another perspective.",
    src: "videos/recording3.mp4",
    type: "mp4"
  },
  {
    title: "Minecraft Cinematic",
    description: "Captured moments from another perspective.",
    src: "videos/recording1.mp4",
    type: "mp4"
  }
];


const DISCORD_USERNAME = "tobiunphased";
const TRANSITION_MS = 650;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const header = $("#site-header");
const progressBar = $("#scroll-progress");
const cursorDot = $("#cursor-dot");

const menuToggle = $("#menu-toggle");
const menuClose = $("#menu-close");
const mobileMenu = $("#mobile-menu");

const carousel = $("#video-carousel");
const stage = $("#carousel-stage");
const prevButton = $("#carousel-prev");
const nextButton = $("#carousel-next");
const currentCounter = $("#carousel-current");
const totalCounter = $("#carousel-total");
const indicators = $("#carousel-indicators");

const lightbox = $("#lightbox");
const lightboxPlayer = $("#lightbox-player");
const lightboxTitle = $("#lightbox-title");
const lightboxLabel = $("#lightbox-label");
const lightboxClose = $("#lightbox-close");

const copyButton = $("#copy-discord");
const copyLabel = $("#copy-label");
const copyFeedback = $("#copy-feedback");

let currentIndex = 0;
let isAnimating = false;
let animationTimer = null;
let lightboxReturnFocus = null;
let touchStartX = 0;
let touchStartY = 0;
let dragStartX = 0;
let isDragging = false;
let hasDragged = false;
let pointerId = null;
let lastPointerX = 0;
let lastClickTime = 0;

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
);

// ---------- Helpers ----------

function padNumber(number) {
  return String(number).padStart(2, "0");
}

function modulo(number, length) {
  return ((number % length) + length) % length;
}

function getYouTubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.slice(1);
    }

    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }

      const match = parsed.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/);
      return match ? match[1] : null;
    }
  } catch {
    return null;
  }

  return null;
}

function getYouTubeEmbedUrl(url) {
  const id = getYouTubeId(url);
  return id
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`
    : null;
}

function getVideoType(video) {
  return video.type === "youtube" ? "YOUTUBE" : "MP4 VIDEO";
}

function createPlayIcon() {
  return `
    <svg viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
      <path d="M1 1.2a.8.8 0 0 1 1.2-.7l9 5.8a.8.8 0 0 1 0 1.4l-9 5.8A.8.8 0 0 1 1 12.8z"/>
    </svg>`;
}

// ---------- Build slide markup ----------

function createSlide(offset) {
  const slide = document.createElement("article");
  slide.className = "carousel-slide";
  slide.dataset.offset = String(offset);

  slide.innerHTML = `
    <div class="video-card">
      <div class="video-visual">
        <div class="video-poster-fallback" aria-hidden="true"></div>
        <img class="video-poster" alt="" draggable="false" hidden>
        <span class="poster-number"></span>
        <span class="poster-caption">TOBIUNPHASED / FILM</span>
        <button class="play-button" type="button" aria-label="Play featured video">
          ${createPlayIcon()}
        </button>
      </div>
      <div class="video-details">
        <div class="video-detail-main">
          <span class="video-number"></span>
          <h3 class="video-heading"></h3>
          <p class="video-description"></p>
        </div>
        <span class="video-type"></span>
      </div>
    </div>`;

  slide.addEventListener("click", () => {
    if (isDragging || hasDragged || isAnimating) return;

    const offsetValue = Number(slide.dataset.offset);
    const index = Number(slide.dataset.index);

    if (offsetValue !== 0) {
      goTo(index);
    }
  });

  $(".play-button", slide).addEventListener("click", event => {
    event.stopPropagation();

    if (
      Number(slide.dataset.offset) === 0 &&
      !isAnimating &&
      !hasDragged
    ) {
      openLightbox(Number(slide.dataset.index));
    }
  });

  return slide;
}

function updateSlideContent(slide, index) {
  const video = VIDEOS[index];
  const poster = $(".video-poster", slide);
  const fallback = $(".video-poster-fallback", slide);

  slide.dataset.index = String(index);

  $(".poster-number", slide).textContent = `FILM / ${padNumber(index + 1)}`;
  $(".video-number", slide).textContent = `NO. ${padNumber(index + 1)}`;
  $(".video-heading", slide).textContent = video.title;
  $(".video-description", slide).textContent = video.description;
  $(".video-type", slide).textContent = getVideoType(video);

  const playButton = $(".play-button", slide);
  playButton.setAttribute("aria-label", `Play ${video.title}`);

  if (video.poster) {
    poster.src = video.poster;
    poster.hidden = false;
    fallback.hidden = true;

    poster.onerror = () => {
      poster.hidden = true;
      fallback.hidden = false;
    };
  } else {
    poster.removeAttribute("src");
    poster.hidden = true;
    fallback.hidden = false;
  }
}

function setSlidePosition(slide, offset, animate = true) {
  slide.dataset.offset = String(offset);

  slide.classList.remove("is-active", "is-prev", "is-next", "is-hidden");

  if (!animate) {
    slide.style.transition = "none";
  } else {
    slide.style.removeProperty("transition");
  }

  if (offset === 0) {
    slide.classList.add("is-active");
    slide.setAttribute("aria-current", "true");
    slide.setAttribute("aria-label", `Current slide`);
    $(".play-button", slide).disabled = false;
  } else if (offset === -1) {
    slide.classList.add("is-prev");
    slide.setAttribute("aria-current", "false");
    slide.setAttribute("aria-label", "Previous slide");
    $(".play-button", slide).disabled = true;
  } else if (offset === 1) {
    slide.classList.add("is-next");
    slide.setAttribute("aria-current", "false");
    slide.setAttribute("aria-label", "Next slide");
    $(".play-button", slide).disabled = true;
  } else {
    slide.classList.add("is-hidden");
    slide.setAttribute("aria-current", "false");
    $(".play-button", slide).disabled = true;
  }

  // Side slides are navigation targets, not playable videos.
  if (offset !== 0) {
    slide.setAttribute("role", "button");
    slide.setAttribute("tabindex", "0");
  } else {
    slide.setAttribute("role", "group");
    slide.setAttribute("tabindex", "-1");
  }
}

function updateCounter() {
  currentCounter.textContent = padNumber(currentIndex + 1);
  totalCounter.textContent = padNumber(VIDEOS.length);

  $$(".carousel-dot", indicators).forEach((dot, index) => {
    const active = index === currentIndex;
    dot.setAttribute("aria-current", String(active));
    dot.setAttribute(
      "aria-label",
      `Go to slide ${index + 1}: ${VIDEOS[index].title}`
    );
  });
}

function createIndicators() {
  indicators.replaceChildren();

  VIDEOS.forEach((video, index) => {
    const dot = document.createElement("button");
    dot.className = "carousel-dot";
    dot.type = "button";
    dot.setAttribute("aria-label", `Go to slide ${index + 1}: ${video.title}`);
    dot.setAttribute("aria-current", String(index === currentIndex));
    dot.addEventListener("click", () => goTo(index));
    indicators.append(dot);
  });
}

function renderInitialSlides() {
  stage.replaceChildren();

  // Three visual slots let a two-video carousel show the same neighbor
  // on both sides while still looping cleanly.
  [-1, 0, 1].forEach(offset => {
    const slide = createSlide(offset);
    const index = modulo(currentIndex + offset, VIDEOS.length);

    updateSlideContent(slide, index);
    setSlidePosition(slide, offset, false);
    stage.append(slide);
  });

  // Allow the browser to apply the initial no-transition positions.
  requestAnimationFrame(() => {
    $$(".carousel-slide", stage).forEach(slide => {
      slide.style.removeProperty("transition");
    });
  });

  updateCounter();
}

// ---------- Carousel navigation ----------

function goTo(index) {
  if (VIDEOS.length < 2 || isAnimating) return;

  const target = modulo(index, VIDEOS.length);
  if (target === currentIndex) return;

  // Choose the shortest route around the loop.
  const forwardDistance = modulo(target - currentIndex, VIDEOS.length);
  const direction = forwardDistance <= VIDEOS.length / 2 ? 1 : -1;

  moveCarousel(direction);
}

function moveCarousel(direction) {
  if (VIDEOS.length < 2 || isAnimating) return;

  isAnimating = true;
  pauseLightboxMedia();

  const slides = $$(".carousel-slide", stage);

  // Shift each existing slide one position, animating the active slide
  // into its new side position and the destination into the center.
  slides.forEach(slide => {
    const oldOffset = Number(slide.dataset.offset);
    setSlidePosition(slide, oldOffset - direction, true);
  });

  currentIndex = modulo(currentIndex + direction, VIDEOS.length);
  updateCounter();

  const finishTransition = () => {
    window.clearTimeout(animationTimer);

    // Recycle the slide that has moved offstage into the far side slot.
    const recycled = slides.find(slide =>
      Number(slide.dataset.offset) === -2 * direction
    );

    if (recycled) {
      const newOffset = direction;
      const newIndex = modulo(currentIndex + newOffset, VIDEOS.length);

      setSlidePosition(recycled, newOffset, false);
      updateSlideContent(recycled, newIndex);

      // Force the new content to settle before restoring transitions.
      void recycled.offsetWidth;
      recycled.style.removeProperty("transition");
    }

    slides.forEach(slide => {
      slide.style.removeProperty("transition");
    });

    isAnimating = false;
  };

  if (prefersReducedMotion.matches) {
    finishTransition();
  } else {
    animationTimer = window.setTimeout(finishTransition, TRANSITION_MS);
  }
}

function jumpTo(index) {
  if (isAnimating) return;
  const target = modulo(index, VIDEOS.length);
  if (target === currentIndex) return;

  const forward = modulo(target - currentIndex, VIDEOS.length);
  const backward = modulo(currentIndex - target, VIDEOS.length);

  goTo(target);

  // For longer jumps, finish one move before queuing the next.
  const remaining = Math.min(forward, backward) - 1;
  if (remaining > 0) {
    const direction = forward <= backward ? 1 : -1;
    const queueStep = () => {
      if (isAnimating) {
        window.setTimeout(queueStep, TRANSITION_MS + 20);
        return;
      }

      if (currentIndex !== target) moveCarousel(direction);
    };

    window.setTimeout(queueStep, TRANSITION_MS + 20);
  }
}

prevButton.addEventListener("click", () => moveCarousel(-1));
nextButton.addEventListener("click", () => moveCarousel(1));

/* Keyboard navigation only runs when the carousel itself or one of its
   controls has focus, or while the carousel is visible in the viewport. */
carousel.addEventListener("keydown", event => {
  if (lightbox.classList.contains("open")) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveCarousel(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    moveCarousel(1);
  }
});

document.addEventListener("keydown", event => {
  if (lightbox.classList.contains("open")) return;

  if (!carousel.contains(document.activeElement)) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveCarousel(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    moveCarousel(1);
  }
});

// ---------- Swipe and click-drag ----------

stage.addEventListener("pointerdown", event => {
  if (event.target.closest("button")) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;

  pointerId = event.pointerId;
  dragStartX = event.clientX;
  lastPointerX = event.clientX;
  touchStartX = event.clientX;
  touchStartY = event.clientY;
  isDragging = true;
  hasDragged = false;
  stage.classList.add("dragging");

  try {
    stage.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is not supported by every browser.
  }
});

stage.addEventListener("pointermove", event => {
  if (!isDragging || event.pointerId !== pointerId) return;

  lastPointerX = event.clientX;

  const deltaX = event.clientX - dragStartX;
  const deltaY = event.clientY - touchStartY;

  if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
    hasDragged = true;
  }
});

function finishPointer(event) {
  if (!isDragging || event.pointerId !== pointerId) return;

  const deltaX = lastPointerX - touchStartX;
  const deltaY = event.clientY - touchStartY;

  isDragging = false;
  stage.classList.remove("dragging");

  if (hasDragged && Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
    moveCarousel(deltaX < 0 ? 1 : -1);
  }

  pointerId = null;

  // Prevent the click following a drag from activating a side slide.
  if (hasDragged) {
    lastClickTime = Date.now();
    window.setTimeout(() => {
      hasDragged = false;
    }, 80);
  }
}

stage.addEventListener("pointerup", finishPointer);
stage.addEventListener("pointercancel", finishPointer);
stage.addEventListener("lostpointercapture", () => {
  isDragging = false;
  stage.classList.remove("dragging");
});

stage.addEventListener("click", event => {
  if (Date.now() - lastClickTime < 120) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

// Make dimmed slides keyboard-accessible as navigation controls.
stage.addEventListener("keydown", event => {
  const slide = event.target.closest(".carousel-slide");
  if (!slide || slide.classList.contains("is-active")) return;

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    goTo(Number(slide.dataset.index));
  }
});

// ---------- Lightbox and video playback ----------

function pauseLightboxMedia() {
  const video = $("video", lightboxPlayer);
  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  lightboxPlayer.replaceChildren();
}

function openLightbox(index) {
  const video = VIDEOS[index];
  if (!video) return;

  pauseLightboxMedia();

  lightboxReturnFocus = document.activeElement;
  lightboxTitle.textContent = video.title;
  lightboxLabel.textContent = `FEATURED RECORDING / ${padNumber(index + 1)}`;

  if (video.type === "youtube") {
    const embedUrl = getYouTubeEmbedUrl(video.src);

    if (!embedUrl) {
      lightboxTitle.textContent = "Invalid YouTube link";
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.title = video.title;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.loading = "eager";
    lightboxPlayer.append(iframe);
  } else {
    const player = document.createElement("video");
    player.controls = true;
    player.autoplay = true;
    player.playsInline = true;
    player.preload = "none";
    player.src = video.src;

    if (video.poster) player.poster = video.poster;

    lightboxPlayer.append(player);
    player.play().catch(() => {
      // Controls remain available if autoplay is blocked by the browser.
    });
  }

  lightbox.classList.add("open");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("lightbox-open");
  lightboxClose.focus();
}

function closeLightbox() {
  if (!lightbox.classList.contains("open")) return;

  pauseLightboxMedia();
  lightbox.classList.remove("open");
  lightbox.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lightbox-open");

  if (lightboxReturnFocus && typeof lightboxReturnFocus.focus === "function") {
    lightboxReturnFocus.focus();
  }
}

lightboxClose.addEventListener("click", closeLightbox);

$("[data-close-lightbox]", lightbox).addEventListener("click", closeLightbox);

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (lightbox.classList.contains("open")) {
      closeLightbox();
    } else if (mobileMenu.classList.contains("open")) {
      closeMobileMenu();
    }
  }

  if (event.key === "Tab" && lightbox.classList.contains("open")) {
    const focusable = $$("button, a, iframe, video", lightbox)
      .filter(element => !element.disabled);

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

// ---------- Mobile navigation ----------

function openMobileMenu() {
  mobileMenu.classList.add("open");
  mobileMenu.setAttribute("aria-hidden", "false");
  menuToggle.setAttribute("aria-expanded", "true");
  document.body.classList.add("menu-open");

  const firstLink = $("nav a", mobileMenu);
  if (firstLink) firstLink.focus();
}

function closeMobileMenu() {
  if (!mobileMenu.classList.contains("open")) return;

  mobileMenu.classList.remove("open");
  mobileMenu.setAttribute("aria-hidden", "true");
  menuToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
  menuToggle.focus();
}

menuToggle.addEventListener("click", openMobileMenu);
menuClose.addEventListener("click", closeMobileMenu);

$$(".mobile-menu-links a", mobileMenu).forEach(link => {
  link.addEventListener("click", () => {
    mobileMenu.classList.remove("open");
    mobileMenu.setAttribute("aria-hidden", "true");
    menuToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  });
});

// ---------- Discord copy button ----------

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(DISCORD_USERNAME);
    copyLabel.textContent = "COPIED ✓";
    copyFeedback.textContent = "Username copied";
  } catch {
    // Fallback for contexts where the Clipboard API is unavailable.
    const input = document.createElement("textarea");
    input.value = DISCORD_USERNAME;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();

    const copied = document.execCommand("copy");
    input.remove();

    copyLabel.textContent = copied ? "COPIED ✓" : "COPY ↗";
    copyFeedback.textContent = copied
      ? "Username copied"
      : "Copy unavailable — tobiunphased";
  }

  window.setTimeout(() => {
    copyLabel.textContent = "COPY ↗";
    copyFeedback.textContent = "";
  }, 2200);
});

// ---------- Scroll effects ----------

function updateScrollEffects() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;

  progressBar.style.width = `${progress}%`;
  header.classList.toggle("scrolled", window.scrollY > 20);
}

window.addEventListener("scroll", updateScrollEffects, { passive: true });
updateScrollEffects();

// Reveal sections when they enter the viewport.
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  $$(".reveal").forEach(element => revealObserver.observe(element));
} else {
  $$(".reveal").forEach(element => element.classList.add("visible"));
}

// Optional subtle cursor dot on desktop devices.
if (cursorDot && window.matchMedia("(pointer: fine)").matches) {
  window.addEventListener("mousemove", event => {
    cursorDot.style.opacity = "0.65";
    cursorDot.style.transform =
      `translate(${event.clientX - 2}px, ${event.clientY - 2}px)`;
  }, { passive: true });

  document.addEventListener("mouseleave", () => {
    cursorDot.style.opacity = "0";
  });
}

// ---------- Initialize ----------

if (VIDEOS.length === 0) {
  carousel.hidden = true;
} else {
  createIndicators();
  renderInitialSlides();
}

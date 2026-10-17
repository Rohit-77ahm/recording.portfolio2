
"use strict";

// =========================================================
// TOBI — PORTFOLIO CAROUSEL
// YouTube embeds, looping carousel, lightbox, and interactions.
// Replace each VIDEO_ID below with the ID from your YouTube URL.
// Example: youtube.com/watch?v=abcdefghijk -> abcdefghijk
// =========================================================

const VIDEOS = [
  {
    title: "Minecraft Cinematic",
    description: "Cinematic camera work and smooth movement.",
    src: "SAARxlMABgk",
    type: "youtube"
  },
  {
    title: "Minecraft Film",
    description: "Captured moments from another perspective.",
    src: "Zaad-IAgaB8",
    type: "youtube"
  },
  {
    title: "Minecraft Cinematic",
    description: "Captured moments from another perspective.",
    src: "iiD-87wwQWA",
    type: "youtube"
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

function getYouTubeId(value) {
  if (!value || typeof value !== "string") return null;

  // Accept a direct 11-character YouTube video ID.
  if (/^[\w-]{11}$/.test(value)) {
    return value;
  }

  // Also accept complete YouTube URLs.
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    let id = null;

    if (
      hostname === "youtu.be" ||
      hostname.endsWith(".youtu.be")
    ) {
      id = parsed.pathname.split("/").filter(Boolean)[0] || null;
    } else if (
      hostname.includes("youtube.com") ||
      hostname.includes("youtube-nocookie.com")
    ) {
      if (parsed.pathname === "/watch") {
        id = parsed.searchParams.get("v");
      } else {
        const match = parsed.pathname.match(
          /\/(?:embed|shorts|live)\/([^/?]+)/
        );
        id = match ? match[1] : null;
      }
    }

    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function getYouTubeEmbedUrl(value) {
  const id = getYouTubeId(value);

  if (!id) return null;

  return (
    `https://www.youtube-nocookie.com/embed/${id}` +
    "?autoplay=1&rel=0&playsinline=1"
  );
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

  $(".poster-number", slide).textContent =
    `FILM / ${padNumber(index + 1)}`;

  $(".video-number", slide).textContent =
    `NO. ${padNumber(index + 1)}`;

  $(".video-heading", slide).textContent = video.title;
  $(".video-description", slide).textContent = video.description || "";
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

  slide.classList.remove(
    "is-active",
    "is-prev",
    "is-next",
    "is-hidden"
  );

  if (!animate) {
    slide.style.transition = "none";
  } else {
    slide.style.removeProperty("transition");
  }

  if (offset === 0) {
    slide.classList.add("is-active");
    slide.setAttribute("aria-current", "true");
    slide.setAttribute("aria-label", "Current slide");
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
    dot.setAttribute(
      "aria-current",
      String(index === currentIndex)
    );

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

    dot.setAttribute(
      "aria-label",
      `Go to slide ${index + 1}: ${video.title}`
    );

    dot.setAttribute(
      "aria-current",
      String(index === currentIndex)
    );

    dot.addEventListener("click", () => goTo(index));

    indicators.append(dot);
  });
}

function renderInitialSlides() {
  stage.replaceChildren();

  [-1, 0, 1].forEach(offset => {
    const slide = createSlide(offset);
    const index = modulo(currentIndex + offset, VIDEOS.length);

    updateSlideContent(slide, index);
    setSlidePosition(slide, offset, false);
    stage.append(slide);
  });

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

  const forwardDistance = modulo(
    target - currentIndex,
    VIDEOS.length
  );

  const direction =
    forwardDistance <= VIDEOS.length / 2 ? 1 : -1;

  moveCarousel(direction);
}

function moveCarousel(direction) {
  if (VIDEOS.length < 2 || isAnimating) return;

  isAnimating = true;
  pauseLightboxMedia();

  const slides = $$(".carousel-slide", stage);

  slides.forEach(slide => {
    const oldOffset = Number(slide.dataset.offset);
    setSlidePosition(slide, oldOffset - direction, true);
  });

  currentIndex = modulo(
    currentIndex + direction,
    VIDEOS.length
  );

  updateCounter();

  const finishTransition = () => {
    window.clearTimeout(animationTimer);

    const recycled = slides.find(slide =>
      Number(slide.dataset.offset) === -2 * direction
    );

    if (recycled) {
      const newOffset = direction;
      const newIndex = modulo(
        currentIndex + newOffset,
        VIDEOS.length
      );

      setSlidePosition(recycled, newOffset, false);
      updateSlideContent(recycled, newIndex);

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
    animationTimer = window.setTimeout(
      finishTransition,
      TRANSITION_MS
    );
  }
}

function jumpTo(index) {
  if (isAnimating) return;

  const target = modulo(index, VIDEOS.length);

  if (target === currentIndex) return;

  const forward = modulo(
    target - currentIndex,
    VIDEOS.length
  );

  const backward = modulo(
    currentIndex - target,
    VIDEOS.length
  );

  const direction = forward <= backward ? 1 : -1;
  const remaining = Math.min(forward, backward) - 1;

  moveCarousel(direction);

  if (remaining > 0) {
    const queueStep = () => {
      if (isAnimating) {
        window.setTimeout(queueStep, TRANSITION_MS + 20);
        return;
      }

      if (currentIndex !== target) {
        moveCarousel(direction);
        window.setTimeout(queueStep, TRANSITION_MS + 20);
      }
    };

    window.setTimeout(queueStep, TRANSITION_MS + 20);
  }
}

prevButton.addEventListener("click", () => moveCarousel(-1));
nextButton.addEventListener("click", () => moveCarousel(1));

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
    // Pointer capture may not be supported.
  }
});

stage.addEventListener("pointermove", event => {
  if (!isDragging || event.pointerId !== pointerId) return;

  lastPointerX = event.clientX;

  const deltaX = event.clientX - dragStartX;
  const deltaY = event.clientY - touchStartY;

  if (
    Math.abs(deltaX) > 8 &&
    Math.abs(deltaX) > Math.abs(deltaY)
  ) {
    hasDragged = true;
  }
});

function finishPointer(event) {
  if (!isDragging || event.pointerId !== pointerId) return;

  const deltaX = lastPointerX - touchStartX;
  const deltaY = event.clientY - touchStartY;

  isDragging = false;
  stage.classList.remove("dragging");

  if (
    hasDragged &&
    Math.abs(deltaX) > 45 &&
    Math.abs(deltaX) > Math.abs(deltaY)
  ) {
    moveCarousel(deltaX < 0 ? 1 : -1);
  }

  pointerId = null;

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

stage.addEventListener(
  "click",
  event => {
    if (Date.now() - lastClickTime < 120) {
      event.preventDefault();
      event.stopPropagation();
    }
  },
  true
);

stage.addEventListener("keydown", event => {
  const slide = event.target.closest(".carousel-slide");

  if (!slide || slide.classList.contains("is-active")) return;

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    goTo(Number(slide.dataset.index));
  }
});

// ---------- Lightbox and YouTube playback ----------

function pauseLightboxMedia() {
  if (!lightboxPlayer) return;

  const video = $("video", lightboxPlayer);

  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  // Removing the iframe stops the embedded YouTube video.
  lightboxPlayer.replaceChildren();
}

function openLightbox(index) {
  const video = VIDEOS[index];

  if (!video || !lightbox || !lightboxPlayer) return;

  const embedUrl = getYouTubeEmbedUrl(video.src);

  if (video.type === "youtube" && !embedUrl) {
    if (lightboxTitle) {
      lightboxTitle.textContent = "Check YouTube video ID";
    }

    if (lightboxLabel) {
      lightboxLabel.textContent =
        "Replace the placeholder with a valid 11-character video ID.";
    }

    return;
  }

  lightboxReturnFocus = document.activeElement;

  pauseLightboxMedia();

  lightboxTitle.textContent = video.title;

  if (lightboxLabel) {
    lightboxLabel.textContent = video.description || "TOBIUNPHASED / FILM";
  }

  if (video.type === "youtube") {
    const iframe = document.createElement("iframe");

    iframe.src = embedUrl;
    iframe.title = video.title;
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.loading = "eager";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";

    iframe.style.display = "block";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.aspectRatio = "16 / 9";
    iframe.style.border = "0";

    lightboxPlayer.appendChild(iframe);
  } else if (video.type === "mp4") {
    // Kept as a fallback in case you intentionally use an MP4 later.
    const player = document.createElement("video");

    player.src = video.src;
    player.controls = true;
    player.autoplay = true;
    player.playsInline = true;

    if (video.poster) {
      player.poster = video.poster;
    }

    lightboxPlayer.appendChild(player);
  }

  // Support both class names in case the existing CSS uses either one.
  lightbox.classList.add("open", "active");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("lightbox-open");

  if (lightboxClose) {
    lightboxClose.focus();
  }
}

function closeLightbox() {
  if (!lightbox) return;

  pauseLightboxMedia();

  lightbox.classList.remove("open", "active");
  lightbox.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lightbox-open");

  if (
    lightboxReturnFocus &&
    typeof lightboxReturnFocus.focus === "function"
  ) {
    lightboxReturnFocus.focus();
  }

  lightboxReturnFocus = null;
}

if (lightboxClose) {
  lightboxClose.addEventListener("click", closeLightbox);
}

const lightboxBackdrop = $("[data-close-lightbox]", lightbox);

if (lightboxBackdrop) {
  lightboxBackdrop.addEventListener("click", event => {
    // Close only when the backdrop itself is clicked.
    if (event.target === lightboxBackdrop) {
      closeLightbox();
    }
  });
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (lightbox && lightbox.classList.contains("open")) {
      closeLightbox();
    } else if (mobileMenu && mobileMenu.classList.contains("open")) {
      closeMobileMenu();
    }
  }

  if (
    event.key === "Tab" &&
    lightbox &&
    lightbox.classList.contains("open")
  ) {
    const focusable = $$(
      "button, a, iframe, video",
      lightbox
    ).filter(element => !element.disabled);

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (
      event.shiftKey &&
      document.activeElement === first
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === last
    ) {
      event.preventDefault();
      first.focus();
    }
  }
});

// ---------- Mobile navigation ----------

function openMobileMenu() {
  if (!mobileMenu) return;

  mobileMenu.classList.add("open");
  mobileMenu.setAttribute("aria-hidden", "false");

  if (menuToggle) {
    menuToggle.setAttribute("aria-expanded", "true");
  }

  document.body.classList.add("menu-open");

  const firstLink = $("nav a", mobileMenu);

  if (firstLink) {
    firstLink.focus();
  }
}

function closeMobileMenu() {
  if (!mobileMenu || !mobileMenu.classList.contains("open")) return;

  mobileMenu.classList.remove("open");
  mobileMenu.setAttribute("aria-hidden", "true");

  if (menuToggle) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.focus();
  }

  document.body.classList.remove("menu-open");
}

if (menuToggle) {
  menuToggle.addEventListener("click", openMobileMenu);
}

if (menuClose) {
  menuClose.addEventListener("click", closeMobileMenu);
}

if (mobileMenu) {
  $$(".mobile-menu-links a", mobileMenu).forEach(link => {
    link.addEventListener("click", () => {
      mobileMenu.classList.remove("open");
      mobileMenu.setAttribute("aria-hidden", "true");

      if (menuToggle) {
        menuToggle.setAttribute("aria-expanded", "false");
      }

      document.body.classList.remove("menu-open");
    });
  });
}

// ---------- Discord copy button ----------

if (copyButton) {
  copyButton.addEventListener("click", async () => {
    let copied = false;

    try {
      await navigator.clipboard.writeText(DISCORD_USERNAME);
      copied = true;
    } catch {
      // Fallback for browsers without Clipboard API access.
      const input = document.createElement("textarea");

      input.value = DISCORD_USERNAME;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";

      document.body.append(input);
      input.select();

      copied = document.execCommand("copy");
      input.remove();
    }

    if (copyLabel) {
      copyLabel.textContent = copied ? "COPIED ✓" : "COPY ↗";
    }

    if (copyFeedback) {
      copyFeedback.textContent = copied
        ? "Username copied"
        : "Copy unavailable — tobiunphased";
    }

    window.setTimeout(() => {
      if (copyLabel) copyLabel.textContent = "COPY ↗";
      if (copyFeedback) copyFeedback.textContent = "";
    }, 2200);
  });
}

// ---------- Scroll effects ----------

function updateScrollEffects() {
  const scrollable =
    document.documentElement.scrollHeight - window.innerHeight;

  const progress =
    scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;

  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }

  if (header) {
    header.classList.toggle("scrolled", window.scrollY > 20);
  }
}

window.addEventListener("scroll", updateScrollEffects, {
  passive: true
});

updateScrollEffects();

// ---------- Reveal sections ----------

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  $$(".reveal").forEach(element => {
    revealObserver.observe(element);
  });
} else {
  $$(".reveal").forEach(element => {
    element.classList.add("visible");
  });
}

// ---------- Custom cursor ----------

if (cursorDot && window.matchMedia("(pointer: fine)").matches) {
  window.addEventListener(
    "mousemove",
    event => {
      cursorDot.style.opacity = "0.65";
      cursorDot.style.transform =
        `translate(${event.clientX - 2}px, ${event.clientY - 2}px)`;
    },
    { passive: true }
  );

  document.addEventListener("mouseleave", () => {
    cursorDot.style.opacity = "0";
  });
}

// ---------- Initialize ----------

if (!VIDEOS.length) {
  if (carousel) carousel.hidden = true;
} else if (
  carousel &&
  stage &&
  indicators &&
  currentCounter &&
  totalCounter &&
  prevButton &&
  nextButton
) {
  createIndicators();
  renderInitialSlides();
}

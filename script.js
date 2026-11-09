"use strict";

// =========================================================
// TOBI. — STUDIO PORTFOLIO
// Vanilla JavaScript. No framework, build step or storage.
// The four original YouTube IDs and titles are preserved.
// =========================================================

const VIDEOS = [
  {
    title: "Minecraft Cinematic",
    description: "Cinematic camera work and smooth movement.",
    src: "ZLHp3N7IjsI",
    type: "youtube"
  },
  {
    title: "Minecraft Film",
    description: "A film with still camera shots.",
    src: "Zaad-IAgaB8",
    type: "youtube"
  },
  {
    title: "Dolly Zooms",
    description: "Industry Grade zooms",
    src: "TP42mYGlMJk",
    type: "youtube"
  },
  {
    title: "GTA 5 Transition",
    description: "Recreation of the iconic GTA 5 maps transition.",
    src: "iy298Vb7NaE",
    type: "youtube"
  }
];

const DISCORD_USERNAME = "tobiunphased";
const TRANSITION_MS = 650;
const $ = (selector, root = document) => root?.querySelector(selector) ?? null;
const $$ = (selector, root = document) => root ? [...root.querySelectorAll(selector)] : [];

const header = $("#site-header");
const progressBar = $("#scroll-progress");
const cursorDot = $("#cursor-dot");
const announcement = $("#announcement");
const announcementClose = $("#announcement-close");
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
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(pointer: fine)");

let currentIndex = 0;
let isAnimating = false;
let animationTimer = null;
let lightboxReturnFocus = null;
let menuReturnFocus = null;
let touchStartX = 0;
let touchStartY = 0;
let dragStartX = 0;
let isDragging = false;
let hasDragged = false;
let pointerId = null;
let lastPointerX = 0;
let lastClickTime = 0;
let faqOpenButton = null;
let scrollTicking = false;

// ---------- General helpers ----------

function padNumber(number) {
  return String(number).padStart(2, "0");
}

function modulo(number, length) {
  return ((number % length) + length) % length;
}

function getYouTubeId(value) {
  if (!value || typeof value !== "string") return null;
  if (/^[\w-]{11}$/.test(value)) return value;

  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    let id = null;

    if (hostname === "youtu.be" || hostname.endsWith(".youtu.be")) {
      id = parsed.pathname.split("/").filter(Boolean)[0] || null;
    } else if (
      hostname.includes("youtube.com") ||
      hostname.includes("youtube-nocookie.com")
    ) {
      if (parsed.pathname === "/watch") {
        id = parsed.searchParams.get("v");
      } else {
        const match = parsed.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/);
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

  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    playsinline: "1",
    enablejsapi: "1"
  });

  if (
    window.location.protocol === "http:" ||
    window.location.protocol === "https:"
  ) {
    params.set("origin", window.location.origin);
  }

  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
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

function setBannerHeight() {
  const height = announcement && !announcement.classList.contains("is-dismissed")
    ? `${announcement.getBoundingClientRect().height}px`
    : "0px";
  document.documentElement.style.setProperty("--banner-height", height);
}

// ---------- Announcement banner ----------

if (announcementClose && announcement) {
  announcementClose.addEventListener("click", () => {
    announcement.classList.add("is-dismissed");
    announcement.setAttribute("aria-hidden", "true");
    announcementClose.disabled = true;
    document.documentElement.style.setProperty("--banner-height", "0px");
  });
}

setBannerHeight();
window.addEventListener("resize", setBannerHeight, { passive: true });

// ---------- Carousel slide construction ----------

function createSlide(offset) {
  const slide = document.createElement("article");
  slide.className = "carousel-slide";
  slide.dataset.offset = String(offset);

  slide.innerHTML = `
    <div class="video-card">
      <div class="video-visual">
        <div class="video-poster-fallback" aria-hidden="true"></div>
        <img class="video-poster" alt="" draggable="false" hidden loading="lazy">
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
    if (offsetValue !== 0) jumpTo(index);
  });

  const playButton = $(".play-button", slide);
  if (playButton) {
    playButton.addEventListener("click", event => {
      event.stopPropagation();
      if (Number(slide.dataset.offset) === 0 && !isAnimating && !hasDragged) {
        openLightbox(Number(slide.dataset.index));
      }
    });
  }

  return slide;
}

function updateSlideContent(slide, index) {
  const video = VIDEOS[index];
  if (!slide || !video) return;

  const poster = $(".video-poster", slide);
  const fallback = $(".video-poster-fallback", slide);
  slide.dataset.index = String(index);

  const posterNumber = $(".poster-number", slide);
  const videoNumber = $(".video-number", slide);
  const heading = $(".video-heading", slide);
  const description = $(".video-description", slide);
  const videoType = $(".video-type", slide);
  const playButton = $(".play-button", slide);

  if (posterNumber) posterNumber.textContent = `FILM / ${padNumber(index + 1)}`;
  if (videoNumber) videoNumber.textContent = `NO. ${padNumber(index + 1)}`;
  if (heading) heading.textContent = video.title;
  if (description) description.textContent = video.description || "";
  if (videoType) videoType.textContent = getVideoType(video);
  if (playButton) playButton.setAttribute("aria-label", `Play ${video.title}`);

  if (poster && fallback && video.poster) {
    poster.src = video.poster;
    poster.hidden = false;
    fallback.hidden = true;
    poster.onerror = () => {
      poster.hidden = true;
      fallback.hidden = false;
    };
  } else if (poster && fallback) {
    poster.removeAttribute("src");
    poster.hidden = true;
    fallback.hidden = false;
  }
}

function setSlidePosition(slide, offset, animate = true) {
  if (!slide) return;
  slide.dataset.offset = String(offset);
  slide.classList.remove("is-active", "is-prev", "is-next", "is-hidden");
  slide.style.transition = animate ? "" : "none";

  const playButton = $(".play-button", slide);
  if (offset === 0) {
    slide.classList.add("is-active");
    slide.setAttribute("aria-current", "true");
    slide.setAttribute("aria-label", "Current slide");
    slide.setAttribute("role", "group");
    slide.setAttribute("tabindex", "-1");
    if (playButton) playButton.disabled = false;
  } else if (offset === -1) {
    slide.classList.add("is-prev");
    slide.setAttribute("aria-current", "false");
    slide.setAttribute("aria-label", "Previous slide");
    slide.setAttribute("role", "button");
    slide.setAttribute("tabindex", "0");
    if (playButton) playButton.disabled = true;
  } else if (offset === 1) {
    slide.classList.add("is-next");
    slide.setAttribute("aria-current", "false");
    slide.setAttribute("aria-label", "Next slide");
    slide.setAttribute("role", "button");
    slide.setAttribute("tabindex", "0");
    if (playButton) playButton.disabled = true;
  } else {
    slide.classList.add("is-hidden");
    slide.setAttribute("aria-current", "false");
    slide.setAttribute("role", "group");
    slide.setAttribute("tabindex", "-1");
    if (playButton) playButton.disabled = true;
  }
}

function updateCounter() {
  if (currentCounter) currentCounter.textContent = padNumber(currentIndex + 1);
  if (totalCounter) totalCounter.textContent = padNumber(VIDEOS.length);

  $$(".carousel-dot", indicators).forEach((dot, index) => {
    dot.setAttribute("aria-current", String(index === currentIndex));
    dot.setAttribute("aria-label", `Go to slide ${index + 1}: ${VIDEOS[index].title}`);
  });
}

function createIndicators() {
  if (!indicators) return;
  indicators.replaceChildren();

  VIDEOS.forEach((video, index) => {
    const dot = document.createElement("button");
    dot.className = "carousel-dot";
    dot.type = "button";
    dot.setAttribute("aria-label", `Go to slide ${index + 1}: ${video.title}`);
    dot.setAttribute("aria-current", String(index === currentIndex));
    dot.addEventListener("click", () => jumpTo(index));
    indicators.append(dot);
  });
}

function renderInitialSlides() {
  if (!stage) return;
  stage.replaceChildren();

  [-1, 0, 1].forEach(offset => {
    const slide = createSlide(offset);
    const index = modulo(currentIndex + offset, VIDEOS.length);
    updateSlideContent(slide, index);
    setSlidePosition(slide, offset, false);
    stage.append(slide);
  });

  requestAnimationFrame(() => {
    $$(".carousel-slide", stage).forEach(slide => slide.style.removeProperty("transition"));
  });
  updateCounter();
}

// ---------- Carousel navigation ----------

function moveCarousel(direction) {
  if (VIDEOS.length < 2 || !stage || isAnimating) return;
  isAnimating = true;
  pauseLightboxMedia();

  const slides = $$(".carousel-slide", stage);
  slides.forEach(slide => {
    const oldOffset = Number(slide.dataset.offset);
    setSlidePosition(slide, oldOffset - direction, true);
  });

  currentIndex = modulo(currentIndex + direction, VIDEOS.length);
  updateCounter();

  const finishTransition = () => {
    window.clearTimeout(animationTimer);
    const recycled = slides.find(slide => Number(slide.dataset.offset) === -2 * direction);

    if (recycled) {
      const newOffset = direction;
      const newIndex = modulo(currentIndex + newOffset, VIDEOS.length);
      setSlidePosition(recycled, newOffset, false);
      updateSlideContent(recycled, newIndex);
      void recycled.offsetWidth;
      recycled.style.removeProperty("transition");
    }

    slides.forEach(slide => slide.style.removeProperty("transition"));
    isAnimating = false;
  };

  if (prefersReducedMotion.matches) {
    finishTransition();
  } else {
    animationTimer = window.setTimeout(finishTransition, TRANSITION_MS);
  }
}

function jumpTo(index) {
  if (isAnimating || !VIDEOS.length) return;
  const target = modulo(index, VIDEOS.length);
  if (target === currentIndex) return;

  const forward = modulo(target - currentIndex, VIDEOS.length);
  const backward = modulo(currentIndex - target, VIDEOS.length);
  const direction = forward <= backward ? 1 : -1;
  const steps = Math.min(forward, backward);
  let completed = 0;

  const step = () => {
    if (isAnimating) {
      window.setTimeout(step, prefersReducedMotion.matches ? 0 : TRANSITION_MS + 25);
      return;
    }
    if (completed >= steps || currentIndex === target) return;
    moveCarousel(direction);
    completed += 1;
    if (completed < steps) {
      window.setTimeout(step, prefersReducedMotion.matches ? 0 : TRANSITION_MS + 25);
    }
  };

  step();
}

if (prevButton) prevButton.addEventListener("click", () => moveCarousel(-1));
if (nextButton) nextButton.addEventListener("click", () => moveCarousel(1));

if (carousel) {
  carousel.addEventListener("keydown", event => {
    if (lightbox?.classList.contains("open")) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveCarousel(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveCarousel(1);
    }
  });
}

// ---------- Drag and swipe ----------

if (stage) {
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
      // Pointer capture is optional; pointer events still work without it.
    }
  });

  stage.addEventListener("pointermove", event => {
    if (!isDragging || event.pointerId !== pointerId) return;
    lastPointerX = event.clientX;
    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - touchStartY;
    if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) hasDragged = true;
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
    if (hasDragged) {
      lastClickTime = Date.now();
      window.setTimeout(() => { hasDragged = false; }, 100);
    }
  }

  stage.addEventListener("pointerup", finishPointer);
  stage.addEventListener("pointercancel", finishPointer);
  stage.addEventListener("lostpointercapture", () => {
    isDragging = false;
    stage.classList.remove("dragging");
  });

  stage.addEventListener("click", event => {
    if (Date.now() - lastClickTime < 140) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  stage.addEventListener("keydown", event => {
    const slide = event.target.closest(".carousel-slide");
    if (!slide || slide.classList.contains("is-active")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      jumpTo(Number(slide.dataset.index));
    }
  });
}

// ---------- Lightbox: iframe is created only after Play ----------

function pauseLightboxMedia() {
  if (!lightboxPlayer) return;
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
  if (!video || !lightbox || !lightboxPlayer) return;
  const embedUrl = getYouTubeEmbedUrl(video.src);

  if (video.type === "youtube" && !embedUrl) {
    if (lightboxTitle) lightboxTitle.textContent = "Check YouTube video ID";
    if (lightboxLabel) lightboxLabel.textContent = "A valid 11-character YouTube ID is required.";
    return;
  }

  lightboxReturnFocus = document.activeElement;
  pauseLightboxMedia();
  if (lightboxTitle) lightboxTitle.textContent = video.title;
  if (lightboxLabel) lightboxLabel.textContent = video.description || "TOBIUNPHASED / FILM";

  if (video.type === "youtube") {
    const iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.title = video.title;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.loading = "eager";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.style.cssText = "display:block;width:100%;height:100%;aspect-ratio:16/9;border:0";
    lightboxPlayer.append(iframe);
  } else if (video.type === "mp4") {
    const player = document.createElement("video");
    player.src = video.src;
    player.controls = true;
    player.autoplay = true;
    player.playsInline = true;
    if (video.poster) player.poster = video.poster;
    lightboxPlayer.append(player);
  }

  lightbox.classList.add("open", "active");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("lightbox-open");
  lightboxClose?.focus();
}

function closeLightbox() {
  if (!lightbox) return;
  pauseLightboxMedia();
  lightbox.classList.remove("open", "active");
  lightbox.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lightbox-open");
  if (lightboxReturnFocus && typeof lightboxReturnFocus.focus === "function") {
    lightboxReturnFocus.focus();
  }
  lightboxReturnFocus = null;
}

if (lightboxClose) lightboxClose.addEventListener("click", closeLightbox);
const lightboxBackdrop = $("[data-close-lightbox]", lightbox);
if (lightboxBackdrop) lightboxBackdrop.addEventListener("click", event => {
  if (event.target === lightboxBackdrop) closeLightbox();
});

function trapFocus(container, event) {
  const focusable = $$("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])", container)
    .filter(element => element.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
}

// ---------- Mobile navigation and focus management ----------

function openMobileMenu() {
  if (!mobileMenu || mobileMenu.classList.contains("open")) return;
  menuReturnFocus = document.activeElement;
  mobileMenu.classList.add("open");
  mobileMenu.setAttribute("aria-hidden", "false");
  menuToggle?.setAttribute("aria-expanded", "true");
  menuToggle?.setAttribute("aria-label", "Close menu");
  document.body.classList.add("menu-open");
  $(".mobile-menu-links a", mobileMenu)?.focus();
}

function closeMobileMenu(restoreFocus = true) {
  if (!mobileMenu || !mobileMenu.classList.contains("open")) return;
  mobileMenu.classList.remove("open");
  mobileMenu.setAttribute("aria-hidden", "true");
  menuToggle?.setAttribute("aria-expanded", "false");
  menuToggle?.setAttribute("aria-label", "Open menu");
  document.body.classList.remove("menu-open");

  if (restoreFocus) {
    const target = menuReturnFocus && typeof menuReturnFocus.focus === "function"
      ? menuReturnFocus
      : menuToggle;
    target?.focus();
  }
  menuReturnFocus = null;
}

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    if (mobileMenu?.classList.contains("open")) closeMobileMenu();
    else openMobileMenu();
  });
}
if (menuClose) menuClose.addEventListener("click", () => closeMobileMenu());

$$(".mobile-menu-links a", mobileMenu).forEach(link => {
  link.addEventListener("click", () => closeMobileMenu(false));
});

// ---------- FAQ: one open at a time, animated height, hidden when closed ----------

function closeFaq(button, panel) {
  if (!button || !panel || panel.hidden) return;
  button.setAttribute("aria-expanded", "false");
  panel.style.height = `${panel.scrollHeight}px`;

  if (prefersReducedMotion.matches) {
    panel.hidden = true;
    panel.style.height = "0px";
    return;
  }

  void panel.offsetHeight;
  panel.style.height = "0px";
}

function openFaq(button, panel) {
  if (!button || !panel) return;
  panel.hidden = false;
  button.setAttribute("aria-expanded", "true");
  panel.style.height = "0px";

  if (prefersReducedMotion.matches) {
    panel.style.height = "auto";
    return;
  }

  requestAnimationFrame(() => {
    panel.style.height = `${panel.scrollHeight}px`;
  });
}

$$ (".faq-question").forEach(button => {
  const panelId = button.getAttribute("aria-controls");
  const panel = panelId ? document.getElementById(panelId) : null;
  if (!panel) return;

  const expanded = button.getAttribute("aria-expanded") === "true";
  panel.hidden = !expanded;
  panel.style.overflow = "hidden";
  panel.style.height = expanded ? "auto" : "0px";
  panel.style.transition = prefersReducedMotion.matches ? "none" : "height 360ms ease";

  button.addEventListener("click", () => {
    const isOpen = button.getAttribute("aria-expanded") === "true";
    if (isOpen) {
      closeFaq(button, panel);
      faqOpenButton = null;
      return;
    }

    if (faqOpenButton && faqOpenButton !== button) {
      const previousPanelId = faqOpenButton.getAttribute("aria-controls");
      const previousPanel = previousPanelId ? document.getElementById(previousPanelId) : null;
      closeFaq(faqOpenButton, previousPanel);
    }

    openFaq(button, panel);
    faqOpenButton = button;
  });

  panel.addEventListener("transitionend", event => {
    if (event.propertyName !== "height") return;
    if (button.getAttribute("aria-expanded") === "true") {
      panel.style.height = "auto";
    } else {
      panel.hidden = true;
    }
  });

  if (expanded) faqOpenButton = button;
});

// ---------- Discord copy ----------

if (copyButton) {
  copyButton.addEventListener("click", async () => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(DISCORD_USERNAME);
        copied = true;
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      const input = document.createElement("textarea");
      input.value = DISCORD_USERNAME;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
      input.remove();
    }

    if (copyLabel) copyLabel.textContent = copied ? "COPIED ✓" : "COPY ↗";
    if (copyFeedback) {
      copyFeedback.textContent = copied ? "Username copied" : "Copy unavailable — tobiunphased";
    }

    window.setTimeout(() => {
      if (copyLabel) copyLabel.textContent = "COPY ↗";
      if (copyFeedback) copyFeedback.textContent = "";
    }, 2200);
  });
}

// ---------- Scroll progress and sticky header ----------

function updateScrollEffects() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  if (header) header.classList.toggle("scrolled", window.scrollY > 20);
  scrollTicking = false;
}

window.addEventListener("scroll", () => {
  if (!scrollTicking) {
    window.requestAnimationFrame(updateScrollEffects);
    scrollTicking = true;
  }
}, { passive: true });
window.addEventListener("resize", updateScrollEffects, { passive: true });
updateScrollEffects();

// ---------- Reveal-on-scroll with staggered card delays ----------

const staggerGroups = [".pillar-card", ".process-step", ".service-card", ".faq-item"];
staggerGroups.forEach(selector => {
  $$(selector).forEach((element, index) => {
    element.style.transitionDelay = `${Math.min(index, 5) * 90}ms`;
  });
});

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });

  $$(".reveal").forEach(element => revealObserver.observe(element));
} else {
  $$(".reveal").forEach(element => element.classList.add("visible"));
}

// ---------- Process connector progress ----------

const processGrid = $(".process-grid");
if (processGrid && "IntersectionObserver" in window) {
  const processObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      processGrid.classList.add("process-visible", "is-active");
      processObserver.unobserve(processGrid);
    });
  }, { threshold: 0.2 });
  processObserver.observe(processGrid);
} else if (processGrid) {
  processGrid.classList.add("process-visible", "is-active");
}

// ---------- Active navigation state ----------

const navLinks = $$(".nav-links a");
const observedSections = navLinks
  .map(link => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

if ("IntersectionObserver" in window && observedSections.length) {
  const activeSectionObserver = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;

    navLinks.forEach(link => {
      const active = link.getAttribute("href") === `#${visible.target.id}`;
      if (active) link.classList.add("active");
      else link.classList.remove("active");
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }, {
    rootMargin: "-25% 0px -60% 0px",
    threshold: [0, 0.1, 0.25, 0.5]
  });

  observedSections.forEach(section => activeSectionObserver.observe(section));
}

// ---------- Hero portrait parallax (desktop pointer only) ----------

const heroPortraitImage = $(".hero-portrait img");
if (heroPortraitImage && !prefersReducedMotion.matches && finePointer.matches) {
  let parallaxTicking = false;
  const updateParallax = () => {
    const bounds = heroPortraitImage.getBoundingClientRect();
    if (bounds.bottom > 0 && bounds.top < window.innerHeight) {
      const offset = Math.min(16, Math.max(-16, (bounds.top - window.innerHeight * 0.45) * -0.025));
      heroPortraitImage.style.transform = `translate3d(0, ${offset}px, 0) scale(1.025)`;
    }
    parallaxTicking = false;
  };
  window.addEventListener("scroll", () => {
    if (!parallaxTicking) {
      requestAnimationFrame(updateParallax);
      parallaxTicking = true;
    }
  }, { passive: true });
  updateParallax();
}

// ---------- Custom cursor dot ----------

if (cursorDot && finePointer.matches && !prefersReducedMotion.matches) {
  window.addEventListener("mousemove", event => {
    cursorDot.style.opacity = "0.65";
    cursorDot.style.transform = `translate(${event.clientX - 2}px, ${event.clientY - 2}px)`;
  }, { passive: true });

  document.addEventListener("mouseleave", () => {
    cursorDot.style.opacity = "0";
  });
}

// ---------- Global keyboard handling and focus traps ----------

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (lightbox?.classList.contains("open")) closeLightbox();
    else if (mobileMenu?.classList.contains("open")) closeMobileMenu();
  }

  if (event.key !== "Tab") return;
  if (mobileMenu?.classList.contains("open")) {
    trapFocus(mobileMenu, event);
  } else if (lightbox?.classList.contains("open")) {
    trapFocus(lightbox, event);
  }
});

// ---------- Button micro-interaction ----------

if (!prefersReducedMotion.matches && finePointer.matches) {
  $$(".button, .nav-cta").forEach(button => {
    button.addEventListener("pointermove", event => {
      const rect = button.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) * 0.025;
      const y = (event.clientY - rect.top - rect.height / 2) * 0.055;
      button.style.transform = `translate(${x}px, ${y}px)`;
    });
    button.addEventListener("pointerleave", () => button.style.removeProperty("transform"));
  });
}

// ---------- Initialize carousel ----------

if (!VIDEOS.length) {
  if (carousel) carousel.hidden = true;
} else if (
  carousel && stage && indicators && currentCounter && totalCounter && prevButton && nextButton
) {
  createIndicators();
  renderInitialSlides();
}

// Recalculate the banner offset after layout and fonts settle.
window.addEventListener("load", setBannerHeight, { once: true });

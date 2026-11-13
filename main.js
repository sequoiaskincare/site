// sequoia. Issue 01: magazine interactions
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = window.matchMedia("(hover: hover)").matches;
const isWide = () => window.innerWidth > 900;
const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);

// ---------- Loader ----------
(function loader() {
  const el = document.querySelector(".loader");
  const num = document.getElementById("loader-num");
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.classList.add("done");
    document.body.classList.remove("is-loading");
    document.body.classList.add("ready");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
  };
  if (reduceMotion || document.hidden) { finish(); return; }
  document.addEventListener("visibilitychange", () => { if (document.hidden) finish(); });
  requestAnimationFrame(() => el.classList.add("show"));
  const start = performance.now(), duration = 1400;
  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    num.textContent = String(Math.round((1 - Math.pow(1 - p, 3)) * 100)).padStart(2, "0");
    if (p < 1) requestAnimationFrame(tick); else finish();
  };
  requestAnimationFrame(tick);
})();

// ---------- Rotating cover ----------
// Each visit shows the next cover in this list; the 1/2/3 buttons switch by hand.
const COVERS = [
  { src: "photo-1728949202468-c37fdbd76856", pos: "40% 45%", alt: "Young man relaxing with a face mask on" },          // Victor Meza
  { src: "photo-1581182800629-7d90925ad072", pos: "50% 30%", alt: "Portrait of a woman with fresh, bare skin" },     // Fleur Kaan
  { src: "photo-1600603406200-5b2a104684ac", pos: "50% 20%", alt: "Young man smiling in soft natural light" },       // Vicky Hladynets
];
(function rotatingCover() {
  const base = document.querySelector(".cover-img:not(.cover-img-next)");
  const next = document.querySelector(".cover-img-next");
  const buttons = [...document.querySelectorAll(".cover-switch button[data-cover]")];
  const switcher = document.querySelector(".cover-switch");
  const pauseBtn = document.querySelector(".cover-pause");
  const coverEl = document.querySelector(".cover");
  const url = (c) => `https://images.unsplash.com/${c.src}?w=1600&q=80&auto=format&fit=crop`;
  let current = -1;

  const mark = (i) => buttons.forEach((b, j) => b.setAttribute("aria-pressed", String(i === j)));
  const show = (i, animate) => {
    if (i === current) return;
    const c = COVERS[i];
    current = i; mark(i);
    if (!animate) { base.src = url(c); base.style.objectPosition = c.pos; base.alt = c.alt; return; }
    next.style.objectPosition = c.pos;
    next.onload = () => {
      next.classList.add("show");
      next.addEventListener("transitionend", () => {
        base.src = next.src; base.style.objectPosition = c.pos; base.alt = c.alt;
        next.classList.remove("show");
      }, { once: true });
    };
    next.src = url(c);
  };

  // Pick this visit's cover: rotate through the list, or choose at random if storage is blocked.
  let start = Math.floor(Math.random() * COVERS.length);
  try {
    const seen = parseInt(localStorage.getItem("sequoia-cover") ?? "-1", 10);
    start = (seen + 1) % COVERS.length;
    localStorage.setItem("sequoia-cover", String(start));
  } catch (e) { /* storage unavailable: keep the random pick */ }
  show(start, false);

  // Preload the other covers so each flip is instant.
  COVERS.forEach((c) => { const im = new Image(); im.src = url(c); });

  // ---- Auto-flip every few seconds ----
  const INTERVAL = 5000; // milliseconds between flips
  let elapsed = 0, last = performance.now();
  let userPaused = reduceMotion, hovering = false, offscreen = false;
  const running = () => document.body.classList.contains("ready") && !userPaused && !hovering && !offscreen && !document.hidden;

  const setPaused = (p) => {
    userPaused = p;
    pauseBtn.setAttribute("aria-pressed", String(p));
    pauseBtn.setAttribute("aria-label", p ? "Play cover rotation" : "Pause cover rotation");
  };
  setPaused(userPaused);

  const loop = (now) => {
    const dt = now - last; last = now;
    switcher.classList.toggle("playing", running());
    if (running()) {
      elapsed += dt;
      if (elapsed >= INTERVAL) { elapsed = 0; show((current + 1) % COVERS.length, true); }
    }
    switcher.style.setProperty("--t", (elapsed / INTERVAL).toFixed(3));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  buttons.forEach((b) => b.addEventListener("click", () => { elapsed = 0; show(parseInt(b.dataset.cover, 10), !reduceMotion); }));
  pauseBtn.addEventListener("click", () => setPaused(!userPaused));
  const card = document.querySelector(".cover-card");
  card.addEventListener("mouseenter", () => { hovering = true; });
  card.addEventListener("mouseleave", () => { hovering = false; });
  new IntersectionObserver(([e]) => { offscreen = e.intersectionRatio < 0.5; }, { threshold: [0, 0.5, 1] }).observe(coverEl);
})();

// ---------- Elements ----------
const nav = document.querySelector(".nav");
const progressBar = document.querySelector(".progress span");
const pageNum = document.getElementById("page-num");
const cover = document.querySelector(".cover");
const coverCard = document.querySelector(".cover-card");
const pages = [...document.querySelectorAll(".page")];
const tracked = [...document.querySelectorAll("[data-page]")];
const shelf = document.querySelector(".shelf-section");
const shelfIntro = document.querySelector(".shelf-intro");
const shelfTrack = document.querySelector(".shelf-track");
const products = [...document.querySelectorAll(".product")];
const parallaxEls = [...document.querySelectorAll("[data-parallax]")];

// ---------- Shelf height: long enough to scroll the whole track sideways ----------
let shelfDistance = 0;
function sizeShelf() {
  if (!isWide()) { shelf.style.height = ""; shelfDistance = 0; return; }
  shelfDistance = Math.max(0, shelfTrack.scrollWidth - window.innerWidth);
  shelf.style.height = `${shelfDistance + window.innerHeight}px`;
}

// ---------- One scroll loop for everything ----------
let lastY = window.scrollY, ticking = false;
function onScroll() {
  const y = window.scrollY, vh = window.innerHeight, vw = window.innerWidth;

  // Reading progress bar
  const max = document.documentElement.scrollHeight - vh;
  progressBar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

  // Nav: transparent on the cover, solid after; hides when scrolling down
  nav.classList.toggle("solid", y > (cover.offsetHeight - vh) * 0.35);
  nav.classList.toggle("hide", y > lastY && y > vh);
  lastY = y;

  // Cover closes like a magazine as you scroll
  const cp = clamp(y / (cover.offsetHeight - vh));
  coverCard.style.setProperty("--p", reduceMotion ? 0 : cp.toFixed(3));

  // Pages tilt up into place as they enter, like turning a page
  if (!reduceMotion) for (const pg of pages) {
    const r = pg.getBoundingClientRect();
    pg.style.setProperty("--e", clamp((vh - r.top) / (vh * 0.7)).toFixed(3));
  }

  // Page number in the nav
  for (const s of tracked) {
    const r = s.getBoundingClientRect();
    if (r.top <= vh * 0.4 && r.bottom > vh * 0.4) { pageNum.textContent = s.dataset.page; break; }
  }

  // World shelf: vertical scroll moves the track sideways; cards turn as they pass
  if (shelfDistance > 0) {
    const r = shelf.getBoundingClientRect();
    const p = clamp(-r.top / (shelf.offsetHeight - vh));
    const x = -p * shelfDistance;
    shelfTrack.style.transform = `translate3d(${x}px,0,0)`;
    if (!reduceMotion) for (const pr of products) {
      const b = pr.getBoundingClientRect();
      const off = (b.left + b.width / 2 - vw / 2) / vw;
      pr.style.setProperty("--ry", `${(clamp(off, -1, 1) * -28).toFixed(2)}deg`);
    }
  }

  // Parallax layers
  if (!reduceMotion) for (const el of parallaxEls) {
    const r = el.getBoundingClientRect();
    if (r.bottom < -200 || r.top > vh + 200) continue;
    const d = (r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.parallax);
    el.style.translate = `0 ${d.toFixed(1)}px`;
  }
  ticking = false;
}
window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
window.addEventListener("resize", () => { sizeShelf(); onScroll(); });
window.addEventListener("load", () => { sizeShelf(); onScroll(); });
sizeShelf(); onScroll();

// ---------- Reveal on scroll ----------
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 90}ms`; io.observe(el); });

// ---------- Editor's letter: words light up as you read ----------
(function words() {
  const el = document.querySelector(".reveal-words");
  if (!el) return;
  for (const child of [...el.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach((part) => {
        if (!part.trim()) { frag.append(part); return; }
        const s = document.createElement("span"); s.className = "w"; s.textContent = part; frag.append(s);
      });
      child.replaceWith(frag);
    } else if (child.nodeType === Node.ELEMENT_NODE) child.classList.add("w");
  }
  const ws = [...el.querySelectorAll(".w")];
  const update = () => {
    const r = el.getBoundingClientRect(), vh = window.innerHeight;
    const n = Math.round(clamp((vh * 0.85 - r.top) / (r.height + vh * 0.3)) * ws.length);
    ws.forEach((w, i) => w.classList.toggle("lit", i < n));
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
})();

// ---------- 3D tilt (cards, cover, notes) ----------
if (canHover && !reduceMotion) {
  document.querySelectorAll("[data-tilt]").forEach((el) => {
    const max = parseFloat(el.dataset.tilt);
    const isCover = el.classList.contains("cover-card");
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      const tx = (px - 0.5) * max * 2, ty = (0.5 - py) * max * 2;
      if (isCover) {
        el.style.setProperty("--ry", `${(tx * 0.5).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(ty * 0.5).toFixed(2)}deg`);
      } else {
        el.style.setProperty("--tx", `${tx.toFixed(2)}deg`);
        el.style.setProperty("--ty", `${ty.toFixed(2)}deg`);
        el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
        el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
      }
    });
    el.addEventListener("mouseleave", () => {
      ["--tx", "--ty", "--rx", "--ry"].forEach((v) => { if (!(v === "--ry" && el.classList.contains("product"))) el.style.setProperty(v, "0deg"); });
    });
  });
}

// ---------- Texture collage: layers drift with the mouse ----------
(function collage() {
  const box = document.querySelector(".texture");
  if (!box || !canHover || reduceMotion) return;
  const layers = [...box.querySelectorAll("[data-depth]")];
  box.addEventListener("mousemove", (e) => {
    const r = box.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width - 0.5, my = (e.clientY - r.top) / r.height - 0.5;
    layers.forEach((l) => {
      const d = parseFloat(l.dataset.depth) * 30;
      l.style.transform = `translate3d(${(-mx * d).toFixed(1)}px, ${(-my * d).toFixed(1)}px, 0) rotate(${(mx * d * 0.08).toFixed(2)}deg)`;
    });
  });
  box.addEventListener("mouseleave", () => layers.forEach((l) => (l.style.transform = "")));
})();

// ---------- Contents: photo preview follows the cursor ----------
(function toc() {
  const img = document.querySelector(".toc-preview");
  if (!img || !canHover) return;
  document.querySelectorAll(".toc a").forEach((a) => {
    a.addEventListener("mouseenter", () => { img.src = a.dataset.preview; img.classList.add("on"); });
    a.addEventListener("mouseleave", () => img.classList.remove("on"));
    a.addEventListener("mousemove", (e) => { img.style.left = `${e.clientX + 160}px`; img.style.top = `${e.clientY}px`; });
  });
})();

// ---------- Method: flip cards on tap/click ----------
document.querySelectorAll(".flip").forEach((f) => {
  f.addEventListener("click", () => f.setAttribute("aria-pressed", String(f.getAttribute("aria-pressed") !== "true")));
});

// ---------- Custom cursor ----------
(function cursor() {
  if (!canHover || reduceMotion) return;
  const c = document.querySelector(".cursor"), label = c.querySelector(".cursor-label");
  window.addEventListener("mousemove", (e) => { c.classList.add("on"); c.style.left = `${e.clientX}px`; c.style.top = `${e.clientY}px`; });
  const withLabel = (sel, text) => document.querySelectorAll(sel).forEach((el) => {
    el.addEventListener("mouseenter", () => { label.textContent = text; c.classList.add("label"); });
    el.addEventListener("mouseleave", () => c.classList.remove("label"));
  });
  withLabel(".product", "Turn");
  withLabel(".flip", "Flip");
  withLabel(".toc a", "Read");
  document.querySelectorAll("a:not(.toc a), button:not(.flip), .chips label").forEach((el) => {
    el.addEventListener("mouseenter", () => c.classList.add("big"));
    el.addEventListener("mouseleave", () => c.classList.remove("big"));
  });
})();

// ---------- Waitlist form ----------
// Signups go to the "sequoia. waitlist" Google Sheet (try.sequoia@gmail.com) through a
// Google Apps Script web app. Paste its URL (ends in /exec) below. While it's empty,
// the form only shows the thank-you message and saves nothing.
const WAITLIST_ENDPOINT = "https://script.google.com/macros/s/AKfycbwM7n81qOnZ90XYs_i-fD-NcCuAm-uRxCKx1vyGoBQ4MchuST_PHHFfNx6Xlw6JL-Fq8A/exec";
const form = document.getElementById("waitlist-form");
const thanks = document.getElementById("waitlist-thanks");
const errorBox = form.querySelector(".form-error");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = form.elements.email;
  const emailOk = email.checkValidity();
  email.setAttribute("aria-invalid", emailOk ? "false" : "true");
  let ok = emailOk;
  for (const name of ["skin_type", "concern", "age"]) {
    const picked = form.querySelector(`input[name="${name}"]:checked`);
    form.querySelector(`input[name="${name}"]`).closest(".field").classList.toggle("invalid", !picked);
    if (!picked) ok = false;
  }
  if (!ok) {
    errorBox.textContent = "Please add a valid email and pick one option for each question.";
    errorBox.hidden = false;
    return;
  }
  errorBox.hidden = true;
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "Joining...";
  try {
    if (WAITLIST_ENDPOINT) {
      // Sent as a plain form post (URL-encoded) so Google Apps Script can read it without extra setup.
      const data = new URLSearchParams(new FormData(form));
      data.set("source", location.hostname || "local");
      const response = await fetch(WAITLIST_ENDPOINT, { method: "POST", body: data });
      const result = await response.json().catch(() => ({ ok: response.ok }));
      if (!response.ok || !result.ok) throw new Error(result.error || "Signup failed");
    }
    form.hidden = true;
    thanks.hidden = false;
  } catch (err) {
    errorBox.textContent = "Something went wrong. Please try again in a moment.";
    errorBox.hidden = false;
    button.disabled = false;
    button.innerHTML = 'Get early access <span class="arrow">&rarr;</span>';
  }
});
form.addEventListener("change", (e) => {
  const field = e.target.closest(".field");
  if (field) field.classList.remove("invalid");
  if (e.target.name === "email" && e.target.checkValidity()) e.target.setAttribute("aria-invalid", "false");
});

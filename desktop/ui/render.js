(() => {
  'use strict';

  let frameRequest = 0, presentUntil = 0;
  const frameListeners = new Set();
  function presentFor(ms = 0) {
    presentUntil = Math.max(presentUntil, performance.now() + ms);
    if (frameRequest) return;
    frameRequest = requestAnimationFrame(function present(now) {
      // Keep the pending marker during callbacks: reentrant requests extend this
      // loop instead of starting another one. Chromium presents its own frames.
      try { for (const listener of frameListeners) listener(); }
      finally { frameRequest = 0; }
      if (now < presentUntil) frameRequest = requestAnimationFrame(present);
    });
  }
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

  // The bubble's white body is a drawn SVG path, but its content lives in a
  // fixed-percentage box that is deliberately allowed to overflow. Tall scenes
  // (two stacked quota cards, six-row custom bubbles) can outgrow the shape, so
  // scale the committed frame until its content sits inside the drawn path.
  // Testing the real path keeps this independent of which shape is selected and
  // mirrors the audit assertion in tests/audit-ui-regression.mjs.
  const FIT_INSET_U = 15; // stroke half-width 9u plus breathing room
  const FIT_STEPS = 7;
  // 下限曾经设成 0.78 以打断「缩小→换行更多→更高→缩更多」的正反馈，
  // 但那会让内容直接溢出气泡、把上下行切掉，比缩小更难看。
  // 真正的解法是加大内容盒的宽度减少换行，不是给缩放兜底。
  // 留一个很高很保守的下限，只防住极端退化，不参与正常布局。
  const FIT_FLOOR = 0.5;

  function contentRect(frame) {
    let box = null;
    for (const child of frame.children) {
      const rect = child.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      box = box
        ? { left: Math.min(box.left, rect.left), top: Math.min(box.top, rect.top), right: Math.max(box.right, rect.right), bottom: Math.max(box.bottom, rect.bottom) }
        : { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    }
    return box;
  }

  // Returns the largest scale in (0,1] that keeps the content inside the path.
  function fitScaleForRect(path, inverse, box, half, inset) {
    const probes = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]];
    const fits = scale => probes.every(([sx, sy]) => {
      const x = (box.left + box.right) / 2 + sx * half.width * scale;
      const y = (box.top + box.bottom) / 2 + sy * half.height * scale;
      return path.isPointInFill(new DOMPoint(x, y).matrixTransform(inverse));
    });
    if (fits(1)) return 1;
    if (!fits(FIT_FLOOR)) return FIT_FLOOR;
    let low = FIT_FLOOR, high = 1;
    for (let step = 0; step < FIT_STEPS; step++) {
      const mid = (low + high) / 2;
      if (fits(mid)) low = mid; else high = mid;
    }
    return low;
  }

  function fitFrameToBubble(frame) {
    const pop = frame.closest('.dshwv-pop');
    const path = pop && pop.querySelector('.dshwv-bshape');
    if (!frame.isConnected || !path || typeof path.isPointInFill !== 'function') return 1;
    // getBoundingClientRect reports transformed geometry, so a scale left by the
    // previous scene would shrink this measurement and compound the error.
    frame.style.removeProperty('--dshw-fit');
    const matrix = path.getScreenCTM();
    if (!matrix) return 1;
    // --dshw-u is declared as an unresolved calc(), so getPropertyValue returns
    // a token stream rather than a length. The pop box is exactly 1026 user
    // units wide (its aspect-ratio matches the viewBox), which resolves it.
    const popWidth = pop.getBoundingClientRect().width;
    const unit = popWidth / 1026;
    if (!(unit > 0)) return 1;
    const box = contentRect(frame);
    if (!box) return 1;
    const half = { width: (box.right - box.left) / 2, height: (box.bottom - box.top) / 2 };
    const inset = FIT_INSET_U * unit;
    if (half.width <= inset || half.height <= inset) return 1;
    const scale = fitScaleForRect(path, matrix.inverse(), box, half, inset);
    frame.style.setProperty('--dshw-fit', String(scale));
    observeContent(frame);
    return scale;
  }

  // A ticking countdown or a late quota repaint can resize committed content.
  // Transform never changes layout size, so re-fitting cannot feed itself.
  const fitObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
    for (const entry of entries) fitFrameToBubble(entry.target.parentElement);
  }) : null;
  const observedContent = new WeakSet();
  function observeContent(frame) {
    if (!fitObserver) return;
    for (const child of frame.children) {
      if (observedContent.has(child)) continue;
      observedContent.add(child);
      fitObserver.observe(child);
    }
  }

  // Alpha is only consulted for input. Chromium owns visual alpha/compositing.
  class AlphaHitCache {
    constructor() {
      this.entries = new Map();
      this.jobs = new Map();
      this.serial = 0;
      this.bytes = 0;
      this.stats = { decodes: 0, hits: 0, failures: 0 };
      this.worker = new Worker('/alpha-worker.js');
      this.worker.onmessage = ({ data }) => {
        const job = this.jobs.get(data.id);
        if (!job) return;
        this.jobs.delete(data.id);
        clearTimeout(job.timer);
        const mask = data.alpha ? { width: data.width, height: data.height, alpha: new Uint8Array(data.alpha) } : null;
        job.entry.mask = mask;
        job.entry.done = true;
        if (mask) { this.bytes += mask.alpha.byteLength; this.stats.decodes++; }
        else this.stats.failures++;
        job.resolve(mask);
        this.trim();
        presentFor();
      };
      this.worker.onerror = () => {
        for (const job of this.jobs.values()) {
          clearTimeout(job.timer); job.entry.done = true; job.resolve(null);
        }
        this.stats.failures += this.jobs.size;
        this.jobs.clear();
      };
    }
    key(src) { return new URL(src, location.href).href; }
    prepare(src) {
      const key = this.key(src);
      let entry = this.entries.get(key);
      if (entry) {
        this.entries.delete(key); this.entries.set(key, entry);
        return entry.promise;
      }
      entry = { done: false, mask: null };
      entry.promise = new Promise(resolve => {
        const id = ++this.serial;
        const timer = setTimeout(() => {
          if (!this.jobs.delete(id)) return;
          entry.done = true; this.stats.failures++; resolve(null);
        }, 12000);
        this.jobs.set(id, { entry, resolve, timer });
        this.worker.postMessage({ id, src: key });
      });
      this.entries.set(key, entry);
      this.trim();
      return entry.promise;
    }
    trim() {
      for (const [key, entry] of this.entries) {
        if (this.entries.size <= 8 && this.bytes <= 8 * 1024 * 1024) break;
        if (!entry.done) continue;
        this.bytes -= entry.mask?.alpha.byteLength || 0;
        this.entries.delete(key);
      }
    }
    hit(img, x, y, flipped = false) {
      if (!img?.complete || !img.naturalWidth) return false;
      const r = img.getBoundingClientRect();
      if (r.width < 0.5 || r.height < 0.5 || x < r.left || y < r.top || x >= r.right || y >= r.bottom) return false;
      const entry = this.entries.get(this.key(img.currentSrc || img.src));
      if (!entry) { this.prepare(img.currentSrc || img.src); return false; }
      if (!entry.done) return false;
      // Decode failure retains a clickable image rectangle, never a visual clip.
      if (!entry.mask) return true;
      const { width, height, alpha } = entry.mask;
      const u = (x - r.left) / r.width;
      const px = Math.min(width - 1, Math.floor((flipped ? 1 - u : u) * width));
      const py = Math.min(height - 1, Math.floor((y - r.top) / r.height * height));
      this.stats.hits++;
      return alpha[py * width + px] > 10;
    }
  }

  class BubbleRenderer {
    constructor(container, gifUrl) {
      this.container = container;
      this.epoch = 0;
      this.switching = false;
      this.hasFrame = false;
      this.animations = [];
      this.layers = [0, 1].map(index => {
        const root = document.createElement('div');
        root.className = 'dshwv-frame';
        root.dataset.buffer = String(index);
        root.style.opacity = '0';
        root.inert = true;
        root.setAttribute('aria-hidden', 'true');
        const parts = { root };
        for (const kind of ['label', 'amount', 'hint']) {
          const el = document.createElement('div');
          el.className = 'dshwv-' + kind;
          parts[kind] = el; root.appendChild(el);
        }
        parts.gif = document.createElement('img');
        parts.gif.className = 'dshwv-gif'; parts.gif.alt = '';
        parts.gif.draggable = false; parts.gif.src = gifUrl;
        parts.gif.style.display = 'none'; root.appendChild(parts.gif);
        container.appendChild(root);
        return parts;
      });
      [this.front, this.back] = this.layers;
    }
    cancel() {
      ++this.epoch;
      this.switching = false;
      for (const animation of this.animations) animation.cancel();
      this.animations.length = 0;
      this.front.root.style.opacity = this.hasFrame ? '1' : '0';
      this.back.root.style.opacity = '0';
      this.front.root.inert = !this.hasFrame;
      this.back.root.inert = true;
      this.front.root.setAttribute('aria-hidden', String(!this.hasFrame));
      this.back.root.setAttribute('aria-hidden', 'true');
    }
    reset(parts) {
      // Only the hidden buffer is edited. The four legacy nodes are reused.
      window.WhaleMoney?.clearBindings(parts.root);
      parts.root.style.removeProperty('--dshw-fit');
      for (const child of [...parts.root.children]) {
        if (![parts.label, parts.amount, parts.hint, parts.gif].includes(child)) child.remove();
      }
      for (const kind of ['label', 'amount', 'hint']) {
        const el = parts[kind];
        el.className = 'dshwv-' + kind; el.removeAttribute('style');
        el.textContent = ''; el.removeAttribute('title');
      }
      parts.gif.style.display = 'none';
    }
    async ready(parts) {
      const images = [...parts.root.querySelectorAll('img')].filter(img => img.style.display !== 'none');
      const ready = Promise.all([document.fonts.ready, ...images.map(img => img.decode())]);
      let timer;
      try {
        await Promise.race([ready, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Bubble assets not ready')), 4000); })]);
      } finally { clearTimeout(timer); }
      // Layout and paint opportunity for the complete back buffer, before fade.
      await nextFrame(); await nextFrame();
    }
    async open(build, onReady) {
      this.cancel();
      const epoch = this.epoch;
      const incoming = this.back, outgoing = this.front;
      this.switching = true;
      try {
        this.reset(incoming);
        build(incoming);
        await this.ready(incoming);
        if (epoch !== this.epoch) return false;
        // Layout is settled and the frame is still transparent: measure and fit
        // here so the fade never reveals content outside the bubble shape.
        fitFrameToBubble(incoming.root);
        onReady?.();
        const fade = this.hasFrame;
        outgoing.root.inert = true;
        if (fade) {
          this.animations = [
            outgoing.root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease', fill: 'forwards' }),
            incoming.root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease', fill: 'forwards' }),
          ];
          presentFor(220);
          await Promise.all(this.animations.map(animation => animation.finished));
          if (epoch !== this.epoch) return false;
        }
        incoming.root.style.opacity = '1'; outgoing.root.style.opacity = '0';
        for (const animation of this.animations) animation.cancel();
        this.animations.length = 0;
        this.front = incoming; this.back = outgoing; this.hasFrame = true;
        incoming.root.inert = false; outgoing.root.inert = true;
        incoming.root.setAttribute('aria-hidden', 'false'); outgoing.root.setAttribute('aria-hidden', 'true');
        this.switching = false;
        presentFor();
        return true;
      } catch (error) {
        if (epoch === this.epoch) {
          this.cancel();
          // A failed decode keeps the last complete frame instead of blanking it.
          this.container.dispatchEvent(new CustomEvent('whale-frame-error', { detail: { message: error.message } }));
        }
        return false;
      }
    }
    close() {
      this.cancel();
      this.front.root.inert = true;
      // Retain the outgoing pixels for the bubble's closing opacity animation.
      presentFor(320);
    }
  }

  const hitCache = new AlphaHitCache();
  function mirrorScale(root) {
    const transform = getComputedStyle(root).transform;
    return transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a;
  }
  // Switching the bubble shape changes the path the content must fit inside,
  // so the visible frame has to be measured again.
  function refitBubble() {
    for (const frame of document.querySelectorAll('.dshwv-frame')) fitFrameToBubble(frame);
  }
  window.WhaleRendering = Object.freeze({ BubbleRenderer, hitCache, mirrorScale, presentFor, refitBubble, fitFrameToBubble, onFrame: listener => { frameListeners.add(listener); return () => frameListeners.delete(listener); } });
})();

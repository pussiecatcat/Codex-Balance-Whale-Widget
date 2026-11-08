const CLICK_WINDOW_MS = 60_000;
const BOWL_LIFETIME_MS = 60_000;
const PLAYBACK_MS = 3750; // The movie ends on the satisfied expression.
const GUTTER = 8;
const PARKING_KEY = 'dshw-feed-pos';
const BASIN_ASPECT = 112 / 100;
const CONTACT_SAMPLES = [.08, .29, .5, .71, .92];
// The transparent bowl is cut from this rectangle of the first movie frame.
const FRAME = {
  width: 360, height: 480,
  // Measure from the maid headband to the body edge, excluding the moving tuft.
  headbandTop: 134, bodyBottom: 469,
  bowl: { x: 0, y: 380, width: 112, height: 100 },
};
const IDLE_HEADBAND_TOP = .12;

export function createFeeding({ document, window, image, imageUrl, root, scope, rendering, uiState }) {
  const bowl = document.createElement('button');
  bowl.type = 'button';
  bowl.className = 'dshwv-feed-bowl';
  bowl.setAttribute('aria-label', '把米饭拖给小鲸鱼，或按回车喂饭');
  bowl.hidden = true;
  const bowlArt = document.createElement('img');
  bowlArt.src = '/assets/feeding-steel-basin.png';
  bowlArt.alt = '';
  bowlArt.draggable = false;
  const emptySteel = document.createElement('img');
  emptySteel.src = '/assets/feeding-steel-empty.png';
  emptySteel.alt = '';
  emptySteel.hidden = true;
  bowl.append(bowlArt, emptySteel);
  const riceClump = document.createElement('img');
  riceClump.className = 'dshwv-feed-rice-clump';
  riceClump.src = '/assets/feeding-rice-clump.png';
  riceClump.alt = '';
  riceClump.hidden = true;
  const filledBowl = document.createElement('div');
  filledBowl.className = 'dshwv-feed-filled-bowl';
  filledBowl.hidden = true;
  const filledArt = document.createElement('img');
  filledArt.src = '/assets/feeding-bowl.png';
  filledArt.alt = '';
  const glow = document.createElement('span');
  glow.className = 'dshwv-feed-glow';
  glow.setAttribute('aria-hidden', 'true');
  filledBowl.append(glow, filledArt);
  const cue = document.createElement('div');
  cue.className = 'dshwv-feed-cue';
  cue.setAttribute('aria-hidden', 'true');
  cue.hidden = true;
  const readyFace = document.createElement('img');
  readyFace.alt = '';
  readyFace.src = '/assets/feeding-ready.webp';
  cue.append(readyFace);
  const emptyBowl = document.createElement('img');
  emptyBowl.className = 'dshwv-feed-empty-bowl';
  emptyBowl.alt = '';
  emptyBowl.src = '/assets/feeding-empty-bowl.png';
  emptyBowl.hidden = true;
  document.body.append(cue, emptyBowl, filledBowl, bowl, riceClump);

  let clicks = [], drag = null, home = null, movie = null, preparedMovie = null, restore = false;
  let timer, prelude;
  let sequence = 0;
  const defaultRole = () => image.getAttribute('src') === imageUrl;
  const flipped = () => rendering.mirrorScale(root) < 0;

  function place(element, x, y) {
    element.style.setProperty('--feed-x', x + 'px');
    element.style.setProperty('--feed-y', y + 'px');
  }

  function hideDropHint() {
    cue.hidden = true;
    emptyBowl.hidden = true;
    image.classList.remove('dshwv-feed-awaiting');
    delete bowl.dataset.dropReady;
  }

  function contactArea(point, rect, top = rect.top) {
    const left = Math.max(point.x + point.width * .02, rect.left);
    const right = Math.min(point.x + point.width * .98, rect.right);
    const y = Math.max(point.y + point.height * .2, top);
    const bottom = Math.min(point.y + point.height * .95, rect.bottom);
    if (right - left < 3 || bottom - y < 3) return null;
    return { x: left, y, width: right - left, height: bottom - y };
  }

  function dropPoint(event) {
    const point = {
      x: event.clientX - drag.x, y: event.clientY - drag.y,
      width: drag.width, height: drag.height,
    };
    if (!emptyBowl.hidden) {
      const dock = emptyBowl.getBoundingClientRect();
      if (contactArea(point, dock, dock.top + dock.height * .3)) return { ...point, ready: true };
    }
    const contact = contactArea(point, image.getBoundingClientRect());
    const mirror = flipped();
    const ready = !!contact && CONTACT_SAMPLES.some(u => CONTACT_SAMPLES.some(v =>
      rendering.hitCache.hit(image, contact.x + u * contact.width, contact.y + v * contact.height, mirror)));
    return { ...point, ready };
  }

  function parkingRange(width, height) {
    return {
      x: Math.max(0, window.innerWidth - width - 2 * GUTTER),
      y: Math.max(0, window.innerHeight - height - 2 * GUTTER),
    };
  }

  function rememberParking(range) {
    uiState.set(PARKING_KEY, JSON.stringify({
      x: range.x ? (home.x - GUTTER) / range.x : 0,
      y: range.y ? (home.y - GUTTER) / range.y : 0,
    }));
  }

  function parkBasin(point) {
    const range = parkingRange(point.width, point.height);
    home = {
      x: Math.max(GUTTER, Math.min(point.x, GUTTER + range.x)),
      y: Math.max(GUTTER, Math.min(point.y, GUTTER + range.y)),
    };
    rememberParking(range);
    window.clearTimeout(timer);
    returnBowl();
  }

  function updateDropHint({ ready }) {
    const rect = image.getBoundingClientRect();
    const mirror = flipped();
    const showFace = ready && readyFace.complete && readyFace.naturalWidth > 0;
    const { target } = feedingPlacement(rect, mirror);
    place(emptyBowl, target.x, target.y);
    emptyBowl.style.setProperty('--feed-width', target.width + 'px');
    emptyBowl.style.setProperty('--feed-height', target.height + 'px');
    emptyBowl.classList.toggle('dshwv-feed-mirrored', mirror);
    emptyBowl.hidden = false;
    place(cue, rect.left, rect.top);
    cue.style.setProperty('--feed-width', rect.width + 'px');
    cue.style.setProperty('--feed-height', rect.height + 'px');
    cue.dataset.state = ready ? 'ready' : 'aim';
    cue.toggleAttribute('data-flipped', mirror);
    cue.toggleAttribute('data-face', showFace);
    image.classList.toggle('dshwv-feed-awaiting', showFace);
    bowl.toggleAttribute('data-drop-ready', ready);
    cue.hidden = false;
  }

  function endDrag() {
    const activeDrag = drag;
    drag = null;
    delete bowl.dataset.dragging;
    if (activeDrag && bowl.hasPointerCapture(activeDrag.id)) bowl.releasePointerCapture(activeDrag.id);
  }

  function reset() {
    window.clearTimeout(timer);
    clicks = [];
    prelude?.cancel();
    prelude = null;
    delete bowl.dataset.presenting;
    bowl.style.removeProperty('--feed-tilt');
    bowlArt.hidden = false;
    emptySteel.hidden = true;
    riceClump.hidden = true;
    bowl.style.removeProperty('--feed-height');
    endDrag();
    hideDropHint();
    bowl.hidden = true;
    filledBowl.hidden = true;
    movie?.remove();
    movie = null;
    preparedMovie = null;
    if (restore) image.hidden = false;
    restore = false;
  }

  function noteClick() {
    if (!defaultRole() || !image.complete || !image.naturalWidth || !bowl.hidden || movie) return;
    const now = window.performance.now();
    clicks = clicks.filter(time => now - time < CLICK_WINDOW_MS);
    clicks.push(now);
    if (clicks.length < 5) return;
    clicks = [];

    const rect = image.getBoundingClientRect();
    const width = Math.min(82, Math.max(42, rect.width * .44), window.innerWidth - 2 * GUTTER,
      (window.innerHeight - 2 * GUTTER) * BASIN_ASPECT);
    if (width <= 0) return;
    const left = rect.left - width - GUTTER;
    const right = rect.right + GUTTER;
    const fitsLeft = left >= GUTTER;
    const fitsRight = right + width <= window.innerWidth - GUTTER;
    const range = parkingRange(width, width / BASIN_ASPECT);
    const parked = uiState.getJSON(PARKING_KEY);
    const hasParking = Number.isFinite(parked?.x) && Number.isFinite(parked?.y);
    home = hasParking ? {
      x: GUTTER + Math.max(0, Math.min(1, parked.x)) * range.x,
      y: GUTTER + Math.max(0, Math.min(1, parked.y)) * range.y,
    } : {
      x: fitsLeft && (!flipped() || !fitsRight) ? left : fitsRight ? right : GUTTER,
      y: Math.max(GUTTER, Math.min(rect.bottom - width, GUTTER + range.y)),
    };
    bowl.style.setProperty('--feed-width', width + 'px');
    place(bowl, home.x, home.y);
    bowl.hidden = false;
    preparedMovie = document.createElement('img');
    preparedMovie.className = 'dshwv-feed-animation';
    preparedMovie.alt = '';
    preparedMovie.draggable = false;
    preparedMovie.src = '/assets/feeding-rice.webp?play=' + ++sequence;
    if (!hasParking) timer = window.setTimeout(reset, BOWL_LIFETIME_MS);
  }

  async function pourRice(from, to, animation, mirror) {
    const width = Math.min(from.width, to.width * 1.25);
    const height = width / BASIN_ASPECT;
    const pivot = mirror ? .055 : .945;
    const angle = mirror ? -66 : 66;
    const rimY = .54;
    const dockCenter = to.x + to.width / 2;
    const x = Math.max(0, Math.min(dockCenter - width * pivot, window.innerWidth - width));
    const y = Math.max(0, to.y - height * .74);
    const lipX = x + width * pivot;
    const lipY = y + height * rimY;
    const translate = (x, y) => 'translate(' + x + 'px,' + y + 'px)';
    emptyBowl.hidden = false;
    place(bowl, x, y);
    bowl.style.setProperty('--feed-width', width + 'px');
    bowl.style.setProperty('--feed-height', height + 'px');
    bowl.style.setProperty('--feed-pivot', pivot * 100 + '%');
    prelude = bowl.animate([
      { left: from.x + 'px', top: from.y + 'px', width: from.width + 'px', height: from.height + 'px', transform: 'rotate(0deg)', offset: 0 },
      { left: x + 'px', top: y + 'px', width: width + 'px', height: height + 'px', transform: 'rotate(0deg)', offset: .52 },
      { left: x + 'px', top: y + 'px', width: width + 'px', height: height + 'px', transform: 'rotate(' + angle + 'deg)' },
    ], { duration: 370, easing: 'ease-out' });
    await prelude.finished;
    if (movie !== animation) return;

    bowl.style.setProperty('--feed-tilt', angle + 'deg');
    bowlArt.hidden = true;
    emptySteel.hidden = false;
    const clumpWidth = width * .66;
    const clumpHeight = clumpWidth / 2;
    place(riceClump, dockCenter - clumpWidth / 2, to.y + to.height * .32 - clumpHeight);
    riceClump.style.setProperty('--feed-width', clumpWidth + 'px');
    riceClump.style.setProperty('--feed-height', clumpHeight + 'px');
    riceClump.hidden = false;
    const dx = lipX - dockCenter;
    const dy = lipY - (to.y + to.height * .32);
    prelude = riceClump.animate([
      { transform: translate(dx, dy) + ' rotate(' + angle * .65 + 'deg) scale(.9,1.05)', offset: 0 },
      { transform: translate(dx * .44, dy * .63) + ' rotate(' + angle * .24 + 'deg) scale(.86,1.2)', offset: .43 },
      { transform: 'scale(1.24,.67)', offset: .83 },
      { transform: 'scale(1.1,.92)' },
    ], { duration: 240, easing: 'ease-in', fill: 'both' });
    await prelude.finished;
  }

  async function presentBowl(from, to, animation, mirror) {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await pourRice(from, to, animation, mirror);
      if (movie !== animation) return;
    }
    // Replace the steel basin and empty bowl with the lit full bowl in one paint.
    bowl.hidden = true;
    riceClump.hidden = true;
    prelude?.cancel();
    emptyBowl.hidden = true;
    filledBowl.hidden = false;
    prelude = glow.animate([
      { opacity: 1 },
      { opacity: 1, offset: .64 },
      { opacity: 0 },
    ], { duration: 300, easing: 'ease-out' });
    await prelude.finished;
  }

  function feedingPlacement(rect, mirror) {
    const width = Math.min(rect.width, window.innerWidth);
    const scaleX = width / FRAME.width;
    const scaleY = rect.height * (1 - IDLE_HEADBAND_TOP) / (FRAME.bodyBottom - FRAME.headbandTop);
    const height = FRAME.height * scaleY;
    const left = mirror ? rect.left : rect.right - width;
    const x = Math.max(0, Math.min(left, window.innerWidth - width));
    // Keep the body aligned even when the raised tuft extends above the window.
    const y = Math.min(rect.bottom - FRAME.bodyBottom * scaleY, window.innerHeight - height);
    const bowlX = mirror ? FRAME.width - FRAME.bowl.x - FRAME.bowl.width : FRAME.bowl.x;
    return { x, y, width, height, target: {
      x: x + bowlX * scaleX, y: y + FRAME.bowl.y * scaleY,
      width: FRAME.bowl.width * scaleX, height: FRAME.bowl.height * scaleY,
    } };
  }

  async function feed(from) {
    if (movie || bowl.hidden || !defaultRole()) return;
    window.clearTimeout(timer);
    const mirror = flipped();
    const { x, y, width, height, target } = feedingPlacement(image.getBoundingClientRect(), mirror);
    bowl.dataset.presenting = '';
    endDrag();
    delete bowl.dataset.dropReady;
    place(bowl, from.x, from.y);
    place(emptyBowl, target.x, target.y);
    emptyBowl.style.setProperty('--feed-width', target.width + 'px');
    emptyBowl.style.setProperty('--feed-height', target.height + 'px');
    emptyBowl.classList.toggle('dshwv-feed-mirrored', mirror);
    place(filledBowl, target.x, target.y);
    filledBowl.style.setProperty('--feed-width', target.width + 'px');
    filledBowl.style.setProperty('--feed-height', target.height + 'px');
    filledBowl.classList.toggle('dshwv-feed-mirrored', mirror);

    const animation = preparedMovie;
    animation.classList.toggle('dshwv-feed-mirrored', mirror);
    place(animation, x, y);
    animation.style.setProperty('--feed-width', width + 'px');
    animation.style.setProperty('--feed-height', height + 'px');
    movie = animation;
    timer = window.setTimeout(reset, 5000);
    try {
      // Make sure playback is ready before showing the slide and flash.
      await animation.decode();
      if (movie !== animation) return;
      await presentBowl(from, target, animation, mirror);
    } catch {
      if (movie === animation) reset();
      return;
    }
    if (movie !== animation) return;
    if (!defaultRole()) return reset();

    window.clearTimeout(timer);
    document.body.append(animation);
    if (!uiState.getJSON(PARKING_KEY)) rememberParking(parkingRange(from.width, from.height));
    hideDropHint();
    filledBowl.hidden = true;
    restore = true;
    image.hidden = true;
    timer = window.setTimeout(reset, PLAYBACK_MS);
  }

  function returnBowl() {
    endDrag();
    hideDropHint();
    place(bowl, home.x, home.y);
  }

  scope.on(bowl, 'pointerdown', event => {
    if (event.button !== 0 || drag || movie) return;
    const rect = bowl.getBoundingClientRect();
    drag = {
      id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top,
      width: rect.width, height: rect.height,
    };
    bowl.setPointerCapture(event.pointerId);
    bowl.dataset.dragging = '';
    updateDropHint(dropPoint(event));
  });
  scope.on(bowl, 'pointermove', event => {
    if (event.pointerId !== drag?.id) return;
    const point = dropPoint(event);
    place(bowl, point.x, point.y);
    updateDropHint(point);
  });
  scope.on(bowl, 'pointerup', event => {
    if (event.pointerId !== drag?.id) return;
    const point = dropPoint(event);
    if (point.ready) {
      updateDropHint(point);
      feed(point);
    }
    else parkBasin(point);
  });
  scope.on(bowl, 'lostpointercapture', event => {
    if (event.pointerId === drag?.id) returnBowl();
  });
  scope.on(bowl, 'click', event => {
    if (event.detail === 0) {
      const { x, y, width, height } = bowl.getBoundingClientRect();
      feed({ x, y, width, height });
    }
  });

  const observer = new window.MutationObserver(reset);
  observer.observe(image, { attributes: true, attributeFilter: ['src'] });
  scope.on(window, 'blur', () => { if (drag) returnBowl(); });
  scope.on(window, 'resize', reset);
  scope.on(window, 'whale-mode-changing', reset);
  scope.add(() => {
    observer.disconnect();
    reset();
    bowl.remove();
    cue.remove();
    emptyBowl.remove();
    filledBowl.remove();
    riceClump.remove();
  });
  return { noteClick };
}

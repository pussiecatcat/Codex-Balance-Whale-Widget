import { createMenuHover } from './menu-hover.js';

const BLOCKED_SURFACES = '.dshwv-rolelist,.dshwv-audiolist,.dshwv-cropmask,.dshwv-confirmmask,.dshwv-audiomask,.dshwv-snapmask,.dshwv-bubmask,.dshwv-qedit,.dshwv-usagepanel,.dshwv-usage-mask,.dshwv-resmask,.dshwv-custmenu,.dshwv-custbtn';

export function createCharacterInteraction(deps) {
  const {
    document, window, localStorage, rendering, root, image, positioner, menuButton, state, dragStatus,
    clickDistanceSq, imageUrl, viewport, rightGap, clampToViewport, artCenterAt, snapZones, restoreAnchor,
    express, settle, saveConfig, refreshFlip, pressDown, pressUp, whaleClick, refresh,
    closeMenu, toggleMenu, closeRolePanel, closeAudioGroupPanel, hideBubble,
    applyBubbleConfig, positionMenu, isMenuOpen, isMenuButtonHidden, isScrollGapEnabled,
  } = deps;
  let drag = null;

  function setupHitTest(url) {
    rendering.hitCache.prepare(url || imageUrl);
  }

  function layoutRect() {
    const origin = positioner.getBoundingClientRect();
    const width = root.offsetWidth;
    const height = root.offsetHeight;
    return { left: origin.left, top: origin.top, right: origin.left + width, bottom: origin.top + height, width, height };
  }

  function hit(event) {
    return !!event && rendering.hitCache.hit(image, event.clientX, event.clientY, rendering.mirrorScale(root) < 0);
  }

  function pointerDown(event) {
    if (event.target?.closest) {
      if (event.target.closest('.dshwv-fx-info')) return;
      if (event.target.closest('.dshwv-pop') || event.target.closest('.dshwv-menu-btn')) return;
      if (event.target.closest(BLOCKED_SURFACES)) return;
      if (event.target.closest('.dshwv-rolebtn,.dshwv-audiobtn,.dshwv-roleimport,.dshwv-audioimport')) return;
      if (event.target.closest('.dshwv-menu,.whale-account-card')) {
        closeRolePanel();
        closeAudioGroupPanel();
        return;
      }
    }
    if (isMenuOpen()) {
      closeMenu();
      return;
    }
    if (event.button !== 0 && event.pointerType === 'mouse' || !hit(event)) return;
    try { event.preventDefault(); event.stopPropagation(); } catch (error) {}
    const area = viewport();
    const rect = positioner.getBoundingClientRect();
    try { root.setPointerCapture(event.pointerId); } catch (error) {}
    drag = { active: true, startX: event.clientX, startY: event.clientY, origLeft: rect.left, origTop: rect.top,
      w: root.offsetWidth, h: root.offsetHeight, moved: false, vp: area };
    dragStatus.active = true;
    root.classList.add('dshwv-dragging');
    positioner.style.transition = 'none';
    pressDown();
    menuHover.setCursor('grabbing');
    document.addEventListener('pointermove', pointerMove, true);
    document.addEventListener('pointerup', pointerUp, true);
    document.addEventListener('pointercancel', pointerCancel, true);
  }

  function pointerMove(event) {
    if (!drag?.active) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (dx * dx + dy * dy >= clickDistanceSq) drag.moved = true;
    const moved = clampToViewport(drag.origLeft + dx, drag.origTop + dy, drag.w, drag.h, drag.vp);
    state.left = moved.left;
    state.top = moved.top;
    express();
  }

  function pointerUp(event) {
    try { if (hit(event)) { event.preventDefault(); event.stopPropagation(); } } catch (error) {}
    endDrag(event, true);
  }

  function pointerCancel(event) { endDrag(event, false); }

  function stopClick(event) {
    if (event.target?.closest) {
      if (event.target.closest('.dshwv-fx-info')) return;
      if (event.target.closest('.dshwv-pop,.dshwv-menu,.whale-account-card,.dshwv-menu-btn,' + BLOCKED_SURFACES)) return;
    }
    if (!hit(event)) return;
    try { event.preventDefault(); event.stopPropagation(); } catch (error) {}
  }

  function contextMenu(event) {
    try {
      if (!isMenuButtonHidden()) return;
      if (event.target?.closest && event.target.closest('.dshwv-pop,.dshwv-menu,.whale-account-card,.dshwv-menu-btn,' + BLOCKED_SURFACES)) return;
      if (!hit(event)) return;
      event.preventDefault();
      toggleMenu();
    } catch (error) {}
  }

  const menuHover = createMenuHover({
    document, image, button: menuButton, isWhaleHit: hit,
    isDragging: () => !!drag?.active, isMenuOpen, isButtonHidden: isMenuButtonHidden,
  });

  function endDrag(event, clickAllowed) {
    if (!drag?.active) return;
    drag.active = false;
    dragStatus.active = false;
    try { if (event && root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId); } catch (error) {}
    document.removeEventListener('pointermove', pointerMove, true);
    document.removeEventListener('pointerup', pointerUp, true);
    document.removeEventListener('pointercancel', pointerCancel, true);
    pressUp();
    root.classList.remove('dshwv-dragging');
    positioner.style.transition = '';
    menuHover.setCursor(hit(event) ? 'grab' : '');
    if (clickAllowed && !drag.moved) {
      whaleClick();
      refresh(true);
      return;
    }
    const release = event && Number.isFinite(event.clientX) ? event : {
      clientX: drag.startX + state.left - drag.origLeft,
      clientY: drag.startY + state.top - drag.origTop,
    };
    const dx = release.clientX - drag.startX;
    const dy = release.clientY - drag.startY;
    const moved = clampToViewport(drag.origLeft + dx, drag.origTop + dy, drag.w, drag.h, drag.vp);
    const center = artCenterAt(moved.left, moved.top, drag.w, drag.h, !!state.flip);
    const zones = snapZones(center.cx, moved.top + drag.h / 2, center.cy, drag.vp);
    if (zones.zH === 'left') { state.h = 'left'; state.hOff = 0; }
    else if (zones.zH === 'right') { state.h = 'right'; state.hOff = 0; }
    else { state.h = null; state.hOff = moved.left; }
    if (zones.zV === 'top') { state.v = 'top'; state.vOff = 0; }
    else if (zones.zV === 'bottom') { state.v = 'bottom'; state.vOff = 0; }
    else { state.v = null; state.vOff = moved.top; }
    state.flip = zones.zH === 'left' ? true : zones.zH === 'right' ? false : zones.flip;
    state.left = moved.left;
    state.top = moved.top;
    settle();
    saveConfig();
  }

  function applyAnchorPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem('dshw-pos') || 'null');
      const area = viewport();
      const width = root.offsetWidth || root.getBoundingClientRect().width || 0;
      const height = root.offsetHeight || root.getBoundingClientRect().height || 0;
      const restored = restoreAnchor(saved, area, width, height, isScrollGapEnabled() ? rightGap() : 0);
      if (!restored) return false;
      Object.assign(state, { left: restored.left, top: restored.top, h: restored.h, hOff: restored.hOff,
        v: restored.v, vOff: restored.vOff });
      refreshFlip();
      return true;
    } catch (error) { return false; }
  }

  document.addEventListener('pointerdown', pointerDown, true);
  document.addEventListener('click', stopClick, true);
  document.addEventListener('contextmenu', contextMenu, true);
  document.addEventListener('pointermove', menuHover.pointerMove, true);
  document.addEventListener('mousemove', menuHover.pointerMove, true);
  window.addEventListener('whale-hover', event => menuHover.pointerMove({ clientX: event.detail.x, clientY: event.detail.y }));
  root.addEventListener('lostpointercapture', event => endDrag(event, false));
  window.addEventListener('blur', () => endDrag(null, false));
  window.addEventListener('whale-mode-changing', () => {
    endDrag(null, false); closeMenu(); menuHover.reset(); hideBubble();
    window.getSelection()?.removeAllRanges(); menuHover.setCursor('');
  });
  window.addEventListener('whale-desktop-mode', () => {
    endDrag(null, false); closeMenu(); menuHover.reset(); hideBubble(); settle();
    window.getSelection()?.removeAllRanges(); menuHover.setCursor('');
  });
  window.addEventListener('whale-account-view', () => {
    hideBubble(); applyBubbleConfig(); refresh(true);
    window.requestAnimationFrame(() => { if (isMenuOpen()) positionMenu(); });
  });
  window.addEventListener('resize', () => {
    positioner.style.transition = 'none';
    if (!(state.h === null && state.v === null && applyAnchorPosition())) settle();
    void positioner.getBoundingClientRect();
    window.requestAnimationFrame(() => { positioner.style.transition = ''; });
  });
  state.left = Math.max(0, viewport().w - root.offsetWidth - rightGap());
  state.top = Math.max(0, viewport().h - root.offsetHeight);
  applyAnchorPosition();
  express();
  window.addEventListener('whale-reset-position', () => {
    endDrag(null, false); closeMenu(); hideBubble();
    localStorage.setItem('dshw-pos', JSON.stringify({ v: 2, hAnchor: 'right', hDist: 12, vAnchor: 'bottom', vDist: 12 }));
    applyAnchorPosition(); settle();
  });

  return Object.freeze({
    setupHitTest, layoutRect, isWhaleHit: hit, endDrag, applyAnchorPosition,
    resetMenuButtonHover: menuHover.reset, showMenuButton: menuHover.show,
    setWidgetCursor: menuHover.setCursor,
  });
}

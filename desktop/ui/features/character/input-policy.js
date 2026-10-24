export function pointerPressAccepted(root, event, hit, point) {
  try {
    if (root.hasPointerCapture(event.pointerId)) return true;
  } catch (error) {}
  return !!hit(point);
}

export const INPUT_SURFACES = '.whale-account-card,dialog[open],.dshwv-menu-open,.dshwv-menu-btn-visible:not(.dshwv-menu-btn-hidden),.dshwv-rolelist,.dshwv-audiolist,.dshwv-qedit,.dshwv-usagepanel,.dshwv-custmenu,.dshwv-custbtn,.dshwv-tplhelp,.dshwv-fx-info,#toast:not([hidden])';

export function createInputHitTester({ document, pet, root, rendering, getComputedStyle, viewport }) {
  function visible(element) {
    return !!element?.isConnected && !element.hidden && element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  }
  function acceptsInput(element) {
    if (!visible(element) || element.closest('[inert]') || getComputedStyle(element).pointerEvents === 'none') return false;
    const menu = element.closest('.dshwv-menu');
    return !menu || menu.classList.contains('dshwv-menu-open');
  }
  function contains(element, point) {
    const bounds = element.getBoundingClientRect();
    return point.x >= bounds.left && point.x < bounds.right && point.y >= bounds.top && point.y < bounds.bottom;
  }
  function hit(point) {
    for (const element of document.querySelectorAll(INPUT_SURFACES)) {
      if (acceptsInput(element) && contains(element, point)) return true;
    }
    const size = viewport();
    function cardHit(element, depth = 0) {
      if (!visible(element)) return false;
      const bounds = element.getBoundingClientRect();
      if (depth < 3 && bounds.width >= size.width * .95 && bounds.height >= size.height * .95) {
        return [...element.children].some(child => cardHit(child, depth + 1));
      }
      return acceptsInput(element) && contains(element, point);
    }
    for (const mask of document.querySelectorAll('[class*="mask"]')) {
      if (visible(mask) && [...mask.children].some(child => cardHit(child))) return true;
    }
    const target = document.elementFromPoint(point.x, point.y);
    if (target?.closest('.dshwv-pop-open') && !target.closest('[inert]')) return true;
    return visible(pet) && rendering.hitCache.hit(pet, point.x, point.y, rendering.mirrorScale(root) < 0);
  }
  return Object.freeze({ hit });
}

export function createRoleHitPreparer(deps) {
  const { pet, rendering, bridge, window, CustomEvent, document, request, toast } = deps;
  const failedSources = new Set();
  let ready = false;

  async function prepare() {
    if (!pet.complete) return false;
    if (!pet.naturalWidth) {
      fallback();
      return false;
    }
    const source = pet.currentSrc || pet.src;
    await rendering.hitCache.prepare(source);
    if (!pet.complete || !pet.naturalWidth || (pet.currentSrc || pet.src) !== source) return false;
    if (!ready) {
      ready = true;
      bridge.ready();
    }
    request();
    return true;
  }

  function fallback() {
    const source = pet.currentSrc || pet.src;
    if (!source || failedSources.has(source)) return false;
    failedSources.add(source);
    if (/\/dsh-whale\/image\.png(?:\?|$)/.test(source)) {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 160;
      const context = canvas.getContext('2d');
      context.fillStyle = '#6184cf';
      context.beginPath();
      context.ellipse(78, 95, 60, 42, 0, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(125, 94);
      context.lineTo(158, 65);
      context.lineTo(154, 112);
      context.closePath();
      context.fill();
      context.fillStyle = 'white';
      context.beginPath();
      context.arc(53, 86, 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#203170';
      context.beginPath();
      context.arc(51, 86, 4, 0, Math.PI * 2);
      context.fill();
      pet.src = canvas.toDataURL('image/png');
      pet.alt = '小鲸鱼恢复占位图';
      if (!ready) {
        ready = true;
        bridge.ready();
      }
      toast?.('内置角色无法读取，已使用恢复占位图。可重新选择角色或修复安装。');
      request();
      return true;
    }
    window.dispatchEvent(new CustomEvent('whale-role-fallback', { detail: { src: source, reason: 'decode-failed' } }));
    return true;
  }

  return Object.freeze({ prepare, fallback, isReady: () => ready });
}

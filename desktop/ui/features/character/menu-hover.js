const CONTROL_SELECTOR = '.dshwv-pop-open,.dshwv-menu-open,.whale-account-card,.dshwv-menu-btn-visible,.dshwv-rolelist,.dshwv-cropmask,.dshwv-confirmmask,.dshwv-audiolist,.dshwv-audiomask,.dshwv-snapmask,.dshwv-bubmask,.dshwv-qedit,.dshwv-usagepanel,.dshwv-usage-mask,.dshwv-resmask,.dshwv-custmenu,.dshwv-custbtn';

export function createMenuHover({ document, image, button, isWhaleHit, isDragging, isMenuOpen, isButtonHidden,
  schedule = setTimeout, cancel = clearTimeout }) {
  let timer = null, cursor = '';
  function clearPending() { if (timer !== null) cancel(timer); timer = null; }
  function reset() {
    clearPending();
    button.classList.remove('dshwv-menu-btn-visible');
  }
  function show() {
    clearPending();
    button.classList.toggle('dshwv-menu-btn-visible', !isButtonHidden());
  }
  function inArea(event) {
    if (!event || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY) || event.clientX < 0 || event.clientY < 0) return false;
    const pet = image.getBoundingClientRect(), bounds = button.getBoundingClientRect(), pad = 4;
    return event.clientX >= Math.min(pet.left, bounds.left) - pad && event.clientX <= Math.max(pet.right, bounds.right) + pad &&
      event.clientY >= Math.min(pet.top, bounds.top) - pad && event.clientY <= Math.max(pet.bottom, bounds.bottom) + pad;
  }
  function update(event, overPet, overControl) {
    if (isButtonHidden()) { reset(); return; }
    if (isMenuOpen() || overPet || overControl || button.classList.contains('dshwv-menu-btn-visible') && inArea(event)) {
      show();
    } else if (timer === null && button.classList.contains('dshwv-menu-btn-visible')) {
      timer = schedule(() => {
        timer = null;
        if (!isMenuOpen() || isButtonHidden()) button.classList.remove('dshwv-menu-btn-visible');
      }, 160);
    }
  }
  function setCursor(value) {
    if (value === cursor) return;
    cursor = value;
    try { document.documentElement.dataset.whaleCursor = value; } catch {}
  }
  function pointerMove(event) {
    if (isDragging()) { setCursor('grabbing'); return; }
    let target = null;
    try { target = document.elementFromPoint(event.clientX, event.clientY); } catch {}
    const overControl = !!(target?.closest && target.closest(CONTROL_SELECTOR));
    const overPet = !overControl && isWhaleHit(event);
    setCursor(overPet ? 'grab' : '');
    update(event, overPet, overControl);
  }
  return { reset, show, inArea, update, setCursor, pointerMove, get cursor() { return cursor; } };
}

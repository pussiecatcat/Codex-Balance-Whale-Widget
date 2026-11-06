// CSS owns the layer values; callers use names or open a child over its parent.
export const LAYERS = Object.freeze({
  widget: '--layer-widget', menu: '--layer-menu', dropdown: '--layer-dropdown',
  info: '--layer-info', dialog: '--layer-dialog', nestedDialog: '--layer-nested-dialog',
  editor: '--layer-editor', popover: '--layer-popover', toast: '--layer-toast',
  native: '--layer-native',
});

export function setLayer(element, name) {
  if (!element?.style || !LAYERS[name]) return;
  element.style.zIndex = `var(${LAYERS[name]})`;
  if (element.dataset) element.dataset.whaleLayer = name;
}

const OVERLAYS = '[data-whale-layer],.dshwv-bubmask,.dshwv-audiomask,.dshwv-cropmask,.dshwv-confirmmask,.dshwv-snapmask,.dshwv-resmask,.dshwv-usage-mask,.dshwv-qedit,.dshwv-usagepanel,.whale-settings-panel';

function styleOf(element) {
  const view = element?.ownerDocument?.defaultView;
  return view?.getComputedStyle ? view.getComputedStyle(element) : element?.style;
}

export function layerValue(element) {
  const value = Number.parseInt(styleOf(element)?.zIndex, 10);
  return Number.isFinite(value) ? value : 0;
}

export function openOver(parentElement, element) {
  if (!element?.style) return 0;
  let parentValue = layerValue(parentElement);
  if (!parentElement) {
    for (const candidate of element.ownerDocument?.querySelectorAll?.(OVERLAYS) || []) {
      if (candidate === element || candidate.contains?.(element)) continue;
      const style = styleOf(candidate);
      if (candidate.hidden || style?.display === 'none' || style?.visibility === 'hidden') continue;
      parentValue = Math.max(parentValue, layerValue(candidate));
    }
  }
  const root = element.ownerDocument?.documentElement;
  const base = Number.parseInt(styleOf(root)?.getPropertyValue?.(LAYERS.dialog), 10) || 20000;
  const value = Math.max(base, parentValue + 10);
  element.style.zIndex = String(value);
  if (element.dataset) element.dataset.whaleLayer = 'nestedDialog';
  return value;
}

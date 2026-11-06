// The only list of rows allowed in the compact menu. Labels never identify rows.
export const MENU_LAYOUT = Object.freeze([
  { id: 'role' }, { id: 'size' }, { id: 'dataSource' },
  { id: 'displayMode' }, { id: 'sound' }, { id: 'bubble' },
  { id: 'ledger', modes: ['api'], slot: 'navigation' },
  { id: 'advanced', slot: 'footer' },
]);

const menus = new WeakMap();

export function mountMenu(layout, registry, mode, containers) {
  let currentMode = mode;
  function render() {
    for (const [slot, container] of Object.entries(containers)) {
      const rows = layout.filter(row => (row.slot || 'view') === slot &&
        (!row.modes || row.modes.includes(currentMode)))
        .map(row => registry.get(row.id)?.element).filter(Boolean);
      container.replaceChildren(...rows);
    }
  }
  function register({ id, element }) {
    if (!layout.some(row => row.id === id)) throw new Error('Unknown compact menu row: ' + id);
    element.dataset.menuId = id;
    const row = { id, element };
    registry.set(id, row);
    render();
    return () => {
      if (registry.get(id) !== row) return;
      registry.delete(id); element.remove(); render();
    };
  }
  render();
  return { register, applyMode(next) { currentMode = next; render(); } };
}

export function createMenuLayout(menu, containers, mode = 'subscription') {
  const controller = mountMenu(MENU_LAYOUT, new Map(), mode, containers);
  menus.set(menu, controller);
  return controller;
}

export function registerMenuRow(menu, row) {
  const controller = menus.get(menu);
  if (!controller) throw new Error('Compact menu is not ready');
  return controller.register(row);
}

import { createBubbleRowsView } from '../../desktop/ui/features/widget/bubble-rows-view.js';
import { bubbleRowsOf } from '../../desktop/ui/shared/bubble-config/layout.js';

export function renderBubbleRows(modules, { boxWidth = 505, scrollWidth = 0 } = {}) {
  function element() {
    const node = {
      className: '', style: {}, children: [], scrollWidth,
      appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
      removeChild(child) { this.children = this.children.filter(item => item !== child); },
      querySelectorAll() { return []; },
      addEventListener() {},
    };
    node.classList = {
      add(...names) { node.className = [...new Set([...node.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
      remove(name) { node.className = node.className.split(/\s+/).filter(value => value !== name).join(' '); },
      contains(name) { return node.className.split(/\s+/).includes(name); },
    };
    return node;
  }
  const root = element();
  const document = { documentElement: root, createElement: element };
  const parent = element();
  const view = createBubbleRowsView({
    document,
    window: { getComputedStyle: () => ({ fontSize: '10px', getPropertyValue: name => name === '--dshw-box-wu' ? String(boxWidth) : '1px' }) },
    WhaleMoney: { clearBindings() {}, bind() {} },
    bubbleModuleFontU: () => 10,
    bubbleRowsOf,
    bubbleIsImgMod: module => module.type === 'image',
    whaleMoneyTemplates: new Set(),
    getBubbleTarget: () => parent,
    bubbleSnapshot: input => ({ modules: input, rows: new Map(input.map(module => [module, { txt: module.text || module.tpl || module.type }])) }),
  });
  view.rowsTo(parent, modules);
  const flatten = node => [node, ...node.children.flatMap(flatten)];
  return { parent, nodes: flatten(parent).slice(1) };
}

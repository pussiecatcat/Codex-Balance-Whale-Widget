// The queue-advance setting. Its explanation stays visible under the label, so
// there is no popover to clip inside the shaped widget window.
export function createBubbleAdvanceControl({ document, onChange }) {
  const row = document.createElement('div');
  row.className = 'dshwv-bubadvance';

  const label = document.createElement('label');
  label.className = 'dshwv-bubadvance-label';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'dshwv-check dshwv-bubadvance-check';
  const text = document.createElement('span');
  text.className = 'dshwv-bubadvance-text';
  const title = document.createElement('strong');
  title.textContent = '点角色也能翻到下一条';
  const hint = document.createElement('small');
  hint.textContent = '关闭时，点角色回到第 1 条，点气泡才翻页。';
  text.appendChild(title);
  text.appendChild(hint);
  label.appendChild(input);
  label.appendChild(text);
  row.appendChild(label);

  input.addEventListener('change', () => onChange?.(input.checked));

  return Object.freeze({
    element: row,
    input,
    getValue: () => input.checked,
    setValue(value) { input.checked = value === true; },
  });
}

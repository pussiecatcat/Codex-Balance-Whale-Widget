import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const widget = read('desktop/ui/whale-widget.css');
const dialog = read('desktop/ui/ui.css');
const settings = read('desktop/ui/settings.css');

const luminance = hex => {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(offset => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (foreground, background) => {
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};
const token = (css, name) => css.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})'))?.[1];

test('both stylesheets are light-only blue-white and carry no automatic dark theme', () => {
  for (const [name, css] of [['whale-widget.css', widget], ['ui.css', dialog]]) {
    assert.doesNotMatch(css, /prefers-color-scheme/, name + ' must not switch themes with the system');
    assert.doesNotMatch(css, /color-scheme\s*:\s*light\s+dark/, name + ' must not advertise a dark scheme');
    for (const legacy of ['#146b70', '#4fb3b8', '#d8e4e0', '#294c54', '#466b70', '#7b8f93', '#9fb0d9', '#f1f5f4', '#c53030', '#b7791f']) {
      assert.equal(css.toLowerCase().includes(legacy), false, name + ' still contains the green-teal value ' + legacy);
    }
  }
  assert.match(settings, /--muted:\s*#5a6a92/, 'the settings window keeps the deeper muted blue');
});

test('blue-white tokens match the original palette', () => {
  assert.equal(token(dialog, 'text'), '#293752');
  assert.equal(token(dialog, 'text-muted'), '#536079');
  assert.equal(token(dialog, 'text-hint'), '#5a6a92');
  assert.equal(token(dialog, 'border'), '#dce2ef');
  assert.equal(token(dialog, 'surface-muted'), '#f4f6fb');
  assert.equal(token(dialog, 'accent'), '#263c82');
  assert.equal(token(dialog, 'primary'), '#4358aa');
  assert.equal(token(widget, 'text'), '#203170');
  assert.equal(token(widget, 'text-muted'), '#536ba9');
  assert.equal(token(widget, 'text-hint'), '#5a6a92');
  assert.equal(token(widget, 'surface-muted'), '#f4f6fb');
  assert.equal(token(widget, 'accent'), '#263c82');
});

test('text tokens keep WCAG AA contrast on their own backgrounds', () => {
  const pairs = [
    [token(dialog, 'text'), '#ffffff', 4.5, 'dialog text'],
    [token(dialog, 'text-muted'), '#ffffff', 4.5, 'dialog muted'],
    [token(dialog, 'text-hint'), '#ffffff', 4.5, 'dialog hint'],
    [token(dialog, 'text'), token(dialog, 'surface-muted'), 4.5, 'dialog text on wash'],
    [token(widget, 'text'), '#ffffff', 4.5, 'widget text'],
    [token(widget, 'text-muted'), '#ffffff', 4.5, 'widget muted'],
    [token(widget, 'text-hint'), '#ffffff', 4.5, 'widget hint'],
    [token(widget, 'text'), token(widget, 'surface-muted'), 4.5, 'widget text on wash'],
  ];
  for (const [foreground, background, minimum, label] of pairs) {
    const ratio = contrast(foreground, background);
    assert.ok(ratio >= minimum, label + ' contrast ' + ratio.toFixed(2) + ' is below ' + minimum);
  }
  assert.ok(contrast('#6384d5', '#ffffff') >= 3, 'the focus ring stays visible on white');
});

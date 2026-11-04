import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const widgetSource = fs.readFileSync(path.join(root, 'assets/whale-widget.js'), 'utf8');
const rowsViewSource = fs.readFileSync(path.join(root, 'desktop/ui/features/widget/bubble-rows-view.js'), 'utf8');
const defaultContentSource = fs.readFileSync(path.join(root, 'desktop/ui/features/widget/default-content.js'), 'utf8');
const uiCss = fs.readFileSync(path.join(root, 'desktop/ui/ui.css'), 'utf8');

// Matches the inset WhaleRendering.fitFrameToBubble applies: half the 18u stroke
// plus breathing room, measured from the drawn path.
const FIT_INSET_U = 15;

function readShapes() {
  const block = widgetSource.match(/var BUBBLE_SHAPES = \{([\s\S]*?)\n    \};/);
  assert.ok(block, 'assets/whale-widget.js must declare BUBBLE_SHAPES');
  const shapes = {};
  for (const [, name, d] of block[1].matchAll(/(\w+):\s*'([^']+)'/g)) shapes[name] = d;
  return shapes;
}

// Geometry of a centred box, expressed relative to the path's own centre.
function readBox(shapeClass) {
  const selector = shapeClass
    ? new RegExp(`html\\.desktop\\.${shapeClass}\\{--dshw-box-wu:(\\d+);--dshw-box-hu:(\\d+);--dshw-card-wu:(\\d+)`)
    : /html\.desktop\{--dshw-box-wu:(\d+);--dshw-box-hu:(\d+);--dshw-card-wu:(\d+)/;
  const match = uiCss.match(selector);
  assert.ok(match, `ui.css must define the content box for ${shapeClass || 'the default shape'}`);
  return { width: Number(match[1]), height: Number(match[2]), card: Number(match[3]) };
}

const shapes = readShapes();

// The ellipse is centred at (454, 249) with rx 373 / ry 232.
const ELLIPSE = { cx: 454, cy: 249, rx: 373, ry: 232 };

function ellipseHalfWidthAt(dy) {
  const ratio = 1 - (dy / (ELLIPSE.ry - FIT_INSET_U)) ** 2;
  return ratio <= 0 ? 0 : (ELLIPSE.rx - FIT_INSET_U) * Math.sqrt(ratio);
}

test('both bubble shapes are declared and the ellipse is unchanged', () => {
  assert.deepEqual(Object.keys(shapes).sort(), ['ellipse', 'round']);
  assert.equal(
    shapes.ellipse,
    'M 827 248 A 373 232 0 1 0 81 246 A 373 232 0 0 0 301 465 A 57 32 10 0 0 413 484 A 373 232 0 0 0 827 248 Z',
    'the default ellipse geometry must stay byte-identical so upgrading users see no change'
  );
  for (const d of Object.values(shapes)) {
    assert.match(d, /^M [\d.]+ [\d.]+ /, 'each shape is a single closed path starting with a move');
  }
});

test('the elliptical content box fits the ellipse at every corner', () => {
  const box = readBox(null);
  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;
  // The box is centred on the path, so the binding constraint is its corners.
  const available = ellipseHalfWidthAt(halfHeight);
  assert.ok(
    halfWidth <= available,
    `content box ${box.width}u wide needs ${halfWidth}u at dy=${halfHeight}u but the ellipse only offers ${available.toFixed(1)}u`
  );
});

test('the elliptical box is no smaller than it needs to be', () => {
  // Guards against silently shrinking the bubble to hide a regression.
  const box = readBox(null);
  assert.ok(box.width >= 400 && box.height >= 280, `ellipse content box ${box.width}x${box.height}u regressed below the reviewed size`);
  assert.ok(box.card * 2 + 20 <= box.width, `two ${box.card}u cards plus a gap must fit inside ${box.width}u`);
});

test('the rounded shape offers strictly more room than the ellipse', () => {
  const ellipse = readBox(null);
  const round = readBox('dshw-shape-round');
  assert.ok(round.width > ellipse.width, `rounded box ${round.width}u must be wider than the ellipse ${ellipse.width}u`);
  assert.ok(round.card > ellipse.card, `rounded card ${round.card}u must be wider than the ellipse ${ellipse.card}u`);
  assert.ok(round.card * 2 + 20 <= round.width, `two ${round.card}u cards plus a gap must fit inside ${round.width}u`);
});

test('the rounded path encloses the rounded content box', () => {
  // The rounded body spans x 81..827 / y 15..479 with a 150u corner radius, and
  // the tail notch dips to y=502. Check the box corners against those bounds.
  const box = readBox('dshw-shape-round');
  const left = 81 + FIT_INSET_U;
  const right = 827 - FIT_INSET_U;
  const top = 15 + FIT_INSET_U;
  const bottom = 479 - FIT_INSET_U;
  const centreY = (top + bottom) / 2;
  const radius = 150 - FIT_INSET_U;

  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;
  const centreX = (left + right) / 2;
  assert.ok(Math.abs(centreY - 249) < 12, `box centre ${centreY} drifted from the path centre`);

  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const x = centreX + sx * halfWidth;
      const y = centreY + sy * halfHeight;
      assert.ok(x > left && x < right && y > top && y < bottom, `corner (${x}, ${y}) left the body bounds`);
      // A corner point is only governed by the arc when it sits past the arc
      // centre on both axes; otherwise the straight edges already contain it.
      const inCornerX = sx < 0 ? x < left + radius : x > right - radius;
      const inCornerY = sy < 0 ? y < top + radius : y > bottom - radius;
      if (!inCornerX || !inCornerY) continue;
      const arcX = sx < 0 ? left + radius : right - radius;
      const arcY = sy < 0 ? top + radius : bottom - radius;
      const distance = Math.hypot(x - arcX, y - arcY);
      assert.ok(distance <= radius, `corner (${x}, ${y}) is ${distance.toFixed(1)}u from its arc centre, past the ${radius}u radius`);
    }
  }
});

test('the quota cards share one row so they render side by side', () => {
  // On the refactored main line the default queue lives in default-content.js.
  const block = defaultContentSource.match(/export function bubbleDefaultSubscriptionQueue\(\)[\s\S]*?modules: \[([\s\S]*?)\]\s*\}\s*\];/);
  assert.ok(block, 'bubbleDefaultSubscriptionQueue must remain discoverable');
  const rows = [...block[1].matchAll(/windowDurationMins:\s*(\d+),\s*row:\s*(\d+)/g)].map(m => m[2]);
  assert.equal(rows.length, 2, 'the default subscription bubble ships exactly two gauges');
  assert.equal(rows[0], rows[1], 'stacked gauges overflow the bubble, so both must share one row key');
});

test('the previous stacked default is migrated to the two-column layout', () => {
  assert.match(
    defaultContentSource,
    /bubbleLegacySubscriptionDefault[\s\S]*?modules\.length === 3/,
    'users saved on the old three-module default must be detected and migrated'
  );
});

test('row wrapping follows the selected shape instead of a fixed 560u', () => {
  assert.match(uiCss, /--dshw-box-wu:\d+/, 'ui.css must publish the box width for the renderer to read');
  assert.match(rowsViewSource, /function bubbleRowCapU\(\)/, 'the renderer must read the box width');
  assert.doesNotMatch(rowsViewSource, /560 \* (uVal2|compFs)/, 'no hardcoded 560u row cap may survive');
});

test('the frame scale is applied to the frame, never to .dshwv-text', () => {
  assert.match(uiCss, /\.desktop \.dshwv-frame\{transform:scale\(var\(--dshw-fit,1\)\)/);
  assert.doesNotMatch(uiCss, /\.desktop \.dshwv-text\{[^}]*dshw-fit/, 'scaling .dshwv-text would break the mirror transform assertions');
});

test('the content box replaces the old 66%/64% rectangle', () => {
  assert.match(uiCss, /\.desktop \.dshwv-text\{width:calc\(var\(--dshw-u\) \* var\(--dshw-box-wu\)\)/);
  assert.doesNotMatch(uiCss, /\.desktop \.dshwv-text\{[^}]*width:\s*66%/);
});

test('no custom property on <html> may reference --dshw-u', () => {
  // A var() inside a custom property resolves against the same element only.
  // --dshw-u is declared on .dshwv-pop, so indirection through <html> would be
  // invalid at computed-value time and silently fall back to width:auto.
  for (const [, block] of uiCss.matchAll(/html\.desktop[^{]*\{([^}]*)\}/g)) {
    assert.doesNotMatch(block, /--[\w-]+:[^;{}]*var\(--dshw-u\)/,
      'html.desktop must only carry plain design-unit numbers: ' + block.slice(0, 90));
  }
});

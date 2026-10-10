import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Linter } from 'eslint';

import { noEagerUseBeforeInit } from '../eslint.config.js';

// Mirrors how the monolith wires a module in: an object literal passing a bare
// variable by value, with the `var` that fills it declared further down the same
// function. Reading it at wiring time yields undefined, and nothing else in the
// repo notices — no-undef sees a defined name, no-use-before-define is far too
// broad here.
const linter = new Linter();
const config = {
  plugins: { local: { rules: { 'no-eager-use-before-init': noEagerUseBeforeInit } } },
  rules: { 'local/no-eager-use-before-init': 'error' },
  languageOptions: { ecmaVersion: 'latest', sourceType: 'script' },
};

function lint(code) {
  return linter.verify(code, config);
}

test('flags a dependency wired by value before its initialiser', () => {
  const messages = lint('var mod = createThing({ toggle: toggle });\nvar toggle = makeToggle();\n');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].ruleId, 'local/no-eager-use-before-init');
  assert.equal(messages[0].line, 1);
  assert.match(messages[0].message, /initialised on line 2/);
});

test('flags it across intervening statements, not just the adjacent line', () => {
  const code = ['var editors = createEditors({ toggle: bubbleTplHelpToggle });',
    'var unrelated = 1;', 'function gap() {}', 'var bubbleTplHelpToggle = help.toggle;'].join('\n');
  const messages = lint(code);
  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /initialised on line 4/);
});

test('allows a read from inside a nested function, which runs later', () => {
  const code = 'var mod = createThing({ open: function () { return toggle(); } });\nvar toggle = makeToggle();\n';
  assert.deepEqual(lint(code), []);
});

test('allows a parameter of the same name shadowing an outer var', () => {
  const code = 'var payload = wrap(function (body) { return { ok: true, body: body }; });\nvar body = document.createElement("div");\n';
  assert.deepEqual(lint(code), []);
});

test('allows a read that follows its initialiser', () => {
  const code = 'var toggle = makeToggle();\nvar mod = createThing({ toggle: toggle });\n';
  assert.deepEqual(lint(code), []);
});

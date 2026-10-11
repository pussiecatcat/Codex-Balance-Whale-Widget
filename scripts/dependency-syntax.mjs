import { parse } from 'espree';
import { analyze } from 'eslint-scope';

// Scope resolution distinguishes an injected port from an ambient browser API.
// Literal computed members and local aliases are included; strings/comments are not code.
export function dependencySyntax(source) {
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module', range: true, loc: true });
  const scopes = analyze(tree, { ecmaVersion: 2024, sourceType: 'module' });
  const references = new Map(scopes.scopes.flatMap(scope => scope.references).map(ref => [ref.identifier, ref.resolved]));
  const property = node => node.computed ? node.property.value : node.property.name;
  function origin(node, seen = new Set()) {
    if (!node || seen.has(node)) return null;
    seen.add(node);
    if (node.type === 'ChainExpression') return origin(node.expression, seen);
    if (node.type === 'MemberExpression') {
      const name = property(node), base = origin(node.object, seen);
      // Explicit window ports still expose the legacy application globals.
      if (name === 'window') return 'window';
      return base && typeof name === 'string' ? base + '.' + name : null;
    }
    if (node.type !== 'Identifier') return null;
    const variable = references.get(node);
    if (!variable) return ['window', 'globalThis', 'fetch', 'XMLHttpRequest', 'localStorage'].includes(node.name) ? node.name : null;
    for (const definition of variable.defs) {
      if (definition.type === 'Parameter' && node.name === 'window') return 'window';
      if (definition.type !== 'Variable') continue;
      const declaration = definition.node;
      const value = origin(declaration.init, seen);
      if (declaration.id.type === 'Identifier') return value;
      if (declaration.id.type === 'ObjectPattern') {
        const prop = declaration.id.properties.find(item => item.value?.name === node.name);
        const name = prop && (prop.computed ? prop.key.value : prop.key.name);
        if (name === 'window') return 'window';
        return value && name ? value + '.' + name : null;
      }
    }
    return null;
  }
  const imports = [], globals = {}, published = [], requests = [], storage = [];
  const finding = node => ({ index: node.range[0], line: node.loc.start.line, sample: source.slice(...node.range).slice(0, 140) });
  function walk(node, parent) {
    if (!node || typeof node !== 'object') return;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type) && typeof node.source?.value === 'string') {
      imports.push({ spec: node.source.value, index: node.range[0] });
    }
    if (node.type === 'MemberExpression') {
      const name = property(node), base = origin(node.object);
      if (['window', 'globalThis', 'globalThis.window'].includes(base) && /^Whale/.test(name)) {
        globals[name] = (globals[name] || 0) + 1;
        if (parent?.type === 'AssignmentExpression' && parent.left === node) published.push(name);
      }
    }
    // Count only references, never declarations or non-computed property names.
    if (node.type === 'MemberExpression' || node.type === 'Identifier' && references.has(node)) {
      const value = origin(node);
      if (/^(?:(?:window|globalThis)(?:\.window)?\.)?(?:fetch|XMLHttpRequest)$/.test(value)) requests.push(finding(node));
      if (/^(?:(?:window|globalThis)(?:\.window)?\.)?localStorage$/.test(value)) storage.push(finding(node));
    }
    for (const [key, value] of Object.entries(node)) {
      if (['range', 'loc'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(child => walk(child, node));
      else if (value && typeof value === 'object') walk(value, node);
    }
  }
  walk(tree);
  return { imports, globals, published, requests, storage };
}

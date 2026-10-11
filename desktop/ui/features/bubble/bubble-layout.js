// Row grouping and editor normalization are pure data operations except
// that flatten/canonicalize intentionally update row keys on the supplied draft.
export function bubbleIsImgMod(m) { return !!m && (m.type === 'image' || m.type === 'randimg'); }
export function bubbleRowKeyOf(m) {
  try {
    m = m || ({});
    var n = m.row;
    if (typeof n === 'number' && isFinite(n) && Math.round(n) === n && n > 0) return n;
  } catch (err) {}
  return null;
}
export function bubbleRowsOf(mods) {
  var out = [];
  if (!Array.isArray(mods)) return out;
  var cur = null;
  for (var i = 0; i < mods.length; i++) {
    var m = mods[i] || ({});
    if (bubbleIsImgMod(m)) {
      out.push([m]);
      cur = null;
      continue;
    }
    if (cur && cur.key !== null && bubbleRowKeyOf(m) === cur.key) {
      cur.row.push(m);
      continue;
    }
    cur = {
      key: bubbleRowKeyOf(m),
      row: [m]
    };
    out.push(cur.row);
  }
  return out;
}
export function bubbleRowsFlat(rows) {
  var flat = [];
  try {
    if (!Array.isArray(rows)) return flat;
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (!row || !row.length) continue;
      var multi = row.length > 1;
      for (var i = 0; i < row.length; i++) {
        var m = row[i];
        if (!m || typeof m !== 'object') continue;
        if (multi) m.row = r + 1; else try {
          delete m.row;
        } catch (err) {}
        flat.push(m);
      }
    }
  } catch (err) {}
  return flat;
}
export function bubbleRowsCanon(mods) {
  try {
    if (!Array.isArray(mods)) return;
    var flat = bubbleRowsFlat(bubbleRowsOf(mods));
    mods.length = 0;
    for (var i = 0; i < flat.length; i++) mods.push(flat[i]);
  } catch (err) {}
}

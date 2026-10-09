// Mevcut ayarlari bozmadan bir .ini bolumundeki anahtarlari ayarlar/ekler.
function setKeys(text, section, kv) {
  const lines = text ? text.split(/\r?\n/) : [];
  let start = lines.findIndex((l) => l.trim() === `[${section}]`);
  if (start === -1) {
    if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
    lines.push(`[${section}]`);
    start = lines.length - 1;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\[.+\]$/.test(lines[i].trim())) { end = i; break; }
  }
  for (const [k, v] of Object.entries(kv)) {
    const re = new RegExp('^\\s*' + k + '\\s*=', 'i');
    let idx = -1;
    for (let i = start + 1; i < end; i++) if (re.test(lines[i])) { idx = i; break; }
    const line = `${k} = ${v}`;
    if (idx >= 0) lines[idx] = line;
    else {
      let at = end;
      while (at > start + 1 && lines[at - 1].trim() === '') at--; // bos satirlarin ustune ekle
      lines.splice(at, 0, line);
      end++;
    }
  }
  return lines.join('\n');
}

// Ayni anahtardan birden fazla satir ekler (ornek: [Patches] icinde Enable = ... satirlari).
function addValues(text, section, key, values) {
  const lines = text ? text.split(/\r?\n/) : [];
  let start = lines.findIndex((l) => l.trim() === `[${section}]`);
  if (start === -1) {
    if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
    lines.push(`[${section}]`);
    start = lines.length - 1;
  }
  let end = lines.length;
  for (let n = start + 1; n < lines.length; n++) if (/^\[.+\]$/.test(lines[n].trim())) { end = n; break; }
  const have = new Set();
  for (let n = start + 1; n < end; n++) {
    const m = lines[n].match(new RegExp('^\\s*' + key + '\\s*=\\s*(.*?)\\s*$', 'i'));
    if (m) have.add(m[1]);
  }
  let at = end;
  while (at > start + 1 && lines[at - 1].trim() === '') at--;
  const add = values.filter((v) => !have.has(v)).map((v) => `${key} = ${v}`);
  lines.splice(at, 0, ...add);
  return lines.join('\n');
}

module.exports = { setKeys, addValues };

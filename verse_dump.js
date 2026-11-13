// 取某品全部颂原文（一行一颂，两句合并）。node verse_dump.js <品号>
const fs = require('fs');
const ch = process.argv[2] || '1';
const L = fs.readFileSync('./references/20-全文.md', 'utf8').replace(/\r\n/g, '\n').split('\n');
const out = [];
let cur = null;
for (const ln of L) {
  const h = ln.match(/^\*\*([1-9])\.(\d+)\*\*\s*(.*)$/);
  if (h) { if (h[1] === ch) cur = [h[1] + '.' + h[2], h[3].trim()]; else cur = null }
  else if (cur) { if (!ln.trim()) { out.push(cur.join('　')); cur = null } else cur[1] += ' ' + ln.trim() }
}
if (cur) out.push(cur.join('　'));
out.forEach(x => console.log(x));
console.log('共', out.length, '颂');

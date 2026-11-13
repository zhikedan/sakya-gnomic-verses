// 白话全书校验：颂文逐字一致 + 每颂配一行白话 + 无漏颂。
//   node check_baihua.js [品号]        校验某品（默认全部已写文件）
// 规则：文件里每颂写成「**1.2** 原文」+ 下一行「→ 白话：…」，原文须与 20-全文.md 完全一致。
const fs = require('fs'), path = require('path');
const { readVerses } = require('./verses');
const DIR = path.join(__dirname, '白话全书');
const SRC = readVerses().byCh;                    // 每品 -> { "1.2": "两句合并" }
const norm = s => (s || '').replace(/[\s，。、；：！？""'']|,|\./g, '');
const only = process.argv[2];
const files = fs.readdirSync(DIR).filter(f => /^\d\d-.*\.md$/.test(f)).sort().filter(f => !only || f.startsWith('0' + only));
if (!files.length) { console.log('没有待校验文件'); process.exit(1) }

// 一品可拆多文件（如第八品上/下），按品合并统计，否则会把下半算成"漏颂"
let total = 0, bad = 0;
const byCh = {};
for (const f of files) {
  const ch = f.match(/^0?(\d)/)[1];
  const txt = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
  (byCh[ch] = byCh[ch] || { got: new Set(), errs: [], srcs: [] }).srcs.push(f);
  const g = byCh[ch];
  for (const m of txt.matchAll(/^\*\*([1-9]\.\d+)\*\*\s*([^\n]+)\n(→[^\n]*)/gm)) {
    const id = m[1];
    if (g.got.has(id)) { g.errs.push(`${id} 在多个文件中重复`); continue }
    g.got.add(id); total++;
    const src = norm(SRC[ch][id]), mine = norm(m[2]);
    if (!src) g.errs.push(`${id} 原文里没有这个编号`);
    else if (src !== mine) g.errs.push(`${id} 颂文与原文不符\n     原文: ${SRC[ch][id]}\n     本文: ${m[2].trim()}`);
    else if (!/^→\s*白话[：:]/.test(m[3])) g.errs.push(`${id} 白话行没以「→ 白话：」开头`);
    else if (m[3].replace(/^→\s*白话[：:]/, '').trim().length < 8) g.errs.push(`${id} 白话太短`);
  }
}
for (const ch of Object.keys(byCh).sort()) {
  const g = byCh[ch], all = Object.keys(SRC[ch]);
  const missing = all.filter(id => !g.got.has(id));
  if (missing.length) g.errs.push(`漏颂 ${missing.length} 个：${missing.join(' ')}`);
  console.log(`${g.srcs.join(' + ')}  ${g.got.size}/${all.length} 颂` + (g.errs.length ? `\n  !! ${g.errs.join('\n  ')}` : '  ✓'));
  bad += g.errs.length;
}
console.log(`\n共校验 ${total} 颂，问题 ${bad} 处`);
process.exit(bad ? 1 : 0);

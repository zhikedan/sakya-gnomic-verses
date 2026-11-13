// 引用编号校验：references/ 里出现的每个「品.颂」都必须在 20-全文.md 真存在。
// node check_refs.js   ->  报告不存在 / 越界 / 品号错位的引用
const fs = require('fs'), path = require('path');
const REF = path.join(__dirname, 'references');
const full = fs.readFileSync(path.join(REF, '20-全文.md'), 'utf8');

const VALID = new Map();                       // "8.25" -> 该行颂文首句
for (const m of full.matchAll(/^\*\*([1-9])\.(\d+)\*\*\s*(.*)$/gm)) VALID.set(`${m[1]}.${m[2]}`, m[3].trim());
const CHMAX = {};
for (const k of VALID.keys()) { const [c] = k.split('.'); CHMAX[c] = Math.max(CHMAX[c] || 0, +k.split('.')[1]) }

const bad = [], counts = {};
for (const f of fs.readdirSync(REF).filter(x => x.endsWith('.md')).sort()) {
  const txt = fs.readFileSync(path.join(REF, f), 'utf8').replace(/\r\n/g, '\n');
  txt.split('\n').forEach((ln, i) => {
    if (f === '20-全文.md' && /^\*\*[1-9]\.\d+\*\*/.test(ln)) return;         // 全文自身的编号行不算引用
    for (const m of ln.matchAll(/(?<![\d.])([1-9])\.(\d{1,3})(?![\d.])/g)) {
      const id = m[1] + '.' + m[2], at = `${f}:${i + 1}`;
      counts[id] = (counts[id] || 0) + 1;
      if (VALID.has(id)) continue;
      const why = !CHMAX[m[1]] ? '该品无颂文' : +m[2] > CHMAX[m[1]] ? `超出第${m[1]}品最大颂号 ${CHMAX[m[1]]}` : '编号不存在';
      bad.push({ id, at, why, ln: ln.trim().slice(0, 70) });
    }
  });
}

console.log(`合法颂号 ${VALID.size} 个｜各品上限 ${Object.entries(CHMAX).sort((a,b)=>a[0]-b[0]).map(([c,v])=>c+':'+v).join(' ')}`);
console.log(`被引用 ${Object.keys(counts).length} 个不同编号，共 ${Object.values(counts).reduce((a,b)=>a+b,0)} 次`);
if (bad.length) {
  console.log(`\n!! 无效引用 ${bad.length} 处：`);
  bad.slice(0, 40).forEach(b => console.log(`  ${b.id}  ${b.why}  @ ${b.at}  「${b.ln}」`));
  if (bad.length > 40) console.log(`  …另 ${bad.length - 40} 处`);
} else console.log('\n引用编号全部有效');

// 覆盖盲区仅供参考：精解的「偈颂一览」用序号而非 品.颂，所以这里只统计"被按编号引用过"的颂
const never = [...VALID.keys()].filter(k => !counts[k]);
console.log(`按编号引用过 ${Object.keys(counts).length} 颂；其余 ${never.length} 颂仅见于全文与一览（未逐颂释义，非缺失）`);

// 中英混杂：中文语境里夹带的未翻译英文词。行内代码/路径已剥离，代码块内容同样检查。
const OK = new Set(['JSON','JS','API','Node','node','md','IP','UTF','CDN','PR','HTTP','ID','KPI','A','B','C','D','E','F']);
const zh = [];
const files = fs.readdirSync(REF).filter(x => x.endsWith('.md')).sort().map(f => path.join(REF, f));
files.push(path.join(__dirname, 'SKILL.md'));                                  // 规范本身也要干净
for (const fp of files) {
  const rel = path.basename(fp), lines = fs.readFileSync(fp, 'utf8').replace(/\r\n/g, '\n').split('\n');
  // 命令行（npm/node/git… 开头）里的英文是标识符，跳过；代码块里的中文散文仍要查
  // —— 曾有一处真残留 death 就藏在 00-全书总览 的骨架代码块中，不能整块放过。
  const CMD = /^\s*(?:npm|node|npx|pnpm|yarn|git|gh|cd|python3?|mkdir|copy|del|rm|cp|mv|echo|cat|ls|dir|curl|wget|tar|ssh|#|\$|>)\b/i;
  lines.forEach((ln, i) => {
    if (/^\s*(```|~~~)/.test(ln)) return;                                     // 围栏行本身跳过
    if (CMD.test(ln)) return;
    // 行内代码、路径、裸文件名（record.js / 问答记录.html）里的英文是标识符，不是残留；目录树行同理
    const bare = ln.replace(/`[^`]*`/g, ' ').replace(/[\w.-]+\/[\w./-]+/g, ' ')
      .replace(/[\w一-龥-]+\.(md|js|html|json|txt|py|css|bat)\b/gi, ' ');
    if (/[├└│─]/.test(bare)) return;
    for (const m of bare.matchAll(/[一-龥][^\n]*?[A-Za-z]{3,}[^\n]*?[一-龥]/g)) {
      for (const w of m[0].matchAll(/[A-Za-z]{3,}/g)) {
        if (OK.has(w[0])) continue;
        zh.push(`${rel}:${i + 1}  ${w[0]}  「${ln.trim().slice(0, 64)}」`);
      }
    }
  });
}
console.log(zh.length ? `\n!! 疑似未翻译残留 ${zh.length} 处：\n  ` + [...new Set(zh)].join('\n  ') : '\n未发现未翻译残留');

// 路由表 / 正文里提到的 references 文件名必须真实存在（防止文档指向已删文件）
// 注意：不要用 (?!\.md) 之类的先行断言——贪婪失败会回溯截断，把「观察学者」报成「观察愚」
const have = new Set(fs.readdirSync(REF));
const skill = fs.readFileSync(path.join(__dirname, 'SKILL.md'), 'utf8');
const refs = [...new Set([...skill.matchAll(/\d{2}-[一-龥A-Za-z0-9-]+/g)].map(m => m[0]))];
const miss = refs.filter(x => !have.has(x + '.md'));
const mentioned = new Set(refs.map(x => x + '.md'));
const orphans = [...have].filter(f => f.endsWith('.md') && !mentioned.has(f));
console.log(miss.length ? `\n!! 文档指向不存在的文件：${miss.map(x => x + '.md').join(' ')}` : '\n文档引用的文件均存在');
console.log(orphans.length ? `注意：文档未提及的文件 ${orphans.join(' ')}` : 'references 无孤儿文件');

// 每品：全文颂号必须连续 1..N；精解「偈颂一览」必须覆盖全部 N 颂（一览用序号，不用 品.颂）
const per = {};
for (const m of full.matchAll(/^\*\*([1-9])\.(\d+)\*\*/gm)) (per[m[1]] = per[m[1]] || []).push(+m[2]);
const gaps = [];
for (const c of Object.keys(per).map(Number).sort()) {
  const n = per[c].length;
  if (per[c].join() !== Array.from({ length: n }, (_, i) => i + 1).join()) gaps.push(`第${c}品 全文颂号不连续`);
  const f = fs.readdirSync(REF).find(x => new RegExp('^0' + c + '-').test(x));
  if (!f) { gaps.push(`第${c}品 缺精解文件`); continue }
  const sec = (fs.readFileSync(path.join(REF, f), 'utf8').replace(/\r\n/g, '\n').split(/^## /m).find(s => /^二、偈颂一览/.test(s)) || '');
  const rows = [...new Set([...sec.matchAll(/^\|\s*(\d+)\s*\|/gm)].map(m => +m[1]))];
  const lack = []; for (let i = 1; i <= n; i++) if (!rows.includes(i)) lack.push(i);
  if (lack.length) gaps.push(`第${c}品 一览缺 ${lack.length} 颂：${lack.slice(0, 12).join(',')}`);
}
console.log(gaps.length ? `\n!! 覆盖问题：\n  ` + gaps.join('\n  ') : `\n九品颂号连续且一览全覆盖（共 ${VALID.size} 颂）`);

const assert = require('assert');
assert.strictEqual(bad.length, 0, '存在无效引用');
assert.ok(VALID.size >= 400, '全文解析异常');
assert.strictEqual(zh.length, 0, '存在未翻译残留');
assert.strictEqual(miss.length, 0, '文档指向不存在的文件：' + [...new Set(miss)].join(' '));
assert.strictEqual(gaps.length, 0, '颂号/一览覆盖不完整');
console.log('\nCHECK OK');

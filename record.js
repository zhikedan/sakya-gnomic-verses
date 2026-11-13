// 问答留痕：每次提问 + 按技能给出的回答，自动入库，重建台账 .md 与网页 .html。
//   node record.js commit [pending.txt]    入库（默认读 问答记录/pending.txt），随后删除它
//   node record.js done <编号> [备注]       标记该条「动作」已做到
//   node record.js undo <编号>              取消打勾
//   node record.js todo                     列出还没做到的动作（周复盘用）
//   node record.js stats                    提问分布 + 动作完成率
//   node record.js rebuild                  重建 .md 与 .html
//   node record.js selftest                 自检
// 抽取与统计逻辑全在 qa-core.js —— 网页内联同一份，不会两套漂移。
const fs = require('fs'), path = require('path');
const C = require('./qa-core');
const { readVerses } = require('./verses');

const DIR = path.join(__dirname, '问答记录');
const DB = path.join(DIR, 'qa.json'), MD = path.join(DIR, '问答记录.md');
const HTML = path.join(DIR, '问答记录.html'), PEND = path.join(DIR, 'pending.txt');
const TPL = path.join(__dirname, 'qa-template.html'), CORE = path.join(__dirname, 'qa-core.js');

// 书里真实存在的颂号：答案里写了不存在的编号，不进台账（唯一依据是 20-全文.md）
const VERSES = readVerses().all;
const VALID = new Set(Object.keys(VERSES));

const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));   // PowerShell 常写 BOM
function load() {
  if (!fs.existsSync(DB)) return [];
  try {
    const rows = readJson(DB);
    let migrated = 0;
    for (const r of rows) {                                                 // 旧记录补字段
      if (!r.dg) { r.dg = C.digest(r.q, r.a); migrated++ }
      if (!Array.isArray(r.verses)) { r.verses = []; migrated++ }
      if (!r.type) { r.type = C.pickType(r.a || ''); migrated++ }
      if (r.action === undefined) { r.action = C.pickAction(r.a || ''); migrated++ }
      const want = VALID.size >= 400 ? C.pickVerses(r.a || '', VALID) : null;  // 全文读不到时绝不重算（否则清空编号）
      if (want && want.join() !== r.verses.join()) { r.verses = want; migrated++ }
    }
    if (migrated && !process.env.QUIET) { console.log(`已迁移 ${migrated} 项旧记录字段`); save(rows) }
    return rows;
  } catch (e) {                                                             // 宁可停住，也不能静默清空历史
    const bad = DB + '.bad-' + Date.now();
    fs.copyFileSync(DB, bad);
    console.log('qa.json 解析失败，已备份到 ' + bad + '：' + e.message); process.exit(1);
  }
}
function save(rows) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(DB, JSON.stringify(rows, null, 1), 'utf8');
  buildMd(rows); buildHtml(rows);
}

const cell = (s, n) => (s || '').replace(/\|/g, '／').replace(/\s+/g, ' ').slice(0, n) || '—';
function buildMd(rows) {
  const s = C.stats(rows);
  const head = `# 萨迦格言 · 问答台账

> 共 ${s.total} 问 ｜ 有动作 ${s.act} 条 ｜ 已做到 ${s.done} 条（完成率 ${s.rate}%）
> 回看标准是「动作做到几条」，不是「读了多少颂」。逐条 \`node record.js done <编号>\` 打勾，\`node record.js todo\` 看欠账。
> 可视化版本见同目录 \`问答记录.html\`（双击浏览器打开）。

| # | 时间 | 问题 | 类型 | 所引颂 | 动作 | 状态 |
|---|---|---|---|---|---|---|
`;
  const tab = rows.map(r => `| ${r.n} | ${r.at.slice(5)} | ${cell(r.q, 22)} | ${r.type} | ${r.verses.join(' ') || '—'} | ${cell(r.action, 30)} | ${r.done ? '✅ ' + cell(r.note, 10) : '☐'} |`).join('\n');
  const body = rows.map(r => `\n\n---\n\n## ${r.n} · ${r.at} · ${r.type}${r.src && r.src !== '窗口' ? ' · ' + r.src : ''}\n\n**问**：${r.q}\n\n${r.a}\n` +
    (r.action ? `\n**动作**：${r.action} ${r.done ? '— 已做到' + (r.note ? '（' + r.note + '）' : '') : '— 待做'}\n` : '')).join('');
  fs.writeFileSync(MD, head + tab + body + '\n', 'utf8');
}

function buildHtml(rows, out = HTML) {
  const tpl = fs.readFileSync(TPL, 'utf8'), core = fs.readFileSync(CORE, 'utf8');
  const json = JSON.stringify({ rows, verses: VERSES }).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');
  fs.writeFileSync(out, tpl.replace('/*CORE*/', () => core).replace('/*DATA*/', () => 'const D = ' + json), 'utf8');
}

// 逐字校验：成段引用的颂（行首「8.25 …」）必须与 20-全文.md 完全一致，不许截半颂、不许改字。
// 约定一颂一行：只取本行，下一行的「→ 白话」不参与，避免正则吞行导致永远判为不符。
const norm = s => (s || '').replace(/[\s，。、；：！？""'']|,|\./g, '');
function verifyQuoted(a) {
  const out = [];
  for (const m of (a || '').matchAll(/^[ \t]*([1-9])\.(\d{1,3})[ \t]+([^\n]+)$/gm)) {
    const id = m[1] + '.' + m[2], wrote = norm(m[3]), src = norm(VERSES[id]);
    if (!src) { out.push(`${id} 编号不存在`); continue }
    if (!src.startsWith(wrote)) out.push(`${id} 字句不符（原文：${VERSES[id].replace(/\n/g, '')}）`);
    else if (wrote.length < src.length - 1) out.push(`${id} 只引了半颂（缺：${src.slice(wrote.length)}）`);
  }
  return out;
}

const cmd = process.argv[2];
// 待录入格式（pending.txt）：首行可写 "问：…"，其余整段视为答案。
// 不用 JSON —— 答案里常有英文引号，JSON.parse 会当场崩，且报错点离原因很远。
function readPending(f) {
  const raw = fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  const m = raw.match(/^问[：:]\s*(.+?)\n+答[：:]?\s*([\s\S]*)$/);
  if (m) return { q: m[1].trim(), a: m[2].trim() };
  const nl = raw.indexOf('\n');
  if (nl > 0 && nl < 80 && !/^[「【\d]/.test(raw)) return { q: raw.slice(0, nl).trim(), a: raw.slice(nl + 1).trim() };
  return { q: '', a: raw };
}
if (cmd === 'commit') {
  const f = process.argv[3] || PEND;
  if (!fs.existsSync(f)) { console.log('没有待录入文件：' + f); process.exit(1) }
  const { q, a } = readPending(f);
  if (!q || !a) { console.log('缺问题或答案（首行=问题，其余=答案）'); process.exit(1) }
  const row = C.mkRow({ q, a, src: '窗口', vs: VALID });
  const errs = verifyQuoted(row.a);
  if (errs.length && !process.argv.includes('--half')) {
    console.log('颂文校验未通过（须引全颂，两句都要）：');
    errs.forEach(e => console.log('  ' + e));
    console.log('  确实只需半颂且不改原意时，加 --half 放行。');
    process.exit(1);
  }
  const all = [...new Set(C.verseCandidates(row.a).filter(x => VALID.has(x)))];
  const ghost = [...new Set(C.verseCandidates(row.a).filter(x => !VALID.has(x)))];   // 与 pickVerses 同一套边界判断
  const { rows, added } = C.merge(load(), [row]);
  if (!added) { console.log('已存在相同问答，未重复记录'); if (!process.argv[3] && fs.existsSync(PEND)) fs.unlinkSync(PEND); process.exit(0) }
  save(rows);
  if (!process.argv[3]) fs.unlinkSync(PEND);
  const got = rows.find(x => x.dg === row.dg);                 // merge 返回的是拷贝，row.n 仍是 0
  const cov = C.baiCoverage(got.a, VALID);
  console.log(`已记 #${got.n} | ${got.type} | 颂 ${got.verses.join(' ') || '—'} | 白话 ${cov.bai}/${cov.verses} | 动作${got.action ? '已提取' : '缺失'}`);
  if (!got.action) console.log('  提醒：答案没有「动作：」行，这条无法验收。');
  if (cov.bai < cov.verses) console.log(`  提醒：引了 ${cov.verses} 颂只给了 ${cov.bai} 行白话（规范第7条要求逐颂配白话）。`);
  if (all.length > got.verses.length) console.log(`  提醒：共 ${all.length} 个编号，台账只留前 ${got.verses.length} 个（引太多＝堆砌）。`);
  if (ghost.length) console.log('  提醒：答案里这些编号书中不存在，已剔除：' + ghost.join(' '));
} else if (cmd === 'revise') {
  // 按编号替换答案（补白话、改措辞用），保留已打勾状态，不新增条目
  const rows = load(), r = rows.find(x => x.n === +process.argv[3]);
  if (!r) { console.log('无此编号'); process.exit(1) }
  const f = process.argv[4] || PEND;
  if (!fs.existsSync(f)) { console.log('没有新答案文件：' + f); process.exit(1) }
  const { a } = readPending(f);
  if (!a) { console.log('没有新答案'); process.exit(1) }
  const before = r.dg;
  const errs = verifyQuoted(a.trim());
  if (errs.length && !process.argv.includes('--half')) {
    console.log('颂文校验未通过（须引全颂，两句都要）：');
    errs.forEach(e => console.log('  ' + e));
    console.log('  确实只需半颂且不改原意时，加 --half 放行。原条目未改动。');
    process.exit(1);
  }
  r.a = a.trim(); r.dg = C.digest(r.q, r.a);
  r.type = C.pickType(r.a); r.verses = C.pickVerses(r.a, VALID); r.action = C.pickAction(r.a);
  save(rows);
  if (!process.argv[4] && fs.existsSync(PEND)) fs.unlinkSync(PEND);
  const cov = C.baiCoverage(r.a, VALID);
  console.log(`#${r.n} 已修订（状态${r.done ? '保留：已做到' : '仍待做'}）| 颂 ${r.verses.join(' ') || '—'} | 白话 ${cov.bai}/${cov.verses}`);
  if (before === r.dg) console.log('  内容与原来相同，未产生变化。');
} else if (cmd === 'done') {
  const rows = load(), r = rows.find(x => x.n === +process.argv[3]);
  if (!r) { console.log('无此编号'); process.exit(1) }
  r.done = true; r.note = (process.argv[4] || '').trim(); save(rows); console.log(`#${r.n} 已打勾`);
} else if (cmd === 'undo') {
  const rows = load(), r = rows.find(x => x.n === +process.argv[3]);
  if (r) { r.done = false; r.note = ''; save(rows); console.log(`#${r.n} 取消打勾`) } else console.log('无此编号');
} else if (cmd === 'todo') {
  const rows = load().filter(r => !r.done && r.action);
  console.log(rows.length ? rows.map(r => `#${r.n} [${r.type}] ${r.at.slice(0, 10)}\n   ${r.q}\n   动作：${r.action}`).join('\n') : '没有欠账，全部做到。');
} else if (cmd === 'stats') {
  const rows = load(), s = C.stats(rows);
  const cov = rows.map(r => ({ n: r.n, ...C.baiCoverage(r.a, VALID) }));
  const noBai = cov.filter(c => c.bai < c.verses);
  console.log(`提问 ${s.total} 条 ｜ 类型 ${JSON.stringify(s.by)}`);
  console.log(`动作 ${s.done}/${s.act} 做到 = ${s.rate}%`);
  console.log(`各品被引 ${JSON.stringify(s.verses)}`);
  console.log(noBai.length ? `白话不全 ${noBai.length} 条：` + noBai.map(c => `#${c.n}(${c.bai}/${c.verses})`).join(' ') : '白话覆盖：全部逐颂配齐');
} else if (cmd === 'rebuild') { const rows = load(); save(rows); console.log(`已重建 ${rows.length} 条：qa.json / 问答记录.md / 问答记录.html`) }
else if (cmd === 'selftest') {
  const assert = require('assert');
  assert.ok(VALID.size >= 400, '全文解析异常');
  assert(VERSES['8.25'] && VERSES['8.25'].includes('柔和'), '颂文映射失败');
  const a1 = '「看人」问题。\n\n4.8 圣士观察自过失。\n4.99 不存在的编号。\n\n动作：拒一次请求。';
  const r = C.mkRow({ q: 'x', a: a1, vs: VALID });
  assert(r.type === '看人' && r.action === '拒一次请求。');
  assert(r.verses.includes('4.8') && !r.verses.includes('4.99'), '无效编号未被剔除：' + r.verses);
  assert(C.merge([r], [C.mkRow({ q: 'x', a: a1, vs: VALID })]).added === 0, '去重失败');
  assert(fs.existsSync(TPL) && fs.readFileSync(TPL, 'utf8').includes('/*CORE*/'), '模板缺占位符');
  // 颂文逐字校验：全颂通过、半颂报错、改字报错、不存在报错
  assert(verifyQuoted('9.51 ' + VERSES['9.51'].replace('\n', '')).length === 0, '全颂应通过');
  assert(verifyQuoted('9.51 自己所需诸论典，每日之中记一句，\n→ 白话：x').some(e => e.includes('半颂')), '半颂必须报错');
  assert(verifyQuoted('9.51 自己所需诸论典，每天之中记一句，如同蜂蜜及蚁窝，不久即将成智者。').some(e => e.includes('字句不符')), '改字必须报错');
  assert(verifyQuoted('9.99 随便编的一句颂文啊，再来半句凑成行。').some(e => e.includes('不存在')), '假编号必须报错');
  assert(verifyQuoted('没有成段引用，只在行文里提到 9.51。').length === 0, '行文提及不该被校验');
  const tmp = path.join(require('os').tmpdir(), 'sakya-qa-selftest.html');        // 不污染真实台账
  buildHtml([r], tmp);
  const h = fs.readFileSync(tmp, 'utf8');
  assert(h.includes('拒一次请求') && h.includes('4.8') && !h.includes('/*CORE*/') && !h.includes('/*DATA*/'), '网页生成不完整');
  assert(h.includes('function pickVerses'), '内核未内联');
  fs.unlinkSync(tmp);
  console.log('record 自检 OK（编号校验 + 剔除 + 去重 + 网页生成，未写入真实台账）');
} else {
  console.log('用法: commit [pending.txt] | done <编号> [备注] | undo <编号> | todo | stats | rebuild | selftest');
}

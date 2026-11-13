// 问答留痕的共用内核 —— 桌面 record.js 与网页版都用这一份，避免两套逻辑各写各的。
// 纯逻辑，不碰文件系统也不碰 DOM；浏览器里由 build.js 原样内联。

// 「看人/看己/做事/修心」——答案正文里必须点明，抽不出来就记为「—」
const pickType = a =>
  (a.match(/「(看人|看己|做事|修心)」/) || [])[1] ||
  (/(看人|看己|做事|修心)/.exec(a) || [])[1] || '—';

// 颂号候选：形如 8.25，避开 "203.0.113.7" 这类 IP/版本号（前后紧邻数字或点的一律不算）
function verseCandidates(a) {
  const out = [], re = /[1-9]\.\d{1,3}/g;
  let m;
  while ((m = re.exec(a))) {
    const b = a[m.index - 1], f = a[m.index + m[0].length];
    if (/[0-9.]/.test(b === undefined ? '' : b) || /[0-9.]/.test(f === undefined ? '' : f)) continue;
    out.push(m[0]);
  }
  return out;
}

// 颂号：给了 valid 集合则只保留书里真存在的编号。上限 12 —— 一条回答极少引这么多，
// 再多是堆砌；被截断时由调用方提示，不静默丢弃。
const VMAX = 12;
function pickVerses(a, valid) {
  const out = [];
  for (const id of verseCandidates(a)) if (!out.includes(id) && (!valid || valid.has(id))) out.push(id);
  return out.slice(0, VMAX);
}

// 动作：取最后一处「动作：」到该段结束（后面若另起段落不混进来）
function pickAction(a) {
  const i = Math.max(a.lastIndexOf('动作：'), a.lastIndexOf('动作:'));
  if (i < 0) return '';
  let t = a.slice(i).replace(/^动作[：:]\s*/, '');
  const stop = t.search(/\n\s*\n/);
  if (stop >= 0) t = t.slice(0, stop);
  return t.replace(/\s+/g, ' ').trim();
}

// 白话行：以「→ 白话：」或「→ 」开头紧跟文本的行。规范第7条要求每颂配一行。
const countBai = a => ((a || '').match(/^\s*(?:→|->)\s*\S+/gm) || []).length;
// 成段引用的颂：编号出现在行首（如「8.77 若欲降伏…」）。行文里顺带点到的编号不算，
// 否则正文中"8.93 火烧茂林靠风"这类提及会被误判成"有颂没译"。
function quotedVerses(a, valid) {
  const out = [];
  for (const m of (a || '').matchAll(/^[ \t]*([1-9]\.\d{1,3})[ \t]/gm)) {
    if (valid && !valid.has(m[1])) continue;
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}
// 覆盖检查：成段引用几颂、给了几行白话
function baiCoverage(a, valid) {
  return { verses: quotedVerses(a, valid).length, bai: countBai(a) };
}

const stamp = (d = new Date()) => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// FNV-1a：问答去重与跨设备合并的键
function digest(q, a) {
  const s = (q || '').replace(/\s+/g, '') + '␟' + (a || '').replace(/\s+/g, '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16);
}

function mkRow({ q, a, src = '窗口', n = 0, at = stamp(), vs }) {
  return {
    n, at, q: (q || '').trim(), a: (a || '').trim(),
    type: pickType(a || ''), verses: pickVerses(a || '', vs), action: pickAction(a || ''),
    done: false, note: '', src, dg: digest(q, a),
  };
}

// 按 dg 合并；incoming 的 done/note 覆盖旧值（谁打勾都只打一次）。
// 编号只是显示用，身份是 dg —— 外来条目自带的 n 一律忽略，避免两台设备各自的 1、2 撞号。
function merge(base, incoming) {
  const by = new Map(base.map(r => [r.dg || digest(r.q, r.a), r]));
  const order = base.map(r => r.dg || digest(r.q, r.a));
  let added = 0;
  for (const r of incoming) {
    const k = r.dg || digest(r.q, r.a), old = by.get(k);
    if (!old) { by.set(k, { ...r, dg: k, done: !!r.done }); order.push(k); added++ }
    else if (r.done && !old.done) { old.done = true; old.note = r.note || old.note }
  }
  const out = order.map(k => by.get(k));
  out.forEach((r, i) => r.n = i + 1);
  return { rows: out, added };
}

const stats = rows => {
  const by = {}, v = {};
  rows.forEach(r => { by[r.type] = (by[r.type] || 0) + 1; r.verses.forEach(x => v[x[0]] = (v[x[0]] || 0) + 1) });
  const w = rows.filter(r => r.action), d = w.filter(r => r.done);
  return { total: rows.length, by, verses: v, act: w.length, done: d.length, rate: w.length ? Math.round(d.length / w.length * 100) : 0 };
};

if (typeof module !== 'undefined') module.exports = { pickType, pickVerses, verseCandidates, quotedVerses, pickAction, countBai, baiCoverage, stamp, digest, mkRow, merge, stats };

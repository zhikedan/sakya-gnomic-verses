// 合并白话全书为单文件 + 生成索引。node build_baihua.js
const fs = require('fs'), path = require('path');
const { CN, NAME, TOTAL } = require('./chapters');
const DIR = path.join(__dirname, '白话全书');
const files = fs.readdirSync(DIR).filter(f => /^\d\d-.*\.md$/.test(f)).sort();
const titles = files.map(f => {
  const n = +f.slice(0, 2), part = /-上/.test(f) ? '（上）' : /-下/.test(f) ? '（下）' : '';
  return `第${CN[n - 1]}品 ${NAME[n]}${part}`;
});
const body = files.map((f, i) => {
  const t = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n')
    .replace(/^#[^\n]*\n/, '')                                     // 去掉各分文件自己的大标题
    .replace(/^>[^\n]*\n/gm, '')                                    // 去掉体例说明，只留正文
    .trim();
  const n = (t.match(/^\*\*[1-9]\.\d+\*\*/gm) || []).length;
  return `\n\n---\n\n# ${titles[i]}　（${n} 颂）\n\n${t}`;
});
const all = files.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('');
const head = `# 《萨迦格言》原文·白话 全本

> 萨迦班智达·贡噶坚赞（1182—1251）造 · 九品 ${TOTAL} 颂
> 体例：每颂一行原文、一行「→ 白话」。白话只做直译＋喻体落地，不加感悟、不掺解释；义理判断见各品精解与 SKILL.md。
> 颂文逐字比对 \`references/20-全文.md\`，校验：\`node check_baihua.js\`（459/459 通过）
> 编号「品.颂」，如 8.25 = 第八品第 25 颂。

## 目录

| 品 | 名 | 颂数 |
|---|---|---|
`;
const per = {};
for (const m of all.matchAll(/^\*\*([1-9])\.(\d+)\*\*/gm)) per[m[1]] = (per[m[1]] || 0) + 1;
const toc = Object.keys(per).map(c => `| 第${CN[c - 1]}品 | ${NAME[c]} | ${per[c]} |`).join('\n');
fs.writeFileSync(path.join(DIR, '萨迦格言-原文白话全本.md'), head + toc + body.join('') + '\n', 'utf8');
console.log('已生成 萨迦格言-原文白话全本.md', Math.round(fs.statSync(path.join(DIR, '萨迦格言-原文白话全本.md')).size / 1024) + ' KB');

// —— 单文件网页版：搜索 + 按品筛选，离线可读 ——
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const items = [];
for (const f of files) {
  const n = +f.slice(0, 2);
  for (const m of fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n')
    .matchAll(/^\*\*([1-9]\.\d+)\*\*\s*([^\n]+)\n→\s*白话[：:]\s*([^\n]+)/gm)) {
    items.push({ id: m[1], ch: n, v: m[2].trim(), b: m[3].trim() });
  }
}
const data = JSON.stringify(items).replace(/</g, '\\u003c');
const tpl = fs.readFileSync(path.join(__dirname, 'baihua-template.html'), 'utf8');
const sub = `萨迦班智达·贡噶坚赞 · 九品 ${TOTAL} 颂 ｜ 每颂原文＋白话；白话只做直译与喻体落地，义理判断见问答台账`;
fs.writeFileSync(path.join(DIR, '萨迦格言-原文白话全本.html'),
  tpl.replace('/*SUBTITLE*/', () => sub)
     .replace('/*DATA*/', () => 'const D = ' + data)
     .replace('/*NAMES*/', () => 'const NM = ' + JSON.stringify(NAME)), 'utf8');

// 同一份内容再落一个 ASCII 名到仓库根：GitHub Pages 直接可读，URL 不含中文转义。
// 由本脚本生成，不手工复制，避免两份漂移；CI 每次重建并校验无差异。
fs.copyFileSync(path.join(DIR, '萨迦格言-原文白话全本.html'), path.join(__dirname, 'index.html'));
console.log('已生成 萨迦格言-原文白话全本.html', Math.round(fs.statSync(path.join(DIR, '萨迦格言-原文白话全本.html')).size / 1024) + ' KB', '| 颂条目', items.length);

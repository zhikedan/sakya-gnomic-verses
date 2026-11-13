// commit 端到端回归：在临时目录跑，不碰真实台账。node test_commit.js
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const ROOT = __dirname;
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'sakya-commit-'));
const assert = require('assert');
const run = (...a) => {
  try { return { out: execFileSync('node', a, { cwd: T, encoding: 'utf8' }).trim(), code: 0 } }
  catch (e) { return { out: (e.stdout || '') + (e.stderr || ''), code: e.status || 1 } }
};
const ok = (...a) => run(...a).out;

// 复制运行时依赖：record.js 及其 require 的本地模块、网页模板。
// 用「顶层 .js + 模板」而非硬编码清单，避免以后新增依赖又漏掉。
for (const f of fs.readdirSync(ROOT)) {
  if (/\.(js|html)$/.test(f) && !/^test_/.test(f)) fs.copyFileSync(path.join(ROOT, f), path.join(T, f));
}
fs.mkdirSync(path.join(T, 'references'));
fs.copyFileSync(path.join(ROOT, 'references', '20-全文.md'), path.join(T, 'references', '20-全文.md'));
fs.mkdirSync(path.join(T, '问答记录'));
const pend = (q, a) => fs.writeFileSync(path.join(T, '问答记录', 'pending.txt'), '问：' + q + '\n\n答：\n' + a, 'utf8');

// 全颂原文（校验器要求两句都引全）
const V48 = '4.8 圣士观察自过失，劣者观察他过失，孔雀观察自身体，鸱鸮给人起恶兆。';
const V638 = '6.38 弱者发怒有何用？强者为何起嗔恚？是故为办事务时，若生嗔恨即自焚。';
const V825 = '8.25 柔和既能胜柔和，柔和又能胜粗暴，柔和能成一切故，智者皆云柔最利。';
const V93 = '9.3 何人稍财能知足，彼者财富用不尽，若无知足求财者，恒临痛苦如雨水。';

// 1) 首条编号必须是 1（曾经打印 #0 的回归点）
pend('测试问题一', '「看人」问题。\n\n' + V48 + '\n\n动作：拒一次请求。');
let r = run('record.js', 'commit');
console.log('1 首条 ->', r.out.split('\n')[0]);
assert(r.code === 0 && /已记 #1 /.test(r.out), '首条应 #1 且成功：' + r.out);
assert(!fs.existsSync(path.join(T, '问答记录', 'pending.txt')), 'pending 应被删除');

// 1b) 答案含英文引号不得崩（JSON 时代的回归点）
pend('测试问题引号', '「看己」问题。\n\n' + V638 + '\n\n要保证的不是"今天很猛"，是"每天都有"。\n\n动作：写"暂不做清单"。');
r = run('record.js', 'commit');
console.log('1b 英文引号 ->', r.out.split('\n')[0]);
assert(r.code === 0 && /已记 #2 /.test(r.out), '含引号应入库：' + r.out);
assert(ok('record.js', 'todo').includes('暂不做清单'), '引号内容应完整保留');

// 2) 半颂引用必须被拒绝入库（截断处须是原文的真实前缀，才会判为"半颂"而非"字句不符"）
pend('测试半颂', '「做事」问题。\n\n8.25 柔和既能胜柔和，柔和又能胜粗暴，\n\n动作：写三行。');
r = run('record.js', 'commit');
console.log('2 半颂 ->', r.out.replace(/\n/g, ' ⏎ ').slice(0, 120));
assert(r.code !== 0 && r.out.includes('半颂'), '半颂必须拒绝：' + r.out);
assert(ok('record.js', 'stats').includes('提问 2 条'), '被拒的不得入库');

// 2b) 改字必须被拒绝
pend('测试改字', '「做事」问题。\n\n8.25 柔和既能胜柔和，柔和又能胜粗暴，柔和能成一切故，智者皆云柔最锋利。\n\n动作：写三行。');
r = run('record.js', 'commit');
console.log('2b 改字 ->', r.out.replace(/\n/g, ' ⏎ ').slice(0, 100));
assert(r.code !== 0 && r.out.includes('字句不符'), '改字必须拒绝：' + r.out);

// 3) 编造编号必须被拒绝入库
pend('测试编造', '「做事」问题。\n\n4.99 书中根本不存在的一句。\n\n动作：x。');
r = run('record.js', 'commit');
console.log('3 编造编号 ->', r.out.replace(/\n/g, ' ⏎ ').slice(0, 100));
assert(r.code !== 0 && r.out.includes('不存在'), '编造编号必须拒绝：' + r.out);

// 4) 重复提交：不新增
pend('测试问题一', '「看人」问题。\n\n' + V48 + '\n\n动作：拒一次请求。');
r = run('record.js', 'commit');
console.log('4 重复 ->', r.out.split('\n')[0]);
assert(r.out.includes('未重复记录'), '去重失效：' + r.out);

// 5) 无动作行：入库但提醒
pend('测试问题无动作', '「修心」问题。\n\n' + V93);
r = run('record.js', 'commit');
console.log('5 无动作 ->', r.out.replace(/\n/g, ' ⏎ '));
assert(r.code === 0 && r.out.includes('动作缺失'), '应入库并提醒：' + r.out);
assert(r.out.includes('白话 0/1'), '应报白话缺口：' + r.out);

// 6) done/undo/todo。此时 #1 #2 有动作，#3 无动作
ok('record.js', 'done', '1', '已拒');
const todo1 = ok('record.js', 'todo');
assert(todo1.includes('#2') && !todo1.includes('#1') && !todo1.includes('#3'), 'todo 应只剩 #2：\n' + todo1);
console.log('6 todo ->', todo1.split('\n')[0]);
assert(ok('record.js', 'undo', '1').includes('#1'), 'undo 应回报编号');
assert(ok('record.js', 'stats').includes('动作 0/2'), 'undo 后应回落：' + ok('record.js', 'stats'));

// 7) 网页与 md 同步
const html = fs.readFileSync(path.join(T, '问答记录', '问答记录.html'), 'utf8');
assert(html.includes('测试问题引号') && html.includes('暂不做清单') && html.includes('柔和既能胜柔和'), '网页未含新记录');
assert(html.includes('测试问题无动作') && html.includes('无法验收'), '无动作条目应给出提示');
assert(fs.readFileSync(path.join(T, '问答记录', '问答记录.md'), 'utf8').includes('| 3 |'), 'md 表格未更新到 3 条');
console.log('7 网页/md 同步 OK');

// 8) qa.json 损坏时不得静默清空
const db = path.join(T, '问答记录', 'qa.json');
fs.writeFileSync(db, '{broken');
r = run('record.js', 'stats');
assert(r.code !== 0, '损坏时应报错退出');
assert(fs.readFileSync(db, 'utf8') === '{broken', '损坏文件不应被覆盖');
assert(fs.readdirSync(path.join(T, '问答记录')).some(f => f.startsWith('qa.json.bad-')), '应留下备份');
console.log('8 损坏保护 OK');

fs.rmSync(T, { recursive: true, force: true });
console.log('\ncommit 端到端回归全部通过');

// 统一自检入口：npm test / node selftest.js
// 只跑不依赖外部环境的检查；需要无头浏览器的交互测试（test_qa_web.js /
// test_baihua_web.js）单独运行，失败不阻塞。
const { execFileSync } = require('child_process');
const path = require('path');

const steps = [
  ['白话全书：逐字一致 + 白话配齐', 'check_baihua.js'],
  ['内容体检：引用编号 / 翻译残留 / 一览覆盖', 'check_refs.js'],
  ['内核自检：抽取 / 合并 / 去重 / 统计', 'test_core.js'],
  ['record 自检：编号校验 + 网页生成', 'record.js', 'selftest'],
  ['问答入库端到端（临时目录，不碰真实台账）', 'test_commit.js'],
];

let fail = 0;
for (const [name, file, ...args] of steps) {
  try {
    const out = execFileSync('node', [path.join(__dirname, file), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const last = out.trim().split('\n').filter(Boolean).pop() || 'OK';
    console.log(`  ✓ ${name}\n      ${last.slice(0, 100)}`);
  } catch (e) {
    fail++;
    const msg = ((e.stdout || '') + (e.stderr || '')).trim().split('\n').slice(-4).join(' | ');
    console.log(`  ✗ ${name}\n      ${msg.slice(0, 300)}`);
  }
}
console.log(fail ? `\n${fail} 项失败` : '\n全部通过 ✓');
console.log('提示：浏览器交互测试需另跑 node test_qa_web.js / node test_baihua_web.js（需本地无头浏览器）。');
process.exit(fail ? 1 : 0);

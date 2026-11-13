// qa-core 自检：node test_core.js
const C = require('./qa-core');
const a = console.assert, V = new Set(['4.8', '8.25', '9.33']);

a(C.pickType('「看人」问题，主看第四品') === '看人');
a(C.pickType('这是修心层面的事') === '修心');
a(C.pickType('随便一句') === '—');

a(JSON.stringify(C.pickVerses('4.8 与 8.25，再引 4.8')) === JSON.stringify(['4.8', '8.25']), C.pickVerses('4.8 8.25 4.8'));
a(JSON.stringify(C.pickVerses('见 4.8，另见 4.99', V)) === JSON.stringify(['4.8']), 'valid 集合要过滤不存在的编号');
a(C.pickVerses('地址 203.0.113.7 不是颂号').length === 0, 'IP 误判：' + C.pickVerses('地址 203.0.113.7'));
a(C.pickVerses('版本 1.2.3 不是颂号').length === 0, '版本号误判');
a(C.pickVerses('8.25 在句末').includes('8.25'));
// ghost 检测必须与 pickVerses 同一套边界：IP 里的片段不得被当成"书中不存在的编号"
a(C.verseCandidates('服务器 203.0.113.7 上线').join() === '', 'candidates 泄漏 IP 片段：' + C.verseCandidates('服务器 203.0.113.7 上线'));
a(C.verseCandidates('见 4.8 与 4.99，另 1.2.3').join() === '4.8,4.99', 'candidates 错：' + C.verseCandidates('见 4.8 与 4.99，另 1.2.3'));
// 上限 12：第 13 个应被截掉（旧值 8 会静默丢编号）
const many = Array.from({ length: 14 }, (_, i) => `8.${i + 1}`).join(' ');
a(C.pickVerses(many).length === 12, '上限应为 12，实为 ' + C.pickVerses(many).length);
a(C.pickVerses(many).join().startsWith('8.1,8.2'), '顺序应保留出现次序');

a(C.pickAction('前言\n\n动作：本周拒一次请求。\n\n别的段落') === '本周拒一次请求。', JSON.stringify(C.pickAction('前言\n\n动作：本周拒一次请求。\n\n别的段落')));
a(C.pickAction('动作：只有一行到底') === '只有一行到底');
a(C.pickAction('没有动作行') === '');

a(C.digest('甲', '乙') === C.digest('甲', '乙') && C.digest('甲', '乙') !== C.digest('甲', '丙'), 'dg 稳定性');

// 白话行计数：→ 开头紧跟文本才算；单独一个箭头（ASCII 代码框）不得误计
a(C.countBai('4.8 …\n→ 白话：先查自己哪步错。') === 1, 'bai 应计 1，实为 ' + C.countBai('4.8 …\n→ 白话：x'));
a(C.countBai('→ 白话：一\n→ 白话：二\n→ 白话：三') === 3, 'bai 应计 3');
a(C.countBai('+---+\n| 表 |\n+---+\n没有白话') === 0, 'ASCII 框线不得计为白话');
a(C.countBai('-> 白话：箭头兼容') === 1, 'ASCII 箭头应兼容');
a(C.baiCoverage('4.8 x\n4.13 y\n→ 白话：只有一行', new Set(['4.8', '4.13'])).verses === 2, 'coverage 颂数错');
a(C.baiCoverage('4.8 x\n→ 白话：一行', new Set(['4.8'])).bai === 1, 'coverage 白话数错');
a(C.countBai(undefined) === 0, 'undefined 应返回 0');

const base = [C.mkRow({ q: '甲', a: '「看人」4.8\n动作：做A' }), C.mkRow({ q: '乙', a: '「做事」8.25\n动作：做B' })];
base.forEach((r, i) => r.n = i + 1);
let m = C.merge(base, [C.mkRow({ q: '甲', a: '「看人」4.8\n动作：做A' })]);   // 重复：不得新增
a(m.rows.length === 2 && m.added === 0, '去重失败 ' + m.rows.length);
m = C.merge(m.rows, [C.mkRow({ q: '丙', a: '「修心」9.33\n动作：做C' })]);
a(m.rows.length === 3 && m.added === 1 && m.rows[2].n === 3, '新增编号错');
// 外来条目自带撞号 n=1，也不得打乱本地编号
m = C.merge(m.rows, [{ ...C.mkRow({ q: '丁', a: '「看己」\n动作：做D' }), n: 1 }]);
a(m.rows.length === 4 && m.rows.map(r => r.n).join() === '1,2,3,4', '撞号：' + m.rows.map(r => r.n).join());
// done 回写
m.rows[0].done = true; m.rows[0].note = '已拒';
const m2 = C.merge(m.rows, []);
a(m2.rows[0].done === true && m2.rows[0].note === '已拒', 'done 丢失');

const s = C.stats(m.rows);
a(s.total === 4 && s.act === 4 && s.done === 1 && s.rate === 25, JSON.stringify(s));
a(s.by['看人'] === 1 && s.verses['9'] === 1, JSON.stringify(s.by) + JSON.stringify(s.verses));
console.log('qa-core 自检 OK');

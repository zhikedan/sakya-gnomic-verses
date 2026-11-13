// 20-全文.md 的唯一解析器。check_baihua / build_baihua / record 都只用这一份，
// 避免三套正则各写各的导致"编号集合"口径不一致。
const fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, 'references', '20-全文.md');

// 返回 { byCh: {"1": {"1.1": "两句原文"}}, all: {"1.1": "两句原文"}, count }
function readVerses(file = FILE) {
  const byCh = {}, all = {};
  let cur = null, ch = null;
  for (const ln of fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n')) {
    const h = ln.match(/^\*\*([1-9])\.(\d+)\*\*\s*(.*)$/);
    if (h) {
      ch = h[1]; cur = ch + '.' + h[2];
      (byCh[ch] = byCh[ch] || {})[cur] = h[3].trim();
      all[cur] = h[3].trim();
    } else if (cur) {
      if (!ln.trim()) { cur = null; ch = null }
      else { byCh[ch][cur] += ' ' + ln.trim(); all[cur] += ' ' + ln.trim() }
    }
  }
  return { byCh, all, count: Object.keys(all).length };
}

const validSet = (file) => new Set(Object.keys(readVerses(file).all));
module.exports = { readVerses, validSet, FILE };

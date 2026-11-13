// 九品名称与颂数：构建、校验、网页共用，避免多处硬编码漂移。
// 颂数从 20-全文.md 实时统计，不硬编码。
const { readVerses } = require('./verses');
const CN = '一二三四五六七八九';
const NAME = { 1: '观察学者', 2: '观察正士', 3: '观察愚者', 4: '观察多士', 5: '观察恶行', 6: '观察性情', 7: '观察非理', 8: '观察事业', 9: '观察佛法' };
const byCh = readVerses().byCh;
const COUNTS = Object.fromEntries(Object.keys(byCh).map(c => [c, Object.keys(byCh[c]).length]));
const TOTAL = Object.values(COUNTS).reduce((a, b) => a + b, 0);
module.exports = { CN, NAME, COUNTS, TOTAL };

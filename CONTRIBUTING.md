# 参与整理

## 原则

1. **原文不可改**。`references/20-全文.md` 是唯一底本；任何引用、白话、精解里的颂号与字句都必须与它逐字一致。`node check_baihua.js` 会拦下改字、截半颂、编造编号。
2. **白话只做直译＋喻体落地**，不加感悟、不掺义理解释。13 世纪语境（种姓、女性、轮回）照原译写出，并在句末标注「取其原则，不取对象」。
3. **引颂必配白话**：成段引用的每一颂紧跟一行 `→ 白话：…`。
4. **答案结尾必有独立一行 `动作：…`**，否则台账无法验收。

## 改动后

```bash
npm test               # 必须全绿
node build_baihua.js   # 若改了白话或品名
node record.js rebuild # 若改了内核或模板
```

浏览器交互测试（可选，需本地无头浏览器）：

```bash
node test_qa_web.js
node test_baihua_web.js
```

## 新增一颂白话

在 `白话全书/0N-第N品-*.md` 对应编号下补两行，然后：

```bash
node check_baihua.js N   # 只校验第 N 品
npm test
```

## 隐私

仓库里**只有** `问答记录/qa.example.json`（一份格式示例）。真实问答 `qa.json`、`问答记录.md`、`问答记录.html` 由 `node record.js commit` 在使用者本机生成，可能包含个人处境，已被 `.gitignore` 排除，**不要提交**。CI 有一步专门检查这三个文件没被误跟踪，一旦被加进 `git ls-files` 就直接失败。

提 PR 前请确认 `git status` 里没有 `问答记录/qa.json`。

## 结构

- `verses.js` — `20-全文.md` 的唯一解析器，新增工具请复用它，不要另写正则。
- `chapters.js` — 九品名称与颂数（实时统计），品名不要硬编码到模板里。
- `qa-core.js` — 抽取／合并／统计内核，Node 与网页共用同一份，`record.js` 生成网页时内联它。

## 许可

原创整理内容 MIT；所收汉译颂文著作权归原译者／出版方，见 [LICENSE](LICENSE)。

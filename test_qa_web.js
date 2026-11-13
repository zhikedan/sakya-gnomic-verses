// 台账网页交互测试。需先起无头 Edge（见 README），node test_qa_web.js
const http = require('http');
const list = () => new Promise(r => http.get('http://127.0.0.1:9333/json', res => { let s = ''; res.on('data', d => s += d); res.on('end', () => r(JSON.parse(s))) }));
const ev = (ws, id, m, p) => new Promise(res => { const on = x => { const o = JSON.parse(x.data); if (o.id === id) { ws.removeEventListener('message', on); res(o.result) } }; ws.addEventListener('message', on); ws.send(JSON.stringify({ id, method: m, params: p })) });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const t = (await list()).find(x => x.type === 'page' && decodeURIComponent(x.url).includes('问答台账') || x.type === 'page' && decodeURIComponent(x.url).includes('问答记录'));
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const errs = [];
  ws.addEventListener('message', x => { const o = JSON.parse(x.data); if (o.method === 'Runtime.exceptionThrown') errs.push((o.params.exceptionDetails.exception?.description || o.params.text).split('\n')[0]) });
  await ev(ws, ++id, 'Runtime.enable');
  const R = async e => { const r = await ev(ws, ++id, 'Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.exceptionDetails ? 'THROW: ' + (r.exceptionDetails.exception?.description || '').split('\n')[0] : (r.result?.value ?? null) };

  console.log('0 记录数 =', await R('ROWS.length'), '| 颂文映射 =', await R('Object.keys(VM).length'));
  console.log('1 KPI 文本 =', await R('[...kpi.children].map(x=>x.textContent.replace(/\\s+/g," ")).join(" | ")'));
  console.log('2 完成率数字 =', await R('S.rate'), '| 内核来自 qa-core =', await R('typeof stats=="function" && typeof merge=="function"'));
  console.log('3 条目数 =', await R('list.children.length'), '| 页脚 =', await R('foot.textContent'));

  console.log('4 搜索"合伙" =', await R('(()=>{s.value="合伙";s.oninput();return list.querySelectorAll(".item").length+" 条 / "+foot.textContent.slice(3,12)})()'));
  console.log('5 搜索"9.99"(应无) =', await R('(()=>{s.value="zzz不存在";s.oninput();return list.innerHTML.includes("empty")?"空提示✓":"仍显示条目✗"})()'));
  await R('s.value="";s.oninput()');

  console.log('6 状态筛选欠账 =', await R('(()=>{ft.value="2";ft.onchange();return [...list.querySelectorAll(".st")].map(x=>x.textContent).join(",")})()'));
  await R('ft.value="0";ft.onchange()');

  console.log('7 类型按钮 =', await R('[...ty.children].map(b=>b.textContent).join("/")'));
  console.log('8 点"做事"类(可能无) =', await R('(()=>{const b=[...ty.children].find(x=>x.dataset.t==="看人");b.click();return list.querySelectorAll(".item").length+" 条,选中态="+b.classList.contains("on")})()'));
  await R('[...ty.children][0].click()');

  console.log('9 展开第1条 =', await R('(()=>{list.children[0].querySelector(".hd").click();return list.children[0].classList.contains("open")?"展开✓":"未展开✗"})()'));
  console.log('10 答案可见 =', await R('getComputedStyle(list.children[0].querySelector(".ans")).display!=="none"'));
  console.log('11 动作块 =', await R('list.children[0].querySelector(".act").textContent.slice(0,26)'));

  console.log('12 点颂号看原文 =', await R('(()=>{const b=list.children[0].querySelector(".vs b");b.click();const v=list.children[0].querySelector(".vslot").textContent.trim();return v.slice(0,34)})()'));
  console.log('13 再点收起 =', await R('(()=>{const b=list.children[0].querySelector(".vs b");b.click();return list.children[0].querySelector(".vslot").textContent.trim()===""?"收起✓":"未收起✗"})()'));
  console.log('14 原文与 20-全文 一致 =', await R('VM["4.8"].includes("圣士观察自过失")'));

  console.log('15 XSS 转义 =', await R('(()=>{const d=document.createElement("div");d.innerHTML=esc("<img src=x onerror=alert(1)>");return !d.querySelector("img")})()'));
  console.log('16 数据里无未转义 </script> =', await R('!document.documentElement.innerHTML.includes("</script><script>")'));
  // 注入探针条目后重绘，检查体检提示；结束后必须还原
  const probe = (name, patch) => R(`(()=>{
      const fake={...ROWS[0],n:999,q:"__probe__",...(${JSON.stringify(patch)})};
      const keep=ROWS.slice(); ROWS.length=0; ROWS.push(fake); draw();
      const w=[...list.querySelectorAll(".warn")].map(x=>x.textContent).join(" | ");
      const act=list.querySelector(".act")?list.querySelector(".act").textContent:"";
      ROWS.length=0; keep.forEach(r=>ROWS.push(r)); draw();
      return {w,act}})()`).then(r => { console.log(name, '=', r && r.w !== undefined ? (r.w || '(无提示)') : r); return r });
  const p1 = await probe('17 无动作行', { action: '', a: '没有动作行' });
  const p2 = await probe('17b 成段引颂缺白话', { action: '有动作', a: '8.77 若欲降伏诸对方，则自竭力学本领。\n8.8 即使无力虚弱者。\n没有白话行' });
  const p3 = await probe('17c 行文提及不误报', { action: '有动作', a: '8.77 若欲降伏诸对方。\n→ 白话：先造兵器。\n另外 8.93 也相关，只是行文提及' });
  const ok17 = p1.w.includes('无法验收') && !p1.act, ok17b = p2.w.includes('有颂没译') && p2.w.includes('2 颂'), ok17c = p3.w === '';
  console.log('17/17b/17c 判定 =', ok17 && ok17b && ok17c ? '全部正确✓' : '✗ ' + JSON.stringify({ ok17, ok17b, ok17c }));
  console.log('18 欠账自动展开 =', await R('list.children.length>0'));

  console.log('\n页面异常:', errs.length ? errs.slice(0, 4) : 'none');
  ws.close();
})();

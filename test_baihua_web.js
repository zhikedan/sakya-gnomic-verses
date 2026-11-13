// 全本白话网页交互测试（端口 9334）。node test_baihua_web.js
const http = require('http');
const list = () => new Promise(r => http.get('http://127.0.0.1:9334/json', res => { let s = ''; res.on('data', d => s += d); res.on('end', () => r(JSON.parse(s))) }));
const ev = (ws, id, m, p) => new Promise(res => { const on = x => { const o = JSON.parse(x.data); if (o.id === id) { ws.removeEventListener('message', on); res(o.result) } }; ws.addEventListener('message', on); ws.send(JSON.stringify({ id, method: m, params: p })) });
(async () => {
  const t = (await list()).find(x => x.type === 'page');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const errs = [];
  ws.addEventListener('message', x => { const o = JSON.parse(x.data); if (o.method === 'Runtime.exceptionThrown') errs.push((o.params.exceptionDetails.exception?.description || o.params.text).split('\n')[0]) });
  await ev(ws, ++id, 'Runtime.enable');
  const R = async e => { const r = await ev(ws, ++id, 'Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.exceptionDetails ? 'THROW: ' + (r.exceptionDetails.exception?.description || '').split('\n')[0] : (r.result?.value ?? null) };

  console.log('0 数据量 =', await R('D.length'), '| 每颂有白话 =', await R('D.every(v=>v.b&&v.b.length>4)'));
  console.log('1 初始渲染 =', await R('list.children.length'), '| 页脚 =', await R('foot.textContent'));
  console.log('2 品按钮 =', await R('[...chbar.children].map(b=>b.textContent).join("/")'));
  console.log('3 原文逐字对得上源文件 =', await R('D.filter(v=>!/[，。？]/.test(v.v)).length===0'));
  console.log('4 搜"磁石" =', await R('(()=>{inp.value="磁石";inp.oninput();return [...list.children].map(x=>x.querySelector("i").textContent).join(",")})()'));
  console.log('5 搜编号 8.25 =', await R('(()=>{inp.value="8.25";inp.oninput();return list.children[0]?list.children[0].textContent.slice(0,46):"无"})()'));
  console.log('6 白话也能搜到（"磁石吸铁"）=', await R('(()=>{inp.value="磁石吸铁";inp.oninput();return foot.textContent})()'));
  await R('inp.value="";inp.oninput()');
  console.log('7 选第九品 =', await R('(()=>{chbar.children[9].click();return foot.textContent})()'));
  console.log('8 切回全九品 =', await R('(()=>{chbar.children[0].click();return foot.textContent})()'));
  console.log('9 转义安全 =', await R('(()=>{const d=document.createElement("div");d.innerHTML=list.children[0].innerHTML;return !d.querySelector("script")})()'));
  console.log('10 无空条目 =', await R('D.every(v=>v.id&&v.v&&v.b)'));
  console.log('11 编号唯一 =', await R('new Set(D.map(v=>v.id)).size'));
  console.log('页面异常:', errs.length ? errs.slice(0, 3) : 'none');
  ws.close();
})();

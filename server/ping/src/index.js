// Kasala ping test: measures the round trip from a phone to Cloudflare game servers placed in different regions.
// It stores nothing and exists only to choose where the real game server should run.
import { DurableObject } from 'cloudflare:workers';

const REGIONS = ['afr', 'weur', 'me'];

export class Echo extends DurableObject {
  async fetch(request) {
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    server.accept();
    let colo = '?';
    try { colo = ((await (await fetch('https://www.cloudflare.com/cdn-cgi/trace')).text()).match(/colo=(\w+)/) || [])[1] || '?'; } catch (e) {}
    server.send(JSON.stringify({ colo }));
    server.addEventListener('message', e => server.send(e.data));
    server.addEventListener('close', () => { try { server.close(); } catch (e) {} });
    return new Response(null, { status:101, webSocket:client });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws'){
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status:426 });
      const loc = REGIONS.includes(url.searchParams.get('loc')) ? url.searchParams.get('loc') : 'afr';
      return env.ECHO.get(env.ECHO.idFromName('ping-' + loc), { locationHint:loc }).fetch(request);
    }
    const page = PAGE.replace('__ENTRY__', (request.cf && request.cf.colo) || 'local').replace('__NET__', (request.cf && request.cf.asOrganization || '').replace(/[<>&]/g, ''));
    return new Response(page, { headers:{ 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store' } });
  },
};

const PAGE = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kasala ping test</title>
<style>
:root{color-scheme:dark}body{margin:0;padding:20px 16px 40px;background:#0b0c10;color:#f3efe7;font:16px/1.45 system-ui,sans-serif;max-width:560px;margin:auto}
h1{font-size:26px;margin:0 0 4px;color:#ff8a3c}p{color:#b8b4ab;margin:6px 0 16px}button{width:100%;padding:16px;border:0;background:#c9361a;color:#fff;font:600 18px system-ui;border-radius:4px}button:disabled{opacity:.5}
.r{border:1px solid #2a2c33;padding:12px;margin-top:12px}.r b{display:block;font-size:17px}.big{font-size:30px;font-weight:700;color:#ffc26b}.s{color:#b8b4ab;font-size:14px}#copy{background:#23252c;margin-top:14px}
</style><h1>Kasala ping test</h1><p>Turn Wi-Fi off and use mobile data. Keep this page open while it runs. Your first stop: <b>__ENTRY__</b> <span class="s">__NET__</span></p>
<button id="go">Run test</button><div id="out"></div><button id="copy" hidden>Copy results</button>
<script>
const SECS=+(new URLSearchParams(location.search).get('secs')||20),NAMES={afr:'Africa',weur:'West Europe',me:'Middle East'},out=document.getElementById('out'),go=document.getElementById('go'),copy=document.getElementById('copy');let lines=[];
function run(loc){return new Promise(done=>{
  const box=document.createElement('div');box.className='r';box.innerHTML='<b>'+NAMES[loc]+'</b><span class="big">...</span><div class="s">Connecting</div>';out.append(box);
  const big=box.querySelector('.big'),small=box.querySelector('.s'),sent=new Map(),times=[];let colo='?',seq=0,timer,end;
  const ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws?loc='+loc);
  let over=false;const finish=(why)=>{if(over)return;over=true;clearInterval(timer);clearTimeout(end);try{ws.close()}catch(e){}
    const s=times.slice().sort((a,b)=>a-b),q=p=>s.length?Math.round(s[Math.min(s.length-1,Math.floor(s.length*p))]):0,lost=seq?Math.max(0,seq-times.length):0;
    let j=0;for(let i=1;i<times.length;i++)j+=Math.abs(times[i]-times[i-1]);j=times.length>1?Math.round(j/(times.length-1)):0;
    big.textContent=s.length?q(.5)+' ms':'failed';const t='server '+colo+', typical '+q(.5)+' ms, worst 5% '+q(.95)+' ms, peak '+q(1)+' ms, jitter '+j+' ms, lost '+lost+' of '+seq+(why?' ('+why+')':'');small.textContent=t;lines.push(NAMES[loc]+': '+t);done()};
  ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.colo){colo=d.colo;small.textContent='Server in '+colo+'. Measuring...';
      timer=setInterval(()=>{seq++;sent.set(seq,performance.now());ws.send(JSON.stringify({n:seq}))},100);end=setTimeout(()=>{clearInterval(timer);end=setTimeout(()=>finish(),1500)},SECS*1000);return}
    const t=sent.get(d.n);if(t!=null){sent.delete(d.n);times.push(performance.now()-t);if(times.length%5===0)big.textContent=Math.round(times[times.length-1])+' ms'}};
  ws.onerror=()=>{if(!seq)finish('could not connect')};ws.onclose=()=>finish('dropped');
})}
go.onclick=async()=>{go.disabled=true;out.textContent='';lines=['Entry __ENTRY__ __NET__'];copy.hidden=true;for(const l of ['afr','weur','me'])await run(l);go.disabled=false;go.textContent='Run again';copy.hidden=false};
copy.onclick=async()=>{const t=lines.join('\\n');try{await navigator.clipboard.writeText(t);copy.textContent='Copied'}catch(e){prompt('Copy this',t)}};
<\/script></html>`;

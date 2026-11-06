/* =====================================================================
   Playing with friends: the room screen and the link to the game server.
   The match itself runs on the server (server/game); shooter.js draws it.
   ===================================================================== */
const NET = (() => {
  const params = new URLSearchParams(location.search);
  const SERVER = params.get('server') || 'wss://kasala-game.kasala.workers.dev';
  const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', el = s => document.querySelector(s);
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; };
  const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const HTTP = SERVER.replace(/^ws/, 'http');
  const MODES = { team:'Team battle 5v5', ffa:'Free-for-all', br:'Battle royale', brsq:'Battle royale teams' };
  const ABOUT = { team:'Rounds, no respawns. First team to 3 wins', ffa:'Everyone for themselves. First to 15 kills', br:'One life. Loot, and stay inside the zone', brsq:'Two squads of 5. One life each' };
  let ws = null, room = null, root = null, inMatch = false, quickMode = null, skip = [], tries = 0, waitTimer = null;

  function build(){
    if (root) return;
    const css = document.createElement('style');
    css.textContent = `#netRoom{position:fixed;inset:0;z-index:30;overflow:auto;background:radial-gradient(70% 110% at 50% 110%,rgba(255,90,20,.3),transparent 62%),#08080b;color:#fff;font:15px/1.35 var(--body)}
#netRoom .nw{width:min(760px,100%);min-height:100%;margin:0 auto;padding:max(14px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) 14px max(16px,env(safe-area-inset-left));box-sizing:border-box;display:flex;flex-direction:column;gap:12px;justify-content:center}
#netRoom h2{margin:0;font:400 clamp(24px,5vh,34px)/1 var(--display);color:#ffd27a}#netRoom p{margin:0;color:#c9c3b8}#netRoom label{display:block;font:800 12px var(--body);color:#c9c3b8}
#netRoom input,#netRoom select{width:100%;box-sizing:border-box;min-height:46px;margin-top:4px;padding:0 12px;background:#14151b;color:#fff;border:1.5px solid var(--line);border-radius:0;font:700 16px var(--body)}
#netRoom button{min-height:46px;padding:0 14px;border:0;border-radius:0;background:rgba(255,255,255,.1);color:#fff;font:800 14px var(--body)}#netRoom button.go{background:linear-gradient(90deg,#d3160f,#ff6a13);font:400 19px var(--display)}#netRoom button:disabled{opacity:.45}
#netRoom .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}#netRoom .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#netRoom .row>*{flex:1 1 auto}
#netRoom .code{font:400 clamp(34px,8vh,52px)/1 var(--display);letter-spacing:.08em;color:#fff}#netRoom .side{border-top:3px solid #3a8bff;background:rgba(255,255,255,.05);padding:8px 10px;min-height:96px}#netRoom .side.b{border-top-color:#e1201a}
#netRoom .side h3{margin:0 0 6px;font:800 12px var(--body);color:#c9c3b8}#netRoom .side div{display:flex;gap:8px;align-items:center;padding:3px 0;font-weight:700}#netRoom .side img{width:30px;height:30px;object-fit:cover;object-position:top;background:rgba(0,0,0,.4)}#netRoom .side small{color:#ffd27a}
#netRoom .msg{min-height:20px;color:#ffb27a}#netRoom .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}#netRoom .pm{min-height:74px;text-align:left;padding:10px 12px;display:flex;flex-direction:column;justify-content:center;gap:3px}#netRoom .pm b{font:400 19px/1 var(--display)}#netRoom .pm span{font:600 12px/1.25 var(--body);color:#c9c3b8}#netRoom .pm i{font:800 11px var(--body);color:#ffd27a;font-style:normal}
#netRoom .names{display:flex;flex-wrap:wrap;gap:6px}#netRoom .names span{background:rgba(255,255,255,.08);padding:4px 8px;font-weight:700;font-size:13px}#netRoom .bar{height:6px;background:rgba(255,255,255,.12)}#netRoom .bar i{display:block;height:100%;background:linear-gradient(90deg,#d3160f,#ff6a13)}
@media (max-width:520px){#netRoom .grid{grid-template-columns:1fr}}`;
    document.head.appendChild(css);
    root = document.createElement('div'); root.id = 'netRoom'; root.hidden = true; root.innerHTML = '<div class="nw"></div>'; document.body.appendChild(root);
  }
  const page = html => { build(); root.querySelector('.nw').innerHTML = html; root.hidden = false; root.scrollTop = 0; };
  const hide = () => { if (root) root.hidden = true; };
  function menu(msg){
    room = null;
    page(`<h2>Play with friends</h2><p>Make a room and send the code. Bots fill any empty places.</p>
      ${nameBox()}
      <button class="go" id="netMake">Create a room</button>
      <div class="row"><label>Room code<input id="netCode" maxlength="6" autocapitalize="characters" autocomplete="off" spellcheck="false" value="${esc(params.get('room') || '')}"></label><button id="netJoin" style="flex:0 0 auto;align-self:flex-end">Join</button></div>
      <div class="msg" role="status">${esc(msg || '')}</div><button id="netBack">Back</button>`);
    el('#netMake').onclick = () => { let c = ''; for (let i = 0; i < 5; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)]; link(c, myName(), 'create'); };
    el('#netJoin').onclick = () => { const c = el('#netCode').value.trim().toUpperCase(); if (c.length < 4) return say('Type the room code your friend sent you'); link(c, myName(), null); };
    el('#netBack').onclick = () => { hide(); leave(); };
  }
  const nameBox = () => `<label>Your name<input id="netName" maxlength="16" autocomplete="nickname" value="${esc(store('kasala-name') || '')}" placeholder="e.g. Tunde"></label>`;
  const myName = () => { const v = el('#netName') ? el('#netName').value.trim() : store('kasala-name') || ''; store('kasala-name', v); return v || 'Player'; };
  function online(msg){
    room = null; quickMode = null;
    page(`<h2>Play online</h2><p>Join a match with players from anywhere. Bots fill any empty places.</p>${nameBox()}
      <div class="grid">${Object.keys(MODES).map(k => `<button class="pm" data-m="${k}"><b>${MODES[k]}</b><span>${ABOUT[k]}</span><i data-n="${k}"></i></button>`).join('')}</div>
      <div class="msg" role="status">${esc(msg || '')}</div><button id="netBack">Back</button>`);
    root.querySelectorAll('.pm').forEach(b => b.onclick = () => { skip = []; tries = 0; quick(b.dataset.m, myName()); });
    el('#netBack').onclick = () => { hide(); leave(); };
    fetch(HTTP + '/online').then(r => r.json()).then(c => { for (const k in c){ const i = root.querySelector(`[data-n="${k}"]`); if (i) i.textContent = c[k] ? `${c[k]} finding a match now` : ''; } }).catch(() => {});
  }
  async function quick(mode, name){
    quickMode = mode; say('Finding a match…');
    try {
      const r = await (await fetch(`${HTTP}/quick?mode=${mode}&skip=${skip.join(',')}`)).json();
      if (!r.code) throw new Error('no code');
      if (quickMode !== mode) return;
      link(r.code, name, { public:mode });
    } catch (e) { say('Could not reach the game server. Check your connection'); quickMode = null; }
  }
  const say = m => { const b = root && root.querySelector('.msg'); if (b) b.textContent = m; };
  function link(code, name, how){
    const keep = quickMode; leave(); quickMode = keep; say('Connecting…');
    const q = new URLSearchParams({ name, char:SHOOTER.myPick() }); if (how === 'create') q.set('create', '1'); else if (how && how.public) q.set('public', how.public);
    let s; try { s = new WebSocket(`${SERVER}/room/${code}?${q}`); } catch (e) { return say('Could not reach the game server'); }
    ws = s; let joined = false;
    s.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'lobby') joined = true; if (m.t === 'err' && m.retry && quickMode && tries < 4){ tries++; skip.push(code); joined = true; ws = null; return quick(quickMode, name); } receive(m); };
    s.onclose = () => { if (ws !== s) return; ws = null; if (inMatch){ inMatch = false; SHOOTER.netLost(); } if (!joined) say('Could not reach the game server'); else if (quickMode) online('You lost the connection'); else menu('You lost the connection to the room'); };
  }
  const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  function leave(){ if (window.KVOICE) KVOICE.stop(); const s = ws; ws = null; inMatch = false; room = null; quickMode = null; clearInterval(waitTimer); if (s) try { s.close(); } catch (e) {} }
  function receive(m){
    if (Array.isArray(m)){ SHOOTER.netMsg(m); return; }
    if (m.t === 'err') return quickMode ? online(m.m) : menu(m.m);
    if (m.t === 'lobby'){ room = m; if (!inMatch) (m.public ? showWait() : showRoom()); return; }
    if (m.t === 'n') return SHOOTER.netNote(m.m);
    if (m.t === 'sig') return window.KVOICE && KVOICE.onSig(m.from, m.d);
    if (m.t === 'talk') return window.KVOICE && KVOICE.onTalk(m.from, m.on);
    if (m.t === 'start') begin(m);
  }
  function showWait(){
    const r = room, ends = performance.now() + r.wait * 1000;
    page(`<h2>${esc(MODES[r.mode])}</h2><p>Finding players. Bots fill the empty places when the timer runs out.</p>
      <div class="row" style="justify-content:space-between"><div class="code" id="netCount" style="flex:0 0 auto">${r.players.length}<small style="font-size:.45em"> / 10</small></div><div style="flex:0 0 auto;text-align:right"><p>Starts in</p><div class="code" id="netClock" style="font-size:clamp(26px,6vh,40px)">0:${String(Math.ceil(r.wait)).padStart(2, '0')}</div></div></div>
      <div class="bar"><i id="netBar" style="width:${r.players.length * 10}%"></i></div>
      <div class="names">${r.players.map(p => `<span>${esc(p.name)}${p.id === r.you ? ' (you)' : ''}</span>`).join('')}</div>
      <div class="row"><button id="netChar">Change fighter</button><button id="netLeave">Leave</button></div>`);
    clearInterval(waitTimer); waitTimer = setInterval(() => { const c = el('#netClock'); if (!c){ clearInterval(waitTimer); return; } const t = Math.max(0, Math.ceil((ends - performance.now()) / 1000)); c.textContent = '0:' + String(t).padStart(2, '0'); }, 250);
    el('#netChar').onclick = () => SHOOTER.showPicker({ mode:'friends', go:'Use this fighter' }, (c, ok) => { ok(); send({ t:'char', char:c.id }); });
    el('#netLeave').onclick = () => { leave(); online(); };
  }
  function showRoom(){
    const r = room, me = r.players.find(p => p.id === r.you), host = me.host, url = `${location.origin}${location.pathname}?room=${r.code}${params.get('server') ? '&server=' + encodeURIComponent(params.get('server')) : ''}`;
    const side = s => r.players.filter(p => p.side === s).map(p => `<div><img src="art/p/${esc(p.char)}.webp" alt=""><span>${esc(p.name)}</span>${p.id === r.you ? '<small>You</small>' : p.host ? '<small>Host</small>' : ''}</div>`).join('') || '<div>Bots</div>';
    page(`<div class="row" style="justify-content:space-between"><div style="flex:0 0 auto"><p>Room code</p><div class="code">${esc(r.code)}</div></div><div class="row" style="flex:0 1 300px"><button id="netCopy">Copy link</button><button id="netWa">WhatsApp</button></div></div>
      <div class="two"><div class="side"><h3>Side one</h3>${side(0)}</div><div class="side b"><h3>Side two</h3>${side(1)}</div></div>
      <div class="row"><button id="netSide">Switch side</button><button id="netChar">Change fighter</button>${host ? `<select id="netMode" aria-label="Game mode" style="margin:0">${Object.keys(MODES).map(k => `<option value="${k}">${MODES[k]}</option>`).join('')}</select><select id="netDiff" aria-label="Bot difficulty" style="margin:0"><option value="easy">Easy bots</option><option value="medium">Medium bots</option><option value="hard">Hard bots</option></select>` : ''}</div>
      <div class="msg" role="status">${host ? '' : 'Waiting for the host to start ' + esc(MODES[r.mode])}</div>
      ${host ? `<button class="go" id="netStart">Start ${esc(MODES[r.mode])}</button>` : ''}<button id="netLeave">Leave room</button>`);
    el('#netSide').onclick = () => send({ t:'side' });
    el('#netChar').onclick = () => SHOOTER.showPicker({ mode:'friends', go:'Use this fighter' }, (c, ok) => { ok(); send({ t:'char', char:c.id }); });
    el('#netLeave').onclick = () => { leave(); menu(); };
    el('#netCopy').onclick = async () => { try { await navigator.clipboard.writeText(url); say('Link copied'); } catch (e) { say(url); } };
    el('#netWa').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(`Join my Kasala match. Room code ${r.code} ${url}`), '_blank', 'noopener');
    if (host){ const d = el('#netDiff'); d.value = r.diff; d.onchange = () => send({ t:'opt', diff:d.value }); const md = el('#netMode'); md.value = r.mode; md.onchange = () => send({ t:'opt', mode:md.value }); el('#netStart').onclick = () => { el('#netStart').disabled = true; say('Starting…'); send({ t:'start' }); }; }
  }
  async function begin(m){
    inMatch = true; clearInterval(waitTimer); page('<h2>Getting fighters ready…</h2><p>The match starts when everyone has loaded.</p>');
    try { await SHOOTER.netPrep(m); } catch (e) { console.warn(e); leave(); return menu('Check your connection and try again'); }
    hide(); const mode = m.mode === 'brsq' ? 'br' : m.mode, pub = m.public ? m.mode : null;
    SHOOTER.start({ mode, squad:m.mode === 'brsq', diff:m.diff, net:{ m, send, leave, public:!!pub, toRoom:() => { inMatch = false; if (window.KVOICE) KVOICE.stop(); if (pub){ leave(); online(); skip = []; tries = 0; quick(pub, myName()); } else if (ws && room) showRoom(); else menu(); } } });
    send({ t:'ready' });
    // team voice: the other people on my side, if this mode has sides
    const myTeam = m.roster[m.you].team, mates = {};
    if (myTeam != null) m.roster.forEach((r, i) => { if (r.human && i !== m.you && r.team === myTeam) mates[i] = r.name; });
    if (window.KVOICE) KVOICE.start(send, m.you, mates);
  }
  function ready(){ const b = el('#btnFriends'), o = el('#btnOnline'); if (b){ b.disabled = false; b.onclick = () => menu(); } if (o){ o.disabled = false; o.onclick = () => online(); } if (params.get('room') && !ws) menu(); }
  return { ready, menu, online };
})();
window.NET = NET;
{ const wait = () => (window.__ready && window.SHOOTER ? NET.ready() : setTimeout(wait, 300)); wait(); }

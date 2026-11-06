/* =====================================================================
   Team voice chat for online matches. Teammates are linked directly with WebRTC audio;
   the game server passes the call setup between them and only ever links people on the same side.
   Hold TEAM MIC to talk, or tap it to leave it on. The mic is only asked for the first time you use it.
   ===================================================================== */
const KVOICE = (() => {
  // relay servers (Metered TURN) for phones whose network blocks direct calls. Same account as Wayo.
  const TURN_LINK = 'https://beef.metered.live/api/v1/turn/credentials?apiKey=aa18f28bce0ae397ea81789f0df19dc488bd';
  const STUN = [{ urls:'stun:stun.l.google.com:19302' }, { urls:'stun:stun1.l.google.com:19302' }];
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; };
  let relay = null;
  async function iceServers(){
    if (relay) return relay;
    let list = null; try { const c = JSON.parse(store('kasala-relay') || 'null'); if (c && Date.now() - c.at < 12 * 3600e3) list = c.list; } catch (e) {}
    if (!list && new URLSearchParams(location.search).get('relay') === 'off') list = [];
    if (!list){
      try {
        const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 5000), r = await fetch(TURN_LINK, { signal:ctl.signal }); clearTimeout(to);
        const j = await r.json(); list = Array.isArray(j) ? j : j.iceServers || []; store('kasala-relay', JSON.stringify({ at:Date.now(), list }));
      } catch (e){ list = []; }
    }
    return relay = [...STUN, ...list];
  }
  const V = { send:null, me:-1, mates:new Map(), pcs:new Map(), audios:new Map(), early:new Map(), mic:null, micFailed:false, talking:false, silent:null, muted:store('kasala-team-muted') === '1', ui:null, talkers:new Map() };
  const el = s => document.querySelector(s);

  function silentTrack(){
    if (V.silent && V.silent.readyState === 'live') return V.silent;
    const A = new (window.AudioContext || window.webkitAudioContext)(); V.silent = A.createMediaStreamDestination().stream.getAudioTracks()[0];
    return V.silent;
  }
  const outTrack = () => V.mic && V.mic.readyState === 'live' ? V.mic : silentTrack();
  async function link(id){
    const pc = new RTCPeerConnection({ iceServers:await iceServers() });
    V.pcs.set(id, pc); pc.addTrack(outTrack(), new MediaStream());
    pc.onicecandidate = e => { if (e.candidate) V.send({ t:'sig', to:id, d:{ c:e.candidate } }); };
    pc.ontrack = e => {
      let a = V.audios.get(id);
      if (!a){ a = document.createElement('audio'); a.autoplay = true; a.setAttribute('playsinline', ''); a.hidden = true; document.body.appendChild(a); V.audios.set(id, a); }
      a.srcObject = e.streams[0] || new MediaStream([e.track]); a.muted = V.muted; const p = a.play(); if (p && p.catch) p.catch(() => {});
    };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' && V.pcs.get(id) === pc && V.me < id){ drop(id); ring(id); } };
    return pc;
  }
  async function ring(id){
    if (!V.mates.has(id)) return;
    const pc = await link(id), o = await pc.createOffer(); await pc.setLocalDescription(o);
    V.send({ t:'sig', to:id, d:{ sdp:pc.localDescription } });
  }
  function drop(id){ const pc = V.pcs.get(id); if (pc) try { pc.close(); } catch (e) {} V.pcs.delete(id); V.early.delete(id); }
  async function onSig(from, d){
    if (!V.mates.has(from) || !d) return;
    try {
      if (d.sdp && d.sdp.type === 'offer'){ drop(from); const pc = await link(from); await pc.setRemoteDescription(d.sdp); for (const c of V.early.get(from) || []) await pc.addIceCandidate(c); V.early.delete(from); await pc.setLocalDescription(await pc.createAnswer()); V.send({ t:'sig', to:from, d:{ sdp:pc.localDescription } }); }
      else if (d.sdp && d.sdp.type === 'answer'){ const pc = V.pcs.get(from); if (pc && pc.signalingState === 'have-local-offer'){ await pc.setRemoteDescription(d.sdp); for (const c of V.early.get(from) || []) await pc.addIceCandidate(c); V.early.delete(from); } }
      else if (d.c){ const pc = V.pcs.get(from); if (pc && pc.remoteDescription) await pc.addIceCandidate(d.c); else { const q = V.early.get(from) || []; q.push(d.c); V.early.set(from, q); } }
    } catch (e){ console.warn('voice', e.message); }
  }
  function onTalk(from, on){
    const n = V.mates.get(from); if (n == null) return;
    if (on) V.talkers.set(from, n); else V.talkers.delete(from);
    if (V.ui) V.ui.list.innerHTML = [...V.talkers.values()].map(t => `<div>${String(t).replace(/[&<>"']/g, '')} is talking</div>`).join('');
  }
  async function talk(on){
    if (on && !V.mic && !V.micFailed){
      try { const s = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } }); V.mic = s.getAudioTracks()[0]; for (const pc of V.pcs.values()) for (const s2 of pc.getSenders()) if (!s2.track || s2.track.kind === 'audio') s2.replaceTrack(V.mic).catch(() => {}); }
      catch (e){ V.micFailed = true; if (V.ui) V.ui.small.textContent = 'mic blocked'; }
    }
    on = on && !!V.mic;
    if (V.mic) V.mic.enabled = on;
    if (on !== V.talking && V.send) V.send({ t:'talk', on });
    V.talking = on; if (V.ui) V.ui.btn.classList.toggle('on', on);
    return on;
  }
  function buildUi(){
    if (V.ui) return;
    const css = document.createElement('style');
    css.textContent = `#kvMic{position:fixed;z-index:12;left:calc(env(safe-area-inset-left,0px) + 12px);top:38%;width:88px;height:54px;border:2px solid rgba(255,255,255,.22);background:rgba(8,8,11,.62);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border-radius:0;touch-action:none;user-select:none;-webkit-user-select:none}
#kvMic b{font:400 13px/1 var(--display)}#kvMic small{font:700 10px/1 var(--body);color:#c9c3b8}#kvMic.on{background:#1f9d55;border-color:#5cf09a}#kvMic.on small{color:#fff}
#kvMute{position:fixed;z-index:12;left:calc(env(safe-area-inset-left,0px) + 12px);top:calc(38% + 60px);width:88px;min-height:30px;border:0;background:rgba(8,8,11,.55);color:#c9c3b8;font:800 11px var(--body);border-radius:0}
#kvList{position:fixed;z-index:12;left:calc(env(safe-area-inset-left,0px) + 108px);top:38%;display:grid;gap:4px;pointer-events:none}#kvList div{background:rgba(31,157,85,.88);color:#fff;font:800 12px var(--body);padding:3px 8px}`;
    document.head.appendChild(css);
    const btn = document.createElement('button'); btn.id = 'kvMic'; btn.hidden = true; btn.setAttribute('aria-label', 'Team mic: hold to talk, tap to keep it on'); btn.innerHTML = '<b>TEAM MIC</b><small>hold · tap</small>';
    const mute = document.createElement('button'); mute.id = 'kvMute'; mute.hidden = true;
    const list = document.createElement('div'); list.id = 'kvList';
    document.body.append(btn, mute, list);
    V.ui = { btn, mute, list, small:btn.querySelector('small') };
    // hold to talk; a quick tap leaves the mic on until the next tap
    let down = 0, locked = false;
    btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); down = performance.now(); if (locked){ locked = false; talk(false); down = 0; return; } talk(true); });
    const up = e => { if (!down) return; e.stopPropagation(); const quick = performance.now() - down < 280; down = 0; if (quick && V.talking){ locked = true; V.ui.small.textContent = 'on · tap to stop'; } else { talk(false); V.ui.small.textContent = 'hold · tap'; } };
    btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('pointerleave', up);
    mute.onclick = () => { V.muted = !V.muted; store('kasala-team-muted', V.muted ? '1' : '0'); for (const a of V.audios.values()) a.muted = V.muted; showMute(); };
    // keyboard: hold T to talk
    addEventListener('keydown', e => { if (e.code === 'KeyT' && !e.repeat && V.mates.size && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) talk(true); });
    addEventListener('keyup', e => { if (e.code === 'KeyT' && V.mates.size && !locked) talk(false); });
  }
  const showMute = () => { V.ui.mute.textContent = V.muted ? 'Team muted' : 'Hear team: on'; };
  // mates: { rosterIndex: name } of the human players on my side
  function start(send, me, mates){
    stop();
    V.send = send; V.me = me; V.mates = new Map(Object.entries(mates).map(([k, v]) => [+k, v]));
    if (!V.mates.size || !window.RTCPeerConnection) return;
    buildUi(); V.ui.btn.hidden = V.ui.mute.hidden = false; showMute();
    for (const id of V.mates.keys()) if (me < id) ring(id);   // the lower number rings, so each pair makes one call
  }
  function stop(){
    if (V.talking) talk(false);
    for (const id of [...V.pcs.keys()]) drop(id);
    for (const a of V.audios.values()){ a.srcObject = null; a.remove(); }
    V.audios.clear(); V.mates = new Map(); V.talkers.clear(); V.send = null;
    if (V.ui){ V.ui.btn.hidden = V.ui.mute.hidden = true; V.ui.list.innerHTML = ''; V.ui.btn.classList.remove('on'); V.ui.small.textContent = 'hold · tap'; }
  }
  return { start, stop, onSig, onTalk, talk,
    // tests: how much teammate audio has arrived
    async received(){ let n = 0; for (const pc of V.pcs.values()) (await pc.getStats()).forEach(r => { if (r.type === 'inbound-rtp' && r.kind === 'audio') n += r.bytesReceived || 0; }); return n; },
    state:() => ({ mates:[...V.mates.keys()], links:[...V.pcs.values()].map(p => p.connectionState), mic:!!V.mic, talking:V.talking, muted:V.muted }) };
})();
window.KVOICE = KVOICE;

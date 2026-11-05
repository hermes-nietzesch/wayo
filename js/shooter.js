/* =====================================================================
   Wayo shooter client: step 1, the guns range.
   Everything you see, hear and press for the guns lives here. The rules
   themselves are in rules.js. Prop hunt never runs this code.
   ===================================================================== */
const SHOOTER = (() => {
  const R = window.WAYO_RULES, W = R.WEAPONS;
  const el = s => document.querySelector(s);
  const S = { active:false, now:0, me:null, targets:[], trigger:false, pressed:false, ads:false, adsT:0, paused:false,
    pitchDebt:0, recoverDebt:0, vKick:0, vRoll:0, swing:0, bob:0, flashT:0, hitT:0, stats:null, last:'pistol' };

  /* ---------------- first-person gun, drawn after the world so it never pokes through walls */
  const vmScene = new THREE.Scene(), vmCam = new THREE.PerspectiveCamera(46, 1, 0.01, 10), rig = new THREE.Group();
  rig.scale.setScalar(0.72);
  vmScene.add(rig, new THREE.HemisphereLight(0xf2f5ff, 0x5a4a3c, 1.5));
  const vmSun = new THREE.DirectionalLight(0xfff1dc, 2.2); vmSun.position.set(1, 2, 1.2); vmScene.add(vmSun);
  const mat = (c, r = 0.55, m = 0.5) => new THREE.MeshStandardMaterial({ color:new THREE.Color(c).convertSRGBToLinear(), roughness:r, metalness:m });
  const STEEL = mat(0x24262a, 0.42, 0.75), DARK = mat(0x121316, 0.6, 0.4), WOOD = mat(0x6a3d1e, 0.6, 0.05), PLASTIC = mat(0x1d2024, 0.75, 0.1), SKIN = mat(0x5b3a26, 0.75, 0), SLEEVE = mat(0x2c3138, 0.9, 0), BLADE = mat(0xc4cad0, 0.25, 0.9);
  function part(g, m, sx, sy, sz, x, y, z, rx = 0){ const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); b.rotation.x = rx; g.add(b); return b; }
  function tube(g, m, r, len, x, y, z){ const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), m); b.rotation.x = Math.PI / 2; b.position.set(x, y, z); g.add(b); return b; }
  function arm(g, x, y, z, ry = 0){ const a = new THREE.Group(); part(a, SKIN, 0.085, 0.085, 0.1, 0, 0, 0); part(a, SLEEVE, 0.095, 0.095, 0.42, 0, -0.03, 0.25, 0.15); a.position.set(x, y, z); a.rotation.y = ry; g.add(a); return a; }
  const GUNS = {
    pistol(g){ part(g, STEEL, 0.04, 0.05, 0.24, 0, 0.03, -0.1); part(g, PLASTIC, 0.036, 0.13, 0.065, 0, -0.06, 0.0, 0.2); part(g, DARK, 0.042, 0.02, 0.08, 0, -0.005, -0.1); g.userData.tip = -0.23; arm(g, 0, -0.1, 0.04); arm(g, -0.05, -0.1, 0.06, 0.35); },
    smg(g){ part(g, STEEL, 0.05, 0.07, 0.34, 0, 0.02, -0.12); tube(g, DARK, 0.012, 0.12, 0, 0.03, -0.35); part(g, DARK, 0.03, 0.2, 0.05, 0, -0.1, -0.13); part(g, PLASTIC, 0.04, 0.12, 0.055, 0, -0.07, 0.03, 0.25); part(g, DARK, 0.02, 0.02, 0.2, 0, 0.0, 0.14); g.userData.tip = -0.41; arm(g, 0, -0.11, 0.05); arm(g, -0.015, -0.03, -0.2, 0.3); },
    rifle(g){ part(g, STEEL, 0.05, 0.075, 0.42, 0, 0.02, -0.08); part(g, WOOD, 0.055, 0.06, 0.24, 0, 0.0, -0.38); tube(g, DARK, 0.012, 0.3, 0, 0.038, -0.6); part(g, WOOD, 0.045, 0.095, 0.24, 0, -0.015, 0.23, 0.12); const m = part(g, DARK, 0.035, 0.2, 0.08, 0, -0.1, -0.19, -0.3); m.position.y = -0.11; part(g, PLASTIC, 0.04, 0.11, 0.055, 0, -0.07, 0.07, 0.25); part(g, DARK, 0.012, 0.03, 0.012, 0, 0.075, -0.48); g.userData.tip = -0.76; arm(g, 0, -0.11, 0.09); arm(g, -0.015, -0.035, -0.38, 0.3); },
    shotgun(g){ tube(g, STEEL, 0.02, 0.62, 0, 0.04, -0.34); tube(g, DARK, 0.017, 0.46, 0, -0.005, -0.26); part(g, STEEL, 0.05, 0.08, 0.24, 0, 0.02, 0.0); part(g, WOOD, 0.056, 0.05, 0.16, 0, -0.01, -0.36); part(g, WOOD, 0.045, 0.1, 0.28, 0, -0.03, 0.25, 0.18); g.userData.tip = -0.66; arm(g, 0, -0.1, 0.12); arm(g, -0.015, -0.05, -0.36, 0.3); },
    knife(g){ const b = part(g, BLADE, 0.012, 0.04, 0.24, 0, 0.0, -0.17); b.scale.y = 0.9; part(g, DARK, 0.036, 0.05, 0.03, 0, -0.002, -0.04); part(g, PLASTIC, 0.03, 0.04, 0.13, 0, -0.002, 0.04); g.userData.tip = -0.3; arm(g, 0, -0.03, 0.05); },
  };
  const GM = {};
  for (const id in GUNS){ const g = new THREE.Group(); GUNS[id](g); g.visible = false; rig.add(g); GM[id] = g; }
  function glowTex(inner, outer){ const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 1, 32, 32, 31); r.addColorStop(0, inner); r.addColorStop(0.35, outer); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
  const FLASH = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex('#fff8dc', 'rgba(255,170,60,.85)'), blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false, transparent:true }));
  FLASH.visible = false; rig.add(FLASH);

  /* ---------------- world effects: tracers, bullet marks and dust, all from small pools */
  const FX = { tr:[], mark:[], puff:[], ti:0, mi:0, pi:0 };
  const trM = new THREE.MeshBasicMaterial({ color:0xffd48a, transparent:true, opacity:0.75, blending:THREE.AdditiveBlending, depthWrite:false, fog:false });
  const trG = new THREE.BoxGeometry(0.014, 0.014, 1), mkG = new THREE.CircleGeometry(0.045, 8), mkM = new THREE.MeshBasicMaterial({ color:0x17120e, transparent:true, opacity:0.85, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2 });
  const dust = glowTex('rgba(205,190,170,.75)', 'rgba(170,150,130,.4)'), blood = glowTex('rgba(150,20,16,.9)', 'rgba(110,12,10,.55)');
  function makeFx(){
    if (FX.tr.length) return;
    for (let i = 0; i < 20; i++){ const m = new THREE.Mesh(trG, trM); m.visible = false; m.frustumCulled = false; scene.add(m); FX.tr.push({ m, life:0 }); }
    for (let i = 0; i < 48; i++){ const m = new THREE.Mesh(mkG, mkM); m.visible = false; scene.add(m); FX.mark.push(m); }
    for (let i = 0; i < 16; i++){ const m = new THREE.Sprite(new THREE.SpriteMaterial({ map:dust, transparent:true, depthWrite:false })); m.visible = false; scene.add(m); FX.puff.push({ m, life:0 }); }
  }
  const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  function tracer(ax, ay, az, bx, by, bz){
    const t = FX.tr[FX.ti++ % FX.tr.length], len = Math.hypot(bx - ax, by - ay, bz - az); if (len < 3) return;
    t.a = [ax, ay, az]; t.d = [(bx - ax) / len, (by - ay) / len, (bz - az) / len]; t.len = len; t.s = 0; t.life = 1;
    t.m.visible = true; t.m.position.set(ax, ay, az); t.m.lookAt(bx, by, bz);
  }
  function impact(x, y, z, o, onBody){
    if (!onBody){ const m = FX.mark[FX.mi++ % FX.mark.length]; m.position.set(x, y, z); m.lookAt(o[0], o[1], o[2]); m.translateZ(0.015); m.visible = true; }
    const p = FX.puff[FX.pi++ % FX.puff.length]; p.m.material.map = onBody ? blood : dust; p.m.position.set(x, y, z); p.m.scale.setScalar(0.12); p.m.material.opacity = 0.9; p.m.visible = true; p.life = 1;
  }
  function tickFx(dt){
    for (const t of FX.tr){ if (t.life <= 0) continue; t.s += 240 * dt; const seg = Math.min(7, t.s), mid = t.s - seg / 2; if (t.s - seg >= t.len){ t.life = 0; t.m.visible = false; continue; } t.m.position.set(t.a[0] + t.d[0] * mid, t.a[1] + t.d[1] * mid, t.a[2] + t.d[2] * mid); t.m.scale.z = seg; }
    for (const p of FX.puff){ if (p.life <= 0) continue; p.life -= dt * 3; p.m.scale.setScalar(0.12 + (1 - p.life) * 0.5); p.m.position.y += dt * 0.5; p.m.material.opacity = Math.max(0, p.life) * 0.9; if (p.life <= 0) p.m.visible = false; }
  }

  /* ---------------- sound: real recorded gunshots from audio/guns, with small changes so repeat shots differ.
     The knife, clicks and reload noises are still made in the browser. */
  let AC = null;
  function audio(){ if (!AC){ try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function noise(dur){ const b = AC.createBuffer(1, Math.max(1, AC.sampleRate * dur), AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); return b; }
  function blast(vol, dur, freq, q = 0.8){ const A = audio(); if (!A) return; const s = A.createBufferSource(), f = A.createBiquadFilter(), g = A.createGain(), t = A.currentTime; s.buffer = noise(dur); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.15), t + dur); f.Q.value = q; g.gain.value = vol; s.connect(f).connect(g).connect(A.destination); s.start(t); }
  function thump(vol, f0, dur){ const A = audio(); if (!A) return; const o = A.createOscillator(), g = A.createGain(), t = A.currentTime; o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(40, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(A.destination); o.start(t); o.stop(t + dur); }
  const BANG = { pistol:[0.55, 0.16, 4200, 160], smg:[0.42, 0.1, 5200, 190], rifle:[0.6, 0.2, 3600, 130], shotgun:[0.85, 0.32, 2400, 95] };
  const SHOTS = { pistol:{ n:2, gain:0.85 }, smg:{ n:5, gain:0.72 }, rifle:{ n:4, gain:0.9 }, shotgun:{ n:4, gain:1 } };
  const BUF = {}, lastTake = {}; let limiter = null, soundsLoading = false;
  function loadShots(){
    const A = audio(); if (!A || soundsLoading) return; soundsLoading = true;
    limiter = A.createDynamicsCompressor(); limiter.threshold.value = -6; limiter.ratio.value = 12; limiter.attack.value = 0.002; limiter.release.value = 0.12; limiter.connect(A.destination);
    for (const id in SHOTS){
      BUF[id] = [];
      for (let i = 1; i <= SHOTS[id].n; i++) fetch(`audio/guns/${id}${i}.mp3`).then(r => r.arrayBuffer()).then(b => A.decodeAudioData(b)).then(d => BUF[id].push(d)).catch(() => {});
    }
  }
  // dist is in metres: far shots get quieter and lose their top end, ready for bots firing across the market
  function bang(id, dist = 0){
    const list = BUF[id], A = AC;
    if (!list || !list.length || !A){ const b = BANG[id]; if (b){ blast(b[0], b[1], b[2]); thump(b[0] * 0.8, b[3], b[1] * 1.2); } else blast(0.12, 0.12, 2800, 2); return; }
    let k = Math.floor(Math.random() * list.length); if (list.length > 1 && k === lastTake[id]) k = (k + 1) % list.length; lastTake[id] = k;
    const src = A.createBufferSource(), g = A.createGain(), lp = A.createBiquadFilter();
    src.buffer = list[k]; src.playbackRate.value = 0.97 + Math.random() * 0.06;
    lp.type = 'lowpass'; lp.frequency.value = dist > 0 ? Math.max(900, 14000 / (1 + dist / 12)) : 20000;
    g.gain.value = SHOTS[id].gain * (0.92 + Math.random() * 0.08) / (1 + dist / 14);
    src.connect(lp).connect(g).connect(limiter); src.start();
  }
  const click = (v = 0.18, f = 3000) => blast(v, 0.03, f, 3);

  /* ---------------- on-screen display */
  function buildHud(){
    if (el('#shHud')) return;
    const css = document.createElement('style');
    css.textContent = `
body.sh-on #cross,body.sh-on #gbtns{display:none!important}
#shHud{position:fixed;inset:0;z-index:5;pointer-events:none;font:700 14px/1.2 var(--body)}
#shX{position:absolute;left:50%;top:50%;width:0;height:0}
#shX i{position:absolute;background:#fff;box-shadow:0 0 2px #000}
#shX .u,#shX .d{width:2px;height:9px;left:-1px}#shX .l,#shX .r{height:2px;width:9px;top:-1px}
#shX.knife i{display:none}
#shHit{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px;opacity:0;transform:rotate(45deg)}
#shHit:before,#shHit:after{content:"";position:absolute;background:#fff;box-shadow:0 0 2px #000}
#shHit:before{left:12px;top:0;bottom:0;width:2px;background:linear-gradient(#fff 0 35%,transparent 35% 65%,#fff 65%)}
#shHit:after{top:12px;left:0;right:0;height:2px;background:linear-gradient(90deg,#fff 0 35%,transparent 35% 65%,#fff 65%)}
#shHit.head:before{background:linear-gradient(#ff3b2f 0 35%,transparent 35% 65%,#ff3b2f 65%)}#shHit.head:after{background:linear-gradient(90deg,#ff3b2f 0 35%,transparent 35% 65%,#ff3b2f 65%)}
#shAmmo{position:absolute;right:calc(env(safe-area-inset-right,0px) + 24px);bottom:calc(env(safe-area-inset-bottom,0px) + 20px);text-align:right;text-shadow:0 1px 3px #000}
#shAmmo b{display:block;font:400 42px/1 var(--display);font-variant-numeric:tabular-nums}#shAmmo b small{font:700 17px/1 var(--body);color:var(--muted)}
#shAmmo span{color:var(--accent);letter-spacing:.06em;text-transform:uppercase;font-size:13px}#shAmmo.low b{color:var(--accent)}
#shSlots{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);transform:translateX(-50%);display:flex;gap:6px;pointer-events:auto}
#shSlots button{min-width:62px;height:46px;border-radius:7px;background:rgba(8,8,11,.6);border:1.5px solid var(--line);color:var(--muted);font:700 11px/1.1 var(--body);padding:3px 6px;touch-action:none}
#shSlots button[aria-pressed="true"]{border-color:var(--accent);color:#fff;background:rgba(225,32,26,.5)}#shSlots kbd{display:block;font:700 10px/1 var(--body);opacity:.7;margin-bottom:3px}
#shStats{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 12px);transform:translateX(-50%);background:rgba(8,8,11,.55);padding:6px 12px;border-radius:7px;color:var(--muted);white-space:nowrap;font-size:12px}#shStats b{color:#fff}
#shReload{position:absolute;left:50%;top:calc(50% + 34px);transform:translateX(-50%);width:90px;height:4px;background:rgba(0,0,0,.5);border-radius:2px;overflow:hidden}#shReload i{display:block;height:100%;background:var(--accent);width:0}
#shFloat span{position:absolute;font:400 18px/1 var(--display);color:#fff;text-shadow:0 1px 3px #000;transform:translate(-50%,-50%);transition:transform .55s ease-out,opacity .55s ease-in}
#shFloat span.head{color:#ff3b2f;font-size:23px}
#shPause{position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:2}
#shPause div{text-align:center}#shPause h2{font:400 28px/1 var(--display);margin:0 0 14px}#shPause button,#shExit{background:rgba(8,8,11,.75);border:1.5px solid var(--line);color:#fff;border-radius:7px;padding:11px 18px;font:700 14px/1 var(--body);margin:0 5px;cursor:pointer}#shPause button.go{background:var(--red);border-color:var(--red)}
#shExit{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);right:calc(env(safe-area-inset-right,0px) + 122px);pointer-events:auto;padding:8px 12px;font-size:12px}
#shTouch{position:absolute;inset:0;pointer-events:none}
#shTouch button{position:absolute;pointer-events:auto;border-radius:50%;background:rgba(8,8,11,.5);border:2px solid rgba(255,255,255,.45);color:#fff;font:400 12px/1 var(--display);touch-action:none;-webkit-user-select:none;user-select:none}
#shFire{width:104px;height:104px;right:calc(env(safe-area-inset-right,0px) + 26px);bottom:calc(env(safe-area-inset-bottom,0px) + 110px);background:rgba(225,32,26,.5)!important;border-color:var(--accent)!important}
#shFireL{width:64px;height:64px;left:calc(env(safe-area-inset-left,0px) + 30px);bottom:calc(env(safe-area-inset-bottom,0px) + 188px);background:rgba(225,32,26,.4)!important}
#shAim{width:66px;height:66px;right:calc(env(safe-area-inset-right,0px) + 142px);bottom:calc(env(safe-area-inset-bottom,0px) + 168px)}#shAim[aria-pressed="true"]{background:var(--red)}
#shRel{width:60px;height:60px;right:calc(env(safe-area-inset-right,0px) + 146px);bottom:calc(env(safe-area-inset-bottom,0px) + 92px)}
body.sh-on.sh-touch #shAmmo{bottom:auto;top:calc(env(safe-area-inset-top,0px) + 56px);right:auto;left:calc(env(safe-area-inset-left,0px) + 14px);text-align:left}
body.sh-on.sh-touch #shAmmo b{font-size:30px}
body.sh-on #streetName,body.sh-on #coords{display:none}`;
    document.head.appendChild(css);
    const d = document.createElement('div'); d.id = 'shHud'; d.hidden = true;
    d.innerHTML = `<div id="shX"><i class="u"></i><i class="d"></i><i class="l"></i><i class="r"></i></div><div id="shHit"></div><div id="shFloat"></div>
<div id="shStats"></div><div id="shReload" hidden><i></i></div><div id="shAmmo"><b id="shMag"></b><span id="shName"></span></div><div id="shSlots"></div>
${TOUCH ? '<div id="shTouch"><button id="shFire">FIRE</button><button id="shFireL" aria-label="Fire">FIRE</button><button id="shAim" aria-pressed="false">AIM</button><button id="shRel">RELOAD</button></div><button id="shExit">Exit</button>' : ''}
<div id="shPause" hidden><div><h2>Paused</h2><button class="go" id="shResume">Keep shooting</button><button id="shQuit">Back to menu</button></div></div>`;
    document.body.appendChild(d);
    const sl = el('#shSlots');
    for (const id of R.ORDER){ const b = document.createElement('button'); b.dataset.w = id; b.innerHTML = `${TOUCH ? '' : `<kbd>${W[id].slot}</kbd>`}${W[id].name}`; b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); swap(id); }); sl.appendChild(b); }
    el('#shResume').addEventListener('click', () => { setPaused(false); canvas.requestPointerLock?.()?.catch?.(() => {}); });
    el('#shQuit').addEventListener('click', stop);
    if (TOUCH){
      for (const id of ['#shFire', '#shFireL']){
        // the fire button also steers, so your thumb can aim and shoot at once
        const b = el(id); let p = null;
        b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.setPointerCapture(e.pointerId); p = [e.clientX, e.clientY]; setTrigger(true); });
        b.addEventListener('pointermove', e => { if (!p) return; look.dx += (e.clientX - p[0]) * 0.005 * SENS; look.dy += (e.clientY - p[1]) * 0.005 * SENS; p = [e.clientX, e.clientY]; });
        const up = () => { p = null; setTrigger(false); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      }
      el('#shAim').addEventListener('pointerdown', e => { e.preventDefault(); S.ads = !S.ads; el('#shAim').setAttribute('aria-pressed', String(S.ads)); });
      el('#shRel').addEventListener('pointerdown', e => { e.preventDefault(); reload(); });
      el('#shExit').addEventListener('click', stop);
    }
  }
  function setPaused(v){ S.paused = v; el('#shPause').hidden = !v; if (v) setTrigger(false); }
  function drawHud(){
    const f = S.me, w = W[f.weapon], a = f.ammo[f.weapon];
    el('#shMag').innerHTML = w.melee ? '&nbsp;' : `${a.mag} <small>/ ${a.reserve}</small>`;
    el('#shName').textContent = w.name; el('#shAmmo').classList.toggle('low', !w.melee && a.mag <= Math.ceil(w.mag * 0.2));
    for (const b of el('#shSlots').children) b.setAttribute('aria-pressed', String(b.dataset.w === f.weapon));
    const st = S.stats; el('#shStats').innerHTML = `Hits <b>${st.hits}</b> · Headshots <b>${st.heads}</b> · Down <b>${st.kills}</b> · Accuracy <b>${st.shots ? Math.round(st.hits / st.shots * 100) : 0}%</b>`;
  }
  function floatNum(x, y, z, n, head){
    _v.set(x, y, z).project(camera); if (_v.z > 1) return;
    const s = document.createElement('span'); s.textContent = n; if (head) s.className = 'head'; s.style.left = (_v.x + 1) / 2 * innerWidth + 'px'; s.style.top = (1 - _v.y) / 2 * innerHeight + 'px';
    el('#shFloat').appendChild(s); requestAnimationFrame(() => { s.style.transform = 'translate(-50%,-160%)'; s.style.opacity = 0; }); setTimeout(() => s.remove(), 600);
  }
  function hitMark(head){ const h = el('#shHit'); h.className = head ? 'head' : ''; S.hitT = 0.16; h.style.opacity = 1; }

  /* ---------------- targets: Task Force and traders who walk the street. They don't shoot back yet. */
  function streetSpots(){ const pts = []; for (const st of LAYOUT.streets) walkLine(st.pts, 5, (x, z) => { if (inPlay(x, z, -4) && !blockedAt(x, z, 0.7)) pts.push([x, z, st.name]); }); return pts; }
  function clearPath(a, b){ const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / 1.2); for (let i = 0; i <= n; i++){ const t = i / n; if (blockedAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0.5)) return false; } return true; }
  function spawnTargets(spots){
    const dbg = GAME.debug, chars = ['task_force', 'trader_man', 'trader_woman'];
    const home = spots.slice().sort((a, b) => Math.hypot(a[0] - P.x, a[1] - P.z) - Math.hypot(b[0] - P.x, b[1] - P.z));
    const picks = []; for (const s of home){ const d = Math.hypot(s[0] - P.x, s[1] - P.z); if (d < 8 || picks.some(p => Math.hypot(p[0] - s[0], p[1] - s[1]) < 7)) continue; picks.push(s); if (picks.length === 9) break; }
    picks.forEach((s, i) => {
      const T = R.newFighter({ id:'t' + i, x:s[0], z:s[1] }); T.y = groundAt(s[0], s[1], 2); T.ry = Math.random() * 6.28;
      T.A = dbg.makeAvatar(chars[i % 3]); T.home = [s[0], s[1]];
      const other = home.find(o => { const d = Math.hypot(o[0] - s[0], o[1] - s[1]); return d > 7 && d < 18 && clearPath(s, o); });
      T.path = i % 3 !== 2 && other ? [[s[0], s[1]], [other[0], other[1]]] : null; T.leg = 1; T.wait = Math.random() * 2; T.deadT = 0;
      S.targets.push(T);
    });
  }
  function tickTargets(dt){
    const dbg = GAME.debug;
    for (const T of S.targets){
      let sp = 0;
      if (!T.alive){ T.deadT -= dt; if (T.deadT <= 0) revive(T); }
      else if (T.path){
        if (T.wait > 0) T.wait -= dt;
        else { const g = T.path[T.leg], dx = g[0] - T.x, dz = g[1] - T.z, d = Math.hypot(dx, dz); if (d < 0.3){ T.leg = 1 - T.leg; T.wait = 0.4 + Math.random() * 1.6; } else { sp = T.fast ? 5.5 : 2.6; const m = Math.min(d, sp * dt); T.x += dx / d * m; T.z += dz / d * m; T.ry = Math.atan2(dx, dz); T.y = groundAt(T.x, T.z, T.y + 1); } }
      }
      T.A.root.position.set(T.x, T.y, T.z); T.A.root.rotation.set(0, T.ry, 0); dbg.animateAvatar(T.A, sp, dt);
    }
  }
  function revive(T){ T.hp = T.maxHp; T.alive = true; T.x = T.home[0]; T.z = T.home[1]; T.y = groundAt(T.x, T.z, 2); T.leg = 1; if (T.A.shot){ T.A.shot.a.stop(); T.A.shot = null; } }

  /* ---------------- shooting */
  const eye = () => [camera.position.x, camera.position.y, camera.position.z];
  function aimDir(){ camera.getWorldDirection(_v); return [_v.x, _v.y, _v.z]; }
  function moveState(){ const moving = !!(keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight || Math.hypot(stick.x, stick.y) > 0.15); return { ads:S.ads, moving, running:moving && !!(P.run || keys.ShiftLeft || keys.ShiftRight), airborne:!P.onGround }; }
  function hurt(T, hit, id){
    const dmg = R.damageAt(id, hit.t, hit.zone), res = R.applyDamage(T, dmg); S.stats.hits++; if (hit.zone === 'head') S.stats.heads++;
    return { dmg, killed:res.killed };
  }
  function shoot(){
    const f = S.me, id = f.weapon, w = W[id], o = eye(), shot = R.fire(f, aimDir(), moveState(), S.now, Math.random);
    if (!shot) return false;
    bang(id); S.stats.shots++;
    if (w.melee){
      S.swing = 1;
      const hit = R.knifeTrace(o, shot.dirs[0], S.targets, near, f);
      if (hit){ const r = hurt(hit.target, hit, id); report(hit.target, [{ d:r.dmg, head:false, at:[hit.target.x, hit.target.y + 1.2, hit.target.z] }], r.killed); blast(0.3, 0.09, 1400, 2); }
      return true;
    }
    const tally = new Map(); let hits = 0;
    camera.getWorldDirection(_a); _b.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const mx = o[0] + _a.x * 0.7 + _b.x * 0.18, my = o[1] + _a.y * 0.7 - 0.13, mz = o[2] + _a.z * 0.7 + _b.z * 0.18;
    shot.dirs.forEach((d, i) => {
      const hit = R.traceShot(o, d, w.range, S.targets, near, f), x = o[0] + d[0] * hit.t, y = o[1] + d[1] * hit.t, z = o[2] + d[2] * hit.t;
      if (i % 3 === 0) tracer(mx, my, mz, x, y, z);
      if (hit.t < w.range) impact(x, y, z, o, !!hit.target);
      if (hit.target){ hits++; const r = hurt(hit.target, hit, id), e = tally.get(hit.target) || { list:[], killed:false }; e.list.push({ d:r.dmg, head:hit.zone === 'head', at:[x, y, z] }); e.killed = e.killed || r.killed; tally.set(hit.target, e); }
    });
    if (hits > 1) S.stats.hits -= hits - 1;   // a shotgun blast counts as one hit on the score line
    for (const [T, e] of tally){ const sum = e.list.reduce((a, b) => a + b.d, 0), head = e.list.some(h => h.head); report(T, [{ d:sum, head, at:e.list[0].at }], e.killed); }
    S.vKick = 1; S.vRoll = (Math.random() - 0.5); S.flashT = 0.045;
    S.pitchDebt += w.kick * (S.ads ? 0.6 : 1); P.yaw += (Math.random() - 0.5) * w.kick * 0.5;
    return true;
  }
  function report(T, parts, killed){
    const p = parts[0]; floatNum(p.at[0], p.at[1], p.at[2], p.d, p.head); hitMark(p.head); click(0.22, p.head ? 4800 : 3400);
    if (killed){ S.stats.kills++; T.deadT = 3; GAME.debug.playOnce(T.A, 'Caught', true); }
  }
  function setTrigger(v){ if (v && !S.trigger) S.pressed = true; S.trigger = v; }
  function swap(id){ if (!S.active) return; const cur = S.me.weapon; if (R.switchWeapon(S.me, id, S.now)){ S.last = cur; click(0.14, 1800); } }
  function reload(){ if (S.active && R.startReload(S.me, S.now)) click(0.16, 1500); }
  function dry(){ click(0.2, 2400); }

  /* ---------------- first-person gun movement */
  function drawGun(dt){
    const f = S.me, id = f.weapon;
    for (const k in GM) GM[k].visible = k === id;
    const w = W[id], g = GM[id];
    S.adsT += ((S.ads && !w.melee ? 1 : 0) - S.adsT) * Math.min(1, dt * 14);
    S.vKick = Math.max(0, S.vKick - dt * (w.melee ? 3 : 9));
    const m = moveState(); S.bob += dt * (m.running ? 13 : m.moving ? 9 : 2);
    const amp = (m.running ? 0.012 : m.moving ? 0.007 : 0.0015) * (1 - S.adsT * 0.8);
    const rel = R.reloading(f, S.now) ? Math.sin(Math.PI * Math.min(1, 1 - (f.reloadAt - S.now) / W[f.reloadId].reload)) : 0;
    const sw = S.now < f.swapAt ? (f.swapAt - S.now) / 0.32 : 0;
    const a = S.adsT;
    rig.position.set(0.19 - a * 0.1 + Math.cos(S.bob * 0.5) * amp, -0.135 - a * 0.012 + Math.abs(Math.sin(S.bob * 0.5)) * amp - rel * 0.1 - sw * 0.28, -0.62 - a * 0.06 + S.vKick * (w.pellets > 1 ? 0.09 : 0.04));
    rig.rotation.set(S.vKick * 0.05 * (w.pellets > 1 ? 2.2 : 1) + rel * 0.9, 0.05 * (1 - a), S.vKick * S.vRoll * 0.04 + rel * 0.35);
    if (w.melee && S.swing > 0){ S.swing = Math.max(0, S.swing - dt * 4); const t = Math.sin(S.swing * Math.PI); rig.rotation.x = -t * 0.5; rig.rotation.y = t * 0.8; rig.position.x -= t * 0.2; rig.position.z -= t * 0.18; }
    if (S.flashT > 0){ S.flashT -= dt; FLASH.visible = true; FLASH.position.set(0, 0.03, g.userData.tip - 0.05); FLASH.scale.setScalar((id === 'shotgun' ? 0.42 : 0.28) * (0.8 + Math.random() * 0.5)); FLASH.material.rotation = Math.random() * 6; } else FLASH.visible = false;
    vmCam.aspect = camera.aspect; vmCam.updateProjectionMatrix();
  }
  function drawCross(dt){
    const f = S.me, w = W[f.weapon], x = el('#shX');
    x.classList.toggle('knife', !!w.melee); x.style.opacity = S.adsT > 0.8 && f.weapon !== 'shotgun' ? 0.35 : 1;
    const sp = R.spreadOf(f, moveState()), gap = 3 + Math.tan(sp) / Math.tan(camera.fov * Math.PI / 360) * innerHeight / 2;
    const c = x.children; c[0].style.top = -gap - 9 + 'px'; c[1].style.top = gap + 'px'; c[2].style.left = -gap - 9 + 'px'; c[3].style.left = gap + 'px';
    const rl = el('#shReload'); rl.hidden = !R.reloading(f, S.now); if (!rl.hidden) rl.firstChild.style.width = (1 - (f.reloadAt - S.now) / W[f.reloadId].reload) * 100 + '%';
    if (S.hitT > 0){ S.hitT -= dt; if (S.hitT <= 0) el('#shHit').style.opacity = 0; }
  }

  /* ---------------- start, stop and the per-frame step */
  const STAND = { WALK, RUN, fov:camera.fov };
  function start(){
    if (S.active || !GAME.S.ready) return;
    buildHud(); makeFx(); audio(); loadShots();
    const spots = streetSpots(), s = spots[Math.floor(spots.length / 2)];
    P.x = s[0]; P.z = s[1]; P.y = groundAt(s[0], s[1], 2); P.vy = 0; P.yaw = 0; P.pitch = 0; P.fly = false; P.frozen = false;
    S.me = R.newFighter({ weapon:'rifle' }); S.stats = { shots:0, hits:0, heads:0, kills:0 }; S.now = 0; S.ads = false; S.adsT = 0; S.trigger = false; S.pressed = false; S.targets = [];
    spawnTargets(spots);
    MUSIC.stop(); started = true; S.active = true; el('#start').hidden = true; el('#shHud').hidden = false; setPaused(false);
    document.body.classList.add('sh-on'); document.body.classList.toggle('sh-touch', TOUCH);
    if (!TOUCH) canvas.requestPointerLock?.()?.catch?.(() => {});
    toast(TOUCH ? 'Drag FIRE to aim and shoot' : 'Click to shoot · right-click to aim · R reload · 1 to 5 swap guns · Esc pause', 4200);
  }
  function stop(){
    if (!S.active) return;
    S.active = false; started = false; WALK = STAND.WALK; camera.fov = STAND.fov; camera.updateProjectionMatrix();
    for (const T of S.targets) scene.remove(T.A.root); S.targets = [];
    for (const g of [...FX.tr, ...FX.puff]){ g.m.visible = false; g.life = 0; } for (const m of FX.mark) m.visible = false;
    el('#shHud').hidden = true; el('#start').hidden = false; document.body.classList.remove('sh-on', 'sh-touch');
    if (document.pointerLockElement) document.exitPointerLock(); MUSIC.start();
  }
  function tick(dt){
    if (!S.active) return;
    if (S.paused) return;
    S.now += dt; const f = S.me, w = W[f.weapon];
    R.tick(f, dt, S.now);
    if (S.pressed || (S.trigger && w.auto)){
      const fired = shoot();
      if (!fired && S.pressed && !w.melee && f.ammo[f.weapon].mag === 0 && !R.reloading(f, S.now) && !R.startReload(f, S.now)) dry();
    }
    S.pressed = false;
    // recoil climbs quickly, then the view settles most of the way back
    const up = Math.min(S.pitchDebt, S.pitchDebt * dt * 30); S.pitchDebt -= up; P.pitch = Math.min(1.45, P.pitch + up); S.recoverDebt += up * 0.7;
    if (!S.trigger && S.recoverDebt > 0){ const d = Math.min(S.recoverDebt, S.recoverDebt * dt * 7 + 0.0004); P.pitch -= d; S.recoverDebt -= d; } 
    WALK = STAND.WALK * w.moveMul * (S.ads ? 0.62 : 1);
    const fov = STAND.fov + ((w.zoom || STAND.fov) - STAND.fov) * S.adsT; if (Math.abs(camera.fov - fov) > 0.01){ camera.fov = fov; camera.updateProjectionMatrix(); }
    tickTargets(dt); tickFx(dt); drawGun(dt); drawCross(dt); drawHud();
  }
  function render(){
    if (!S.active) return;
    const ac = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(vmScene, vmCam); renderer.autoClear = ac;
  }
  addEventListener('mousedown', e => {
    if (!S.active || S.paused || document.pointerLockElement !== canvas) return;
    if (e.button === 0) setTrigger(true); else if (e.button === 2) S.ads = true;
  });
  addEventListener('mouseup', e => { if (!S.active) return; if (e.button === 0) setTrigger(false); else if (e.button === 2) S.ads = false; });
  addEventListener('contextmenu', e => { if (S.active) e.preventDefault(); });
  addEventListener('keydown', e => {
    if (!S.active || e.repeat) return;
    if (e.code === 'KeyR') reload();
    else if (e.code === 'KeyQ') swap(S.last);
    else if (/^Digit[1-5]$/.test(e.code)) swap(R.ORDER[+e.code.slice(5) - 1]);
  });
  addEventListener('wheel', e => { if (!S.active || document.pointerLockElement !== canvas) return; const i = R.ORDER.indexOf(S.me.weapon), n = R.ORDER.length; swap(R.ORDER[(i + (e.deltaY > 0 ? 1 : n - 1)) % n]); }, { passive:true });
  document.addEventListener('pointerlockchange', () => { if (S.active && !TOUCH && !window.__TEST) setPaused(document.pointerLockElement !== canvas); });
  return { start, stop, tick, render, S, setTrigger, swap, reload, BUF };
})();
window.SHOOTER = SHOOTER;

// Kasala game server. A Room runs one match: friends who share a code, or strangers sent in by the Matchmaker.
// It runs the same rules.js and bots.js as the game, and it decides every hit, death, pickup and win.
import { DurableObject } from 'cloudflare:workers';
import { R, BOTS, near, groundAt, nav, AREA, LOOT } from './world.js';

const REGION = 'weur';            // 170 ms from Lagos on the ping test; the Africa hint lands in Amsterdam with bigger spikes
const MAX_PLAYERS = 10, SIDE = 5;
const TICK = 0.05, SEND_EVERY = 2; // 20 ticks a second, 10 updates a second to phones
const WIN_AT = 3, ROUND_TIME = 180, FREEZE = 2.5, BETWEEN = 4.5, LOAD_WAIT = 30;
const FFA_GOAL = 15, FFA_TIME = 360, RESPAWN = 4;
const FILL_WAIT = 20, FULL_WAIT = 3;   // a public match starts 20 s after its first player arrives, or 3 s after it fills
const LAG_MAX = 0.4;
const MODES = { team:{ sides:true }, ffa:{ sides:false }, br:{ sides:false, br:true }, brsq:{ sides:true, br:true } };
const BOT_NAMES = ['Chidi', 'Bisi', 'Tunde', 'Ngozi', 'Emeka', 'Aisha', 'Musa', 'Funke', 'Segun', 'Kemi'];
const BOT_GUNS = ['rifle', 'smg', 'rifle', 'pistol', 'shotgun', 'smg', 'rifle', 'sniper', 'shotgun', 'rifle'];
const FACTIONS = {
  task:{ name:'Task Force', ids:['tf', 'nysc_m', 'nysc_f', 'blazer', 'hoodie_m'] },
  zombies:{ name:'Zombies', ids:['zombie_tank', 'z_mech', 'z_cond', 'z_hawk', 'z_man'] },
  traders:{ name:'Traders', ids:['kaftan', 'stud_f', 'stud_m', 'chief', 'trader_m2', 'trader_f2'] },
  heroes:{ name:'Heroes', ids:['h_aba', 'h_one', 'h_second', 'h_stretch'] },
};
const LOOT_MIX = [['gun', 'rifle', 5], ['gun', 'smg', 4], ['gun', 'shotgun', 3], ['gun', 'sniper', 2], ['ammo', '', 11], ['armor', '', 8], ['med', '', 9]];
const ALL_IDS = Object.values(FACTIONS).flatMap(f => f.ids);
const factionOf = id => Object.keys(FACTIONS).find(k => FACTIONS[k].ids.includes(id));
const GUNS = R.ORDER, n2 = v => Math.round(v * 100) / 100, pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clean = (s, n) => String(s || '').replace(/[<>&"']/g, '').trim().slice(0, n);
const isFoe = (a, b) => a !== b && (a.team == null || a.team !== b.team);   // free-for-all fighters have no team
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers:{ 'content-type':'application/json', 'access-control-allow-origin':'*', 'cache-control':'no-store' } });

export class Room extends DurableObject {
  constructor(ctx, env){ super(ctx, env); this.people = new Map(); this.open = false; this.reset(); this.nextId = 1; }
  reset(){
    this.phase = 'lobby'; this.mode = 'team'; this.diff = 'medium'; this.public = false; this.F = []; this.round = null; this.fillAt = 0;
    if (this.timer) clearInterval(this.timer); if (this.fillTimer) clearInterval(this.fillTimer); this.timer = this.fillTimer = null;
  }

  async fetch(request){
    const url = new URL(request.url), pair = new WebSocketPair(), [client, ws] = Object.values(pair); ws.accept();
    const refuse = m => { ws.send(JSON.stringify({ t:'err', m, retry:this.public || !!url.searchParams.get('public') })); ws.close(1000, 'refused'); return new Response(null, { status:101, webSocket:client }); };
    const pub = MODES[url.searchParams.get('public')] ? url.searchParams.get('public') : null;
    if (pub){ if (!this.open){ this.reset(); this.open = true; this.public = true; this.mode = pub; } else if (!this.public || this.mode !== pub) return refuse('That match is not available'); }
    else if (url.searchParams.get('create')){ if (!this.open || !this.people.size){ this.reset(); this.open = true; } else return refuse('That room code is taken. Try again'); }
    else if (!this.open) return refuse('No room with that code');
    if (this.people.size >= MAX_PLAYERS) return refuse('That match is full');
    if (this.phase !== 'lobby') return refuse('That match has already started');
    this.code = url.searchParams.get('code');
    const count = s => [...this.people.values()].filter(p => p.side === s).length;
    const p = { ws, id:this.nextId++, name:clean(url.searchParams.get('name'), 16) || 'Player', char:clean(url.searchParams.get('char'), 16), side:count(0) <= count(1) ? 0 : 1, host:!this.people.size && !this.public, ready:false };
    if (!factionOf(p.char)) p.char = 'tf';
    this.people.set(ws, p);
    ws.addEventListener('message', e => { try { this.onMessage(p, JSON.parse(e.data)); } catch (err) { console.warn('bad message', err.message); } });
    const gone = () => this.leave(p); ws.addEventListener('close', gone); ws.addEventListener('error', gone);
    if (this.public){
      const now = Date.now(); if (!this.fillAt) this.fillAt = now + FILL_WAIT * 1000;
      if (this.people.size >= MAX_PLAYERS) this.fillAt = Math.min(this.fillAt, now + FULL_WAIT * 1000);
      if (!this.fillTimer) this.fillTimer = setInterval(() => { if (this.phase === 'lobby' && this.people.size && Date.now() >= this.fillAt) this.startMatch(); }, 250);
    }
    this.lobby(); this.report();
    return new Response(null, { status:101, webSocket:client });
  }
  // tell the matchmaker how full this public match is, so it sends new players to the right place
  report(){
    if (!this.public || !this.code) return;
    const open = this.open && this.phase === 'lobby' && this.people.size < MAX_PLAYERS && this.fillAt - Date.now() > 1500;
    const mm = this.env.MM.get(this.env.MM.idFromName('mm'), { locationHint:REGION });
    mm.fetch('https://mm/report', { method:'POST', body:JSON.stringify({ code:this.code, mode:this.mode, players:this.people.size, open, live:this.phase !== 'lobby' }) }).catch(() => {});
  }
  send(p, m){ try { p.ws.send(typeof m === 'string' ? m : JSON.stringify(m)); } catch (e) {} }
  all(m){ const s = JSON.stringify(m); for (const p of this.people.values()) this.send(p, s); }
  others(me, m){ const s = JSON.stringify(m); for (const p of this.people.values()) if (p !== me) this.send(p, s); }
  lobby(){
    const wait = this.public ? Math.max(0, (this.fillAt - Date.now()) / 1000) : 0;
    for (const p of this.people.values()) this.send(p, { t:'lobby', code:this.code, you:p.id, mode:this.mode, diff:this.diff, public:this.public, wait, players:[...this.people.values()].map(q => ({ id:q.id, name:q.name, char:q.char, side:q.side, host:q.host })) });
  }
  leave(p){
    if (!this.people.delete(p.ws)) return;
    try { p.ws.close(); } catch (e) {}
    if (p.host){ const n = this.people.values().next().value; if (n) n.host = true; }
    if (!this.people.size){ const code = this.code, pub = this.public; this.reset(); this.open = false; if (pub){ this.public = true; this.report(); this.public = false; } this.code = code; return; }
    this.report();
    if (this.phase === 'lobby') return this.lobby();
    if (p.idx != null) this.becomeBot(p);
    this.tryGo();
  }
  // someone dropped out: a bot takes over their fighter so the teams stay even
  becomeBot(p){
    const f = this.F[p.idx]; if (!f) return;
    const b = BOTS.newBot({ id:f.id, name:f.name, x:f.x, z:f.z, weapon:f.weapon, team:f.team }, this.diff);
    Object.assign(b, { y:f.y, hp:f.hp, armor:f.armor, alive:f.alive, kills:f.kills, deaths:f.deaths, ammo:f.ammo, owned:f.owned, ry:f.ry, aimYaw:f.aimYaw, deadT:f.alive ? 0 : (MODES[this.mode].sides || MODES[this.mode].br ? 1e9 : RESPAWN), hist:f.hist, place:f.place });
    this.F[p.idx] = b; this.W.fighters[p.idx] = b;
    this.all({ t:'n', m:p.name + ' left. A bot took over' });
  }
  onMessage(p, a){
    if (Array.isArray(a)){ const k = a[0]; if (k === 'i') return this.input(p, a); if (k === 's') return this.shot(p, a); if (k === 'r') return this.reloadNow(p); if (k === 'w') return this.swapNow(p, a[1]); return; }
    if (this.phase === 'lobby'){
      if (a.t === 'side' && !this.public){ const to = 1 - p.side; if ([...this.people.values()].filter(q => q.side === to).length < SIDE){ p.side = to; this.lobby(); } }
      else if (a.t === 'char' && factionOf(a.char)){ p.char = a.char; this.lobby(); }
      else if (a.t === 'opt' && p.host){ if (BOTS.DIFF[a.diff]) this.diff = a.diff; if (MODES[a.mode]) this.mode = a.mode; this.lobby(); }
      else if (a.t === 'start' && p.host) this.startMatch();
    } else if ((a.t === 'sig' || a.t === 'talk') && p.idx != null){
      // voice: pass call setup and talking lights only between people on the same side
      const me = this.F[p.idx]; if (!me || me.team == null) return;
      for (const q of this.people.values()){
        if (q === p || q.idx == null || (a.t === 'sig' && q.idx !== a.to)) continue;
        const f = this.F[q.idx]; if (!f || f.isBot || f.team !== me.team) continue;
        this.send(q, a.t === 'sig' ? { t:'sig', from:p.idx, d:a.d } : { t:'talk', from:p.idx, on:!!a.on });
      }
    } else if (a.t === 'ready'){ p.ready = true; if (this.phase === 'load') this.tryGo(); else if (this.round) this.send(p, this.roundMsg()); }
  }
  /* ---------------- starting a match */
  startMatch(){
    if (this.phase !== 'lobby') return;
    if (this.fillTimer){ clearInterval(this.fillTimer); this.fillTimer = null; }
    const humans = [...this.people.values()], M = MODES[this.mode], br = !!M.br;
    this.W = { fighters:[], near, nav, groundAt, rand:Math.random, now:0, intel:{}, onShot:(b, shot, o) => this.botShot(b, shot, o), onItem:(it, b) => this.taken(it, b), onGear:() => {} };
    this.now = 0; this.score = [0, 0]; this.F = []; this.items = null; this.zone = null; this.freeze = 0; this.endIn = 0; this.ended = false; this.ffaT = FFA_TIME; this.dead = 0;
    const roster = [], kit = () => br ? { weapon:'pistol', loadout:['pistol', 'knife'] } : { weapon:'rifle' };
    let botN = 0, names = [];
    const human = (q, team) => {
      const f = R.newFighter({ id:'p' + q.id, team, ...kit() }); Object.assign(f, { name:q.name, ry:0, aimYaw:0, aimPitch:0, speed:0, stance:0, vx:0, vz:0, kills:0, deaths:0, human:q, hist:[] });
      q.idx = this.F.length; q.ready = false; this.F.push(f); roster.push({ name:q.name, char:q.char, team, weapon:f.weapon, human:true, id:q.id });
    };
    const bot = (team, char) => {
      const gun = br ? 'pistol' : BOT_GUNS[botN], b = BOTS.newBot({ id:'b' + botN, name:BOT_NAMES[botN], weapon:gun, team, loadout:br ? ['pistol'] : undefined }, this.diff); b.hist = [];
      this.F.push(b); roster.push({ name:b.name, char, team, weapon:gun }); botN++;
    };
    if (M.sides){
      // each side plays as the team of the first person on it; an empty side, or a clash, gets another team
      const first = s => { const h = humans.find(q => q.side === s); return h ? factionOf(h.char) : null; };
      const keys = Object.keys(FACTIONS); let a = first(0), b = first(1);
      if (!a) a = pick(keys.filter(k => k !== b)); if (!b) b = pick(keys.filter(k => k !== a));
      names = b === a ? [FACTIONS[a].name + ' A', FACTIONS[a].name + ' B'] : [FACTIONS[a].name, FACTIONS[b].name];
      [a, b].forEach((fac, side) => {
        const mine = humans.filter(q => q.side === side).slice(0, SIDE), kinds = shuffle(FACTIONS[fac].ids).slice(0, 2);
        mine.forEach(q => human(q, side)); for (let i = mine.length; i < SIDE; i++) bot(side, kinds[i % 2]);
      });
    } else {
      const kinds = shuffle(ALL_IDS).slice(0, 4);   // few bot looks, so 4 GB phones don't load ten fighters
      humans.slice(0, MAX_PLAYERS).forEach(q => human(q, null)); while (this.F.length < MAX_PLAYERS) bot(null, kinds[botN % 4]);
    }
    this.W.fighters = this.F; this.phase = 'load'; this.loadT = LOAD_WAIT;
    if (M.sides) this.pickBases();
    if (br) this.placeLoot();
    const items = this.items && this.items.map(it => [it.kind, GUNS.indexOf(it.weapon), n2(it.x), n2(it.y), n2(it.z), it.roof ? 1 : 0]);
    for (const q of humans) this.send(q, { t:'start', mode:this.mode, diff:this.diff, you:q.idx, roster, names, items, public:this.public });
    this.timer = setInterval(() => this.step(), TICK * 1000); this.last = Date.now(); this.count = 0;
    this.report();
  }
  tryGo(){ if (this.phase === 'load' && [...this.people.values()].every(p => p.ready)) this.go(); }
  go(){
    this.phase = 'play';
    if (this.mode === 'team') return this.newRound(1);
    const M = MODES[this.mode], W = this.W, mx = (AREA[0] + AREA[2]) / 2, mz = (AREA[1] + AREA[3]) / 2;
    let spots;
    if (M.sides){ const us = this.huddle(this.bases[0], SIDE), them = this.huddle(this.bases[1], SIDE); let a = 0, e = 0; spots = this.F.map(f => f.team === 0 ? us[a++] : them[e++]); }
    else spots = this.spread(this.F.length, M.br ? 30 : 16);
    const spawns = this.F.map((f, i) => this.place(f, spots[i % spots.length], [mx, mz]));
    this.freeze = FREEZE;
    if (M.br){
      W.items = this.items; W.graceUntil = this.now + FREEZE + 30;
      this.zone = R.makeZone(mx, mz, 112, (cx, cz, r, nr) => { for (let i = 0; i < 80; i++){ const a = Math.random() * 6.28, d = Math.random() * Math.max(0, r - nr), x = cx + Math.cos(a) * d, y = cz + Math.sin(a) * d; if (nav.isOpen(x, y)) return [x, y]; } return [cx, cz]; });
      W.zone = this.zone;
    }
    this.all(['G', spawns, FREEZE, this.ffaT]);
  }
  place(f, p, look){
    if (f.isBot) BOTS.respawn(f, p, this.W);
    else { const fresh = R.newFighter({ id:f.id, weapon:f.weapon, team:f.team, loadout:f.owned ? Object.keys(f.owned).filter(k => f.owned[k]) : undefined }); Object.assign(f, { ammo:fresh.ammo, hp:f.maxHp, armor:f.armor || 0, alive:true, reloadAt:0, nextFire:0, swapAt:0, bloom:0, x:p[0], z:p[1], y:groundAt(p[0], p[1], 2), stance:0, speed:0, vx:0, vz:0 }); }
    f.ry = f.aimYaw = Math.atan2(look[0] - p[0], look[1] - p[1]); f.hist = []; f.deadT = 0;
    return [n2(p[0]), n2(p[1]), n2(f.y), n2(f.ry)];
  }
  spread(n, gap){
    const out = [];
    for (let g = gap; out.length < n && g > 2; g *= 0.7) for (let i = 0; i < n * 60 && out.length < n; i++){ const p = nav.randomSpot(Math.random); if (out.every(q => Math.hypot(p[0] - q[0], p[1] - q[1]) >= g)) out.push(p); }
    while (out.length < n) out.push(nav.randomSpot(Math.random));
    return out;
  }
  farSpot(){
    let best = null, bd = -1; const live = this.F.filter(f => f.alive);
    for (let i = 0; i < 24; i++){ const s = nav.randomSpot(Math.random), d = Math.min(1e6, ...live.map(f => Math.hypot(f.x - s[0], f.z - s[1]))); if (d > bd){ bd = d; best = s; } }
    return best;
  }
  pickBases(){
    const a = nav.randomSpot(Math.random), far = from => { let best = from, bd = 0; for (const k of nav.cells){ const p = nav.centre(k), d = Math.hypot(p[0] - from[0], p[1] - from[1]); if (d > bd){ bd = d; best = p; } } return best; };
    const b = far(a); this.bases = [b, far(b)];
  }
  huddle(c, n){
    const list = nav.cells.map(nav.centre).sort((a, b) => Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1])), out = [];
    for (const p of list){ if (out.every(q => Math.hypot(p[0] - q[0], p[1] - q[1]) >= 2.4)){ out.push(p); if (out.length === n) break; } }
    return out;
  }
  /* ---------------- battle royale loot: shop counters first, then alleys, and snipers up the ladders */
  placeLoot(){
    const list = []; for (const [kind, weapon, n] of LOOT_MIX) for (let i = 0; i < n; i++) list.push({ kind, weapon });
    const spot = a => ({ x:a[0], y:a[1], z:a[2], ax:a[3], az:a[4] }), counters = LOOT.counters.map(spot), alleys = LOOT.alleys.map(spot), used = [];
    const take = (pool, want, gap) => { for (const s of shuffle(pool)){ if (used.length >= want) break; if (used.every(u => Math.hypot(u.x - s.x, u.z - s.z) >= gap)) used.push(s); } };
    take(counters, Math.ceil(list.length * 0.6), 4); take(alleys, list.length, 4); take([...counters, ...alleys], list.length, 1.5);
    shuffle(list).forEach((it, i) => Object.assign(it, used[i % used.length]));
    LOOT.ladders.slice(0, 3).forEach(L => list.push({ kind:'gun', weapon:'sniper', x:L[0], z:L[2], y:L[1] + 0.55, roof:true }));
    list.forEach((it, i) => { it.i = i; });
    this.items = list;
  }
  taken(it, f){ it.gone = true; this.all(['t', it.i, this.F.indexOf(f)]); }
  /* ---------------- team battle rounds: no respawns, first to three */
  newRound(n){
    const flip = n % 2 === 0, home = this.bases[flip ? 1 : 0], away = this.bases[flip ? 0 : 1], W = this.W;
    this.round = { n, t:ROUND_TIME, freeze:FREEZE, over:0, done:false }; W.intel = {}; W.now = this.now;
    const us = this.huddle(home, SIDE), them = this.huddle(away, SIDE); let a = 0, e = 0;
    this.spawns = this.F.map(f => this.place(f, f.team === 0 ? us[a++] : them[e++], f.team === 0 ? away : home));
    this.F.forEach(f => { f.armor = 0; });
    this.all(this.roundMsg());
  }
  roundMsg(){ return ['R', this.round.n, this.score[0], this.score[1], this.round.freeze, this.round.t, this.spawns, this.F.map(f => f.alive ? 1 : 0)]; }
  endRound(winner, why){
    const r = this.round; if (r.done) return; r.done = true; r.over = BETWEEN;
    if (winner !== null) this.score[winner]++;
    this.all(['r', winner, why, this.score[0], this.score[1]]);
  }
  checkEnd(){
    if (this.mode === 'team'){
      if (!this.round || this.round.done) return;
      const left = i => this.F.filter(f => f.team === i && f.alive).length;
      if (!left(1)) this.endRound(0, 'wiped'); else if (!left(0)) this.endRound(1, 'wiped');
    } else if (MODES[this.mode].br && !this.endIn){
      const live = this.F.filter(f => f.alive);
      if (this.mode === 'br' ? live.length <= 1 : !live.some(f => f.team === 0) || !live.some(f => f.team === 1)) this.endIn = 2;
    }
  }
  tickRound(dt){
    const r = this.round;
    if (r.over > 0){
      r.over -= dt;
      if (r.over <= 0){ if (this.score[0] >= WIN_AT || this.score[1] >= WIN_AT) this.endMatch(); else this.newRound(r.n + 1); }
      return;
    }
    if (r.freeze > 0){ r.freeze -= dt; return; }
    r.t -= dt;
    if (r.t <= 0){
      const live = i => this.F.filter(f => f.team === i && f.alive), n = [live(0).length, live(1).length], hp = [0, 1].map(i => live(i).reduce((v, f) => v + f.hp, 0));
      this.endRound(n[0] !== n[1] ? (n[0] > n[1] ? 0 : 1) : hp[0] !== hp[1] ? (hp[0] > hp[1] ? 0 : 1) : null, 'time');
    }
  }
  // free-for-all and battle royale run as one long fight
  tickFight(dt){
    if (this.freeze > 0){ this.freeze -= dt; return; }
    if (this.endIn > 0){ this.endIn -= dt; if (this.endIn <= 0) this.endMatch(); return; }
    const W = this.W;
    if (this.mode === 'ffa'){
      this.ffaT -= dt;
      const lead = this.F.reduce((a, b) => (b.kills || 0) > (a.kills || 0) ? b : a);
      if ((lead.kills || 0) >= FFA_GOAL || this.ffaT <= 0) this.endIn = 1.5;
      return;
    }
    const Z = this.zone; R.zoneTick(Z, dt);
    // bots start cautious and turn more aggressive as the zone squeezes everyone together
    W.sightMul = [0.45, 0.6, 0.75, 0.9, 1, 1][Z.phase]; W.hunt = [0.05, 0.12, 0.25, 0.45, 0.7, 0.9][Z.phase];
    const alive = this.F.filter(f => f.alive).length, keep = [9, 8, 7, 6, 5, 1][Z.phase]; W.truce = alive <= keep;
    for (const f of this.F){ if (!f.alive || R.inZone(Z, f.x, f.z)) continue; if (R.burn(f, Z.dps * dt)) this.killed(f, null, null); }
  }
  endMatch(){
    if (this.ended) return; this.ended = true;
    this.all(['E', this.score[0], this.score[1], this.F.map(f => [f.kills || 0, f.deaths || 0, f.alive ? 1 : 0, f.place || 0])]);
    clearInterval(this.timer); this.timer = null; this.round = null;
    for (const p of this.people.values()){ p.idx = null; p.ready = false; }
    if (this.public){ this.open = false; this.phase = 'done'; this.report(); return; }   // strangers go back to the menu; the room closes when they leave
    this.phase = 'lobby'; this.lobby();
  }
  /* ---------------- the simulation */
  step(){
    const t = Date.now(), dt = Math.min(0.2, (t - this.last) / 1000); this.last = t;
    if (this.phase === 'load'){ this.loadT -= dt; if (this.loadT <= 0) this.go(); return; }
    if (this.phase !== 'play') return;
    this.now += dt; const W = this.W; W.now = this.now;
    if (this.mode === 'team') this.tickRound(dt); else this.tickFight(dt);
    if (this.phase !== 'play' || this.ended) return;
    const held = this.mode === 'team' ? this.round.freeze > 0 || this.round.over > 0 : this.freeze > 0;
    for (const f of this.F){
      if (!f.alive && this.mode === 'ffa'){ f.deadT -= dt; if (f.deadT <= 0) this.respawn(f); }
      else if (f.isBot){ if (held || !f.alive){ f.speed = 0; f.vx = f.vz = 0; } else BOTS.step(f, dt, W); }
      else if (f.alive){
        R.tick(f, dt, this.now);
        if (this.items && !held) for (const it of this.items) if (!it.gone && Math.hypot(it.x - f.x, it.z - f.z) < 1.5 && Math.abs(it.y - 0.55 - f.y) < 1.2 && R.takeItem(f, it)) this.taken(it, f);
      }
      (f.hist = f.hist || []).push([this.now, f.x, f.y, f.z, f.stance || 0, f.proneYaw || 0]); if (f.hist.length > 12) f.hist.shift();
    }
    if (++this.count % SEND_EVERY === 0) this.snapshot();
  }
  respawn(f){
    const s = this.farSpot(), i = this.F.indexOf(f), p = this.place(f, s, [(AREA[0] + AREA[2]) / 2, (AREA[1] + AREA[3]) / 2]);
    this.all(['P', i, ...p]);
  }
  snapshot(){
    const rows = this.F.map(f => [n2(f.x), n2(f.y), n2(f.z), n2(f.ry || 0), n2(f.aimYaw || 0), n2(f.aimPitch || 0), n2(f.speed || 0), f.stance || 0, Math.ceil(f.hp), Math.ceil(f.armor || 0), GUNS.indexOf(f.weapon)]);
    const Z = this.zone, extra = Z ? [n2(Z.cx), n2(Z.cz), n2(Z.r), n2(Z.t), Z.phase, Z.shrinking ? 1 : 0, Z.done ? 1 : 0, Z.dps] : this.mode === 'ffa' ? [n2(this.ffaT)] : null;
    this.all(['S', n2(this.now), rows, extra]);
  }
  holding(){ return this.mode === 'team' ? !this.round || this.round.freeze > 0 || this.round.over > 0 : this.freeze > 0; }
  input(p, a){
    const f = this.F[p.idx]; if (!f || f.isBot || !f.alive || this.phase !== 'play' || this.holding()) return;
    const [, x, y, z, yaw, pitch, stance, speed, proneYaw] = a, dt = Math.max(0.05, this.now - (f.seen || 0)); f.seen = this.now;
    // moving is trusted to the phone so it feels instant, but nobody can move faster than a sprint
    const dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz), max = 8.5 * dt + 0.6, k = d > max ? max / d : 1;
    if (!Number.isFinite(d) || !Number.isFinite(y)) return;
    f.x += dx * k; f.z += dz * k; f.y = y; f.aimYaw = f.ry = yaw; f.aimPitch = pitch; f.stance = stance | 0; f.speed = speed; f.proneYaw = proneYaw;
  }
  reloadNow(p){ const f = this.F[p.idx]; if (f && !f.isBot) R.startReload(f, this.now); }
  swapNow(p, i){ const f = this.F[p.idx]; if (f && !f.isBot && GUNS[i]){ R.switchWeapon(f, GUNS[i], this.now); f.swapAt = 0; } }
  // where everyone was when the shooter pulled the trigger, as their screen showed it
  rewind(when){
    return this.F.map(f => {
      const h = f.hist || []; let a = h[0], b = h[h.length - 1];
      for (let i = 0; i < h.length - 1; i++) if (h[i][0] <= when && h[i + 1][0] >= when){ a = h[i]; b = h[i + 1]; break; }
      if (!a) return f;
      const u = b[0] > a[0] ? Math.max(0, Math.min(1, (when - a[0]) / (b[0] - a[0]))) : 1;
      return { real:f, alive:f.alive, team:f.team, x:a[1] + (b[1] - a[1]) * u, y:a[2] + (b[2] - a[2]) * u, z:a[3] + (b[3] - a[3]) * u, stance:b[4], proneYaw:b[5] };
    });
  }
  shot(p, a){
    const f = this.F[p.idx]; if (!f || f.isBot || !f.alive || this.phase !== 'play' || this.holding() || this.endIn > 0 || (this.round && this.round.done)) return;
    const [, seed, ox, oy, oz, dx, dy, dz, flags, rt, gun] = a, now = this.now, id = GUNS[gun]; if (!id) return;
    if (f.owned && !f.owned[id]) return;
    if (f.weapon !== id){ f.weapon = id; f.reloadAt = 0; f.swapAt = 0; }
    // the phone and server tick at different moments, so allow a little give on cooldowns
    if (f.nextFire - now < 0.08) f.nextFire = now; if (f.swapAt - now < 0.15) f.swapAt = now; if (f.reloadAt && f.reloadAt - now < 0.2){ f.reloadAt = now; R.tick(f, 0, now); }
    const len = Math.hypot(dx, dy, dz); if (!(len > 0.5)) return;
    const dir = [dx / len, dy / len, dz / len], s = { ads:!!(flags & 1), moving:!!(flags & 2), running:!!(flags & 4), airborne:!!(flags & 8), stance:f.stance }, shot = R.fire(f, dir, s, now, R.seeded(seed | 0));
    if (!shot) return;
    const o = Math.hypot(ox - f.x, oz - f.z) < 2.5 && Math.abs(oy - f.y) < 3 ? [ox, oy, oz] : [f.x, f.y + 1.6, f.z];
    const when = Math.max(now - LAG_MAX, Math.min(now, rt)), past = this.rewind(when).filter(t => isFoe(f, t.real || t)), w = R.WEAPONS[id], hits = new Map();
    if (w.melee){
      const hit = R.knifeTrace(o, dir, past, near, null); if (hit) hits.set(hit.target.real || hit.target, { dmg:R.damageAt(id, hit.t, hit.zone), head:false });
      this.others(p, ['f', p.idx, gun, n2(o[0]), n2(o[1]), n2(o[2]), n2(o[0]), n2(o[1]), n2(o[2])]);
    } else {
      let end = null;
      shot.dirs.forEach(d => {
        const hit = R.traceShot(o, d, w.range, past, near, null), T = hit.target && (hit.target.real || hit.target);
        if (!end) end = [o[0] + d[0] * hit.t, o[1] + d[1] * hit.t, o[2] + d[2] * hit.t];
        if (T){ const e = hits.get(T) || { dmg:0, head:false }; e.dmg += R.damageAt(id, hit.t, hit.zone); e.head = e.head || hit.zone === 'head'; hits.set(T, e); }
      });
      this.others(p, ['f', p.idx, gun, n2(o[0]), n2(o[1]), n2(o[2]), n2(end[0]), n2(end[1]), n2(end[2])]);
    }
    BOTS.hearShot(this.F.filter(b => b.isBot), f.x, f.z, f, this.W);
    for (const [T, e] of hits) this.damage(T, e.dmg, f, e.head, id);
  }
  botShot(b, shot, o){
    const w = R.WEAPONS[shot.weapon], foes = this.F.filter(f => isFoe(b, f)), hits = new Map(); let end = null;
    shot.dirs.forEach(d => {
      const hit = R.traceShot(o, d, w.range, foes, near, b);
      if (!end) end = [o[0] + d[0] * hit.t, o[1] + d[1] * hit.t, o[2] + d[2] * hit.t];
      if (hit.target) hits.set(hit.target, (hits.get(hit.target) || 0) + R.damageAt(shot.weapon, hit.t, hit.zone));
    });
    this.all(['f', this.F.indexOf(b), GUNS.indexOf(shot.weapon), n2(o[0]), n2(o[1]), n2(o[2]), n2(end[0]), n2(end[1]), n2(end[2])]);
    BOTS.hearShot(this.F.filter(x => x.isBot), b.x, b.z, b, this.W);
    for (const [T, dmg] of hits) this.damage(T, dmg, b, false, shot.weapon);
  }
  damage(T, dmg, by, head, id){
    if (!T.alive) return;
    const res = R.applyDamage(T, dmg), ti = this.F.indexOf(T), bi = this.F.indexOf(by); T.lastHitBy = by; T.lastHitAt = this.now;
    this.all(['h', ti, bi, Math.round(res.dealt ?? dmg), head ? 1 : 0, n2(T.x), n2(T.y + 1.2), n2(T.z)]);
    if (res.killed) this.killed(T, by, id);
  }
  killed(T, by, id){
    if (by) by.kills = (by.kills || 0) + 1; T.deaths = (T.deaths || 0) + 1;
    T.deadT = this.mode === 'ffa' ? RESPAWN : 1e9;
    if (MODES[this.mode].br) T.place = this.F.filter(f => f.alive).length + 1;
    this.all(['k', this.F.indexOf(T), by ? this.F.indexOf(by) : -1, id ? GUNS.indexOf(id) : -1]);
    this.checkEnd();
  }
}

/* The matchmaker keeps a list of public matches that are still filling, and sends each new player to the fullest one. */
export class Matchmaker extends DurableObject {
  constructor(ctx, env){ super(ctx, env); this.rooms = new Map(); }
  async fetch(request){
    const url = new URL(request.url), now = Date.now();
    for (const [c, r] of this.rooms) if (now - r.at > (r.live ? 900000 : 60000)) this.rooms.delete(c);
    if (url.pathname === '/report'){
      const r = await request.json();
      if (!r.players) this.rooms.delete(r.code); else this.rooms.set(r.code, { ...r, at:now });
      return new Response('ok');
    }
    if (url.pathname === '/find'){
      const mode = url.searchParams.get('mode'), skip = new Set((url.searchParams.get('skip') || '').split(','));
      if (!MODES[mode]) return json({ error:'unknown mode' }, 400);
      let best = null;
      for (const r of this.rooms.values()) if (r.mode === mode && r.open && !skip.has(r.code) && r.players < MAX_PLAYERS && (!best || r.players > best.players)) best = r;
      if (best){ best.players++; best.at = now; return json({ code:best.code }); }
      const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code = 'P'; for (let i = 0; i < 5; i++) code += L[Math.floor(Math.random() * L.length)];
      this.rooms.set(code, { code, mode, players:1, open:true, at:now });
      return json({ code });
    }
    if (url.pathname === '/online'){
      const c = { team:0, ffa:0, br:0, brsq:0 }; for (const r of this.rooms.values()) if (c[r.mode] != null) c[r.mode] += r.players;
      return json(c);
    }
    return json({ error:'not found' }, 404);
  }
}

export default {
  async fetch(request, env){
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers:{ 'access-control-allow-origin':'*', 'access-control-allow-methods':'GET', 'access-control-max-age':'86400' } });
    if (url.pathname === '/quick' || url.pathname === '/online'){
      const mm = env.MM.get(env.MM.idFromName('mm'), { locationHint:REGION });
      return mm.fetch(new Request('https://mm' + (url.pathname === '/quick' ? '/find' : '/online') + url.search));
    }
    const m = url.pathname.match(/^\/room\/([A-Z0-9]{4,6})$/);
    if (!m) return new Response('Kasala game server', { status:200 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status:426 });
    url.searchParams.set('code', m[1]);
    return env.ROOM.get(env.ROOM.idFromName(m[1]), { locationHint:REGION }).fetch(new Request(url, request));
  },
};

// Kasala game server. One Room runs one group of friends: its lobby, then the match itself.
// It runs the same rules.js and bots.js as the game, and it decides every hit, death and round.
import { DurableObject } from 'cloudflare:workers';
import { R, BOTS, near, groundAt, nav } from './world.js';

const REGION = 'weur';            // 170 ms from Lagos on the ping test; the Africa hint lands in Amsterdam with bigger spikes
const MAX_PLAYERS = 10, SIDE = 5;
const TICK = 0.05, SEND_EVERY = 2; // 20 ticks a second, 10 updates a second to phones
const WIN_AT = 3, ROUND_TIME = 180, FREEZE = 2.5, BETWEEN = 4.5, LOAD_WAIT = 30;
const LAG_MAX = 0.4;
const BOT_NAMES = ['Chidi', 'Bisi', 'Tunde', 'Ngozi', 'Emeka', 'Aisha', 'Musa', 'Funke', 'Segun', 'Kemi'];
const BOT_GUNS = ['rifle', 'smg', 'rifle', 'pistol', 'shotgun', 'smg', 'rifle', 'sniper', 'shotgun', 'rifle'];
const FACTIONS = {
  task:{ name:'Task Force', ids:['tf', 'nysc_m', 'nysc_f', 'blazer', 'hoodie_m'] },
  zombies:{ name:'Zombies', ids:['zombie_tank', 'z_mech', 'z_cond', 'z_hawk', 'z_man'] },
  traders:{ name:'Traders', ids:['kaftan', 'stud_f', 'stud_m', 'chief', 'trader_m2', 'trader_f2'] },
  heroes:{ name:'Heroes', ids:['h_aba', 'h_one', 'h_second', 'h_stretch'] },
};
const factionOf = id => Object.keys(FACTIONS).find(k => FACTIONS[k].ids.includes(id));
const GUNS = R.ORDER, n2 = v => Math.round(v * 100) / 100, pick = a => a[Math.floor(Math.random() * a.length)];
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const clean = (s, n) => String(s || '').replace(/[<>&"']/g, '').trim().slice(0, n);

export class Room extends DurableObject {
  constructor(ctx, env){ super(ctx, env); this.people = new Map(); this.open = false; this.reset(); this.nextId = 1; }
  reset(){ this.phase = 'lobby'; this.mode = 'team'; this.diff = 'medium'; this.F = []; this.round = null; this.timer && clearInterval(this.timer); this.timer = null; }

  async fetch(request){
    const url = new URL(request.url), pair = new WebSocketPair(), [client, ws] = Object.values(pair); ws.accept();
    const refuse = m => { ws.send(JSON.stringify({ t:'err', m })); ws.close(1000, 'refused'); return new Response(null, { status:101, webSocket:client }); };
    if (url.searchParams.get('create')){ if (!this.open || !this.people.size){ this.open = true; this.reset(); } else return refuse('That room code is taken. Try again'); }
    else if (!this.open) return refuse('No room with that code');
    if (this.people.size >= MAX_PLAYERS) return refuse('That room is full');
    if (this.phase !== 'lobby') return refuse('That match has already started');
    this.code = url.searchParams.get('code');
    const count = s => [...this.people.values()].filter(p => p.side === s).length;
    const p = { ws, id:this.nextId++, name:clean(url.searchParams.get('name'), 16) || 'Player', char:clean(url.searchParams.get('char'), 16), side:count(0) <= count(1) ? 0 : 1, host:!this.people.size, ready:false };
    if (!factionOf(p.char)) p.char = 'tf';
    this.people.set(ws, p);
    ws.addEventListener('message', e => { try { this.onMessage(p, JSON.parse(e.data)); } catch (err) { console.warn('bad message', err.message); } });
    const gone = () => this.leave(p); ws.addEventListener('close', gone); ws.addEventListener('error', gone);
    this.lobby();
    return new Response(null, { status:101, webSocket:client });
  }
  send(p, m){ try { p.ws.send(typeof m === 'string' ? m : JSON.stringify(m)); } catch (e) {} }
  all(m){ const s = JSON.stringify(m); for (const p of this.people.values()) this.send(p, s); }
  others(me, m){ const s = JSON.stringify(m); for (const p of this.people.values()) if (p !== me) this.send(p, s); }
  lobby(){
    for (const p of this.people.values()) this.send(p, { t:'lobby', code:this.code, you:p.id, mode:this.mode, diff:this.diff, players:[...this.people.values()].map(q => ({ id:q.id, name:q.name, char:q.char, side:q.side, host:q.host })) });
  }
  leave(p){
    if (!this.people.delete(p.ws)) return;
    try { p.ws.close(); } catch (e) {}
    if (p.host){ const n = this.people.values().next().value; if (n) n.host = true; }
    if (!this.people.size){ this.reset(); this.open = false; return; }
    if (this.phase === 'lobby') return this.lobby();
    if (p.idx != null) this.becomeBot(p);
    this.tryGo();
  }
  // someone dropped out: a bot takes over their fighter so the teams stay even
  becomeBot(p){
    const f = this.F[p.idx]; if (!f) return;
    const b = BOTS.newBot({ id:f.id, name:f.name, x:f.x, z:f.z, weapon:f.weapon, team:f.team }, this.diff);
    Object.assign(b, { y:f.y, hp:f.hp, armor:f.armor, alive:f.alive, kills:f.kills, deaths:f.deaths, ammo:f.ammo, ry:f.ry, aimYaw:f.aimYaw, deadT:f.deadT });
    this.F[p.idx] = b; this.W.fighters[p.idx] = b;
    this.all({ t:'n', m:p.name + ' left. A bot took over' });
  }
  onMessage(p, a){
    if (Array.isArray(a)){ const k = a[0]; if (k === 'i') return this.input(p, a); if (k === 's') return this.shot(p, a); if (k === 'r') return this.reloadNow(p); if (k === 'w') return this.swapNow(p, a[1]); return; }
    if (this.phase === 'lobby'){
      if (a.t === 'side'){ const to = 1 - p.side; if ([...this.people.values()].filter(q => q.side === to).length < SIDE){ p.side = to; this.lobby(); } }
      else if (a.t === 'char' && factionOf(a.char)){ p.char = a.char; this.lobby(); }
      else if (a.t === 'opt' && p.host){ if (BOTS.DIFF[a.diff]) this.diff = a.diff; this.lobby(); }
      else if (a.t === 'start' && p.host) this.startMatch();
    } else if (a.t === 'ready'){ p.ready = true; if (this.phase === 'load') this.tryGo(); else if (this.round) this.send(p, this.roundMsg()); }
  }
  /* ---------------- starting a match */
  startMatch(){
    const humans = [...this.people.values()];
    // each side plays as the team of the first person on it; an empty side, or a clash, gets another team
    const first = s => { const h = humans.find(q => q.side === s); return h ? factionOf(h.char) : null; };
    const left = Object.keys(FACTIONS); let a = first(0), b = first(1);
    if (!a) a = pick(left.filter(k => k !== b)); if (!b || b === a) { const other = left.filter(k => k !== a); if (!b) b = pick(other); }
    const facs = [a, b], names = b === a ? [FACTIONS[a].name + ' A', FACTIONS[a].name + ' B'] : [FACTIONS[a].name, FACTIONS[b].name];
    this.W = { fighters:[], near, nav, groundAt, rand:Math.random, now:0, intel:{}, onShot:(b, shot, o) => this.botShot(b, shot, o) };
    this.now = 0; this.score = [0, 0]; this.F = []; const roster = []; let botN = 0;
    for (const side of [0, 1]){
      const mine = humans.filter(q => q.side === side).slice(0, SIDE), kinds = FACTIONS[facs[side]].ids.slice().sort(() => Math.random() - 0.5).slice(0, 2);
      mine.forEach(q => {
        const f = R.newFighter({ id:'p' + q.id, weapon:'rifle', team:side }); Object.assign(f, { name:q.name, ry:0, aimYaw:0, aimPitch:0, speed:0, stance:0, vx:0, vz:0, kills:0, deaths:0, human:q, moved:0, hist:[] });
        q.idx = this.F.length; q.ready = false; this.F.push(f); roster.push({ name:q.name, char:q.char, team:side, weapon:'rifle', human:true, id:q.id });
      });
      for (let i = mine.length; i < SIDE; i++){
        const gun = BOT_GUNS[botN], b = BOTS.newBot({ id:'b' + botN, name:BOT_NAMES[botN], weapon:gun, team:side }, this.diff); b.hist = [];
        this.F.push(b); roster.push({ name:b.name, char:kinds[i % kinds.length], team:side, weapon:gun }); botN++;
      }
    }
    this.W.fighters = this.F; this.phase = 'load'; this.loadT = LOAD_WAIT;
    this.pickBases();
    for (const q of humans) this.send(q, { t:'start', mode:this.mode, diff:this.diff, you:q.idx, roster, names });
    this.timer = setInterval(() => this.step(), TICK * 1000); this.last = Date.now(); this.count = 0;
  }
  tryGo(){ if (this.phase === 'load' && [...this.people.values()].every(p => p.ready)) this.go(); }
  go(){ this.phase = 'play'; this.newRound(1); }
  pickBases(){
    const a = nav.randomSpot(Math.random), far = from => { let best = from, bd = 0; for (const k of nav.cells){ const p = nav.centre(k), d = Math.hypot(p[0] - from[0], p[1] - from[1]); if (d > bd){ bd = d; best = p; } } return best; };
    const b = far(a); this.bases = [b, far(b)];
  }
  huddle(c, n){
    const list = nav.cells.map(nav.centre).sort((a, b) => Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1])), out = [];
    for (const p of list){ if (out.every(q => Math.hypot(p[0] - q[0], p[1] - q[1]) >= 2.4)){ out.push(p); if (out.length === n) break; } }
    return out;
  }
  /* ---------------- rounds: no respawns, first to three */
  newRound(n){
    const flip = n % 2 === 0, home = this.bases[flip ? 1 : 0], away = this.bases[flip ? 0 : 1], W = this.W;
    this.round = { n, t:ROUND_TIME, freeze:FREEZE, over:0, done:false }; W.intel = {}; W.now = this.now;
    const us = this.huddle(home, SIDE), them = this.huddle(away, SIDE); let a = 0, e = 0;
    this.spawns = this.F.map((f, i) => {
      const p = f.team === 0 ? us[a++] : them[e++], to = f.team === 0 ? away : home;
      if (f.isBot) BOTS.respawn(f, p, W);
      else { const fresh = R.newFighter({ id:f.id, weapon:f.weapon, team:f.team }); Object.assign(f, { ammo:fresh.ammo, hp:f.maxHp, armor:0, alive:true, reloadAt:0, nextFire:0, swapAt:0, bloom:0, x:p[0], z:p[1], y:groundAt(p[0], p[1], 2), stance:0, speed:0, vx:0, vz:0 }); }
      f.ry = f.aimYaw = Math.atan2(to[0] - p[0], to[1] - p[1]); f.hist = []; f.meHit = 0;
      return [n2(p[0]), n2(p[1]), n2(f.y), n2(f.ry)];
    });
    this.all(this.roundMsg());
  }
  roundMsg(){ return ['R', this.round.n, this.score[0], this.score[1], this.round.freeze, this.round.t, this.spawns, this.F.map(f => f.alive ? 1 : 0)]; }
  endRound(winner, why){
    const r = this.round; if (r.done) return; r.done = true; r.over = BETWEEN;
    if (winner !== null) this.score[winner]++;
    this.all(['r', winner, why, this.score[0], this.score[1]]);
  }
  checkRound(){
    if (!this.round || this.round.done) return;
    const left = i => this.F.filter(f => f.team === i && f.alive).length;
    if (!left(1)) this.endRound(0, 'wiped'); else if (!left(0)) this.endRound(1, 'wiped');
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
  endMatch(){
    this.all(['E', this.score[0], this.score[1], this.F.map(f => [f.kills || 0, f.deaths || 0])]);
    clearInterval(this.timer); this.timer = null; this.phase = 'lobby'; this.round = null;
    for (const p of this.people.values()){ p.idx = null; p.ready = false; }
    this.lobby();
  }
  /* ---------------- the simulation */
  step(){
    const t = Date.now(), dt = Math.min(0.2, (t - this.last) / 1000); this.last = t;
    if (this.phase === 'load'){ this.loadT -= dt; if (this.loadT <= 0) this.go(); return; }
    if (this.phase !== 'play') return;
    this.now += dt; const W = this.W; W.now = this.now;
    this.tickRound(dt); if (this.phase !== 'play') return;
    const held = this.round.freeze > 0 || this.round.over > 0;
    for (const f of this.F){
      if (f.isBot){ if (held){ f.speed = 0; f.vx = f.vz = 0; } else BOTS.step(f, dt, W); }
      else if (f.alive) R.tick(f, dt, this.now);
      (f.hist = f.hist || []).push([this.now, f.x, f.y, f.z, f.stance || 0, f.proneYaw || 0]); if (f.hist.length > 12) f.hist.shift();
    }
    if (++this.count % SEND_EVERY === 0) this.snapshot();
  }
  snapshot(){
    const rows = this.F.map(f => [n2(f.x), n2(f.y), n2(f.z), n2(f.ry || 0), n2(f.aimYaw || 0), n2(f.aimPitch || 0), n2(f.speed || 0), f.stance || 0, Math.ceil(f.hp), Math.ceil(f.armor || 0), GUNS.indexOf(f.weapon)]);
    this.all(['S', n2(this.now), rows]);
  }
  input(p, a){
    const f = this.F[p.idx]; if (!f || f.isBot || !f.alive || this.phase !== 'play') return;
    const r = this.round; if (r.freeze > 0 || r.over > 0) return;
    const [, x, y, z, yaw, pitch, stance, speed, proneYaw] = a, dt = Math.max(0.05, this.now - (f.seen || 0)); f.seen = this.now;
    // moving is trusted to the phone so it feels instant, but nobody can move faster than a sprint
    const dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz), max = 8.5 * dt + 0.6, k = d > max ? max / d : 1;
    if (!Number.isFinite(d)) return;
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
    const f = this.F[p.idx], r = this.round; if (!f || f.isBot || !f.alive || !r || r.freeze > 0 || r.done) return;
    const [, seed, ox, oy, oz, dx, dy, dz, flags, rt, gun] = a, now = this.now, id = GUNS[gun]; if (!id) return;
    if (f.weapon !== id){ f.weapon = id; f.reloadAt = 0; f.swapAt = 0; }
    // the phone and server tick at different moments, so allow a little give on cooldowns
    if (f.nextFire - now < 0.08) f.nextFire = now; if (f.swapAt - now < 0.15) f.swapAt = now; if (f.reloadAt && f.reloadAt - now < 0.2){ f.reloadAt = now; R.tick(f, 0, now); }
    const len = Math.hypot(dx, dy, dz); if (!(len > 0.5)) return;
    const dir = [dx / len, dy / len, dz / len], s = { ads:!!(flags & 1), moving:!!(flags & 2), running:!!(flags & 4), airborne:!!(flags & 8), stance:f.stance }, shot = R.fire(f, dir, s, now, R.seeded(seed | 0));
    if (!shot) return;
    const o = Math.hypot(ox - f.x, oz - f.z) < 2.5 && Math.abs(oy - f.y) < 3 ? [ox, oy, oz] : [f.x, f.y + 1.6, f.z];
    const when = Math.max(now - LAG_MAX, Math.min(now, rt)), past = this.rewind(when).filter(t => t.team !== f.team), w = R.WEAPONS[id], hits = new Map(), mine = past.find(t => (t.real || t) === f);
    if (w.melee){
      const hit = R.knifeTrace(o, dir, past, near, mine); if (hit) hits.set(hit.target.real || hit.target, { dmg:R.damageAt(id, hit.t, hit.zone), head:false });
      this.others(p, ['f', p.idx, gun, n2(o[0]), n2(o[1]), n2(o[2]), n2(o[0]), n2(o[1]), n2(o[2])]);
    } else {
      let end = null;
      shot.dirs.forEach(d => {
        const hit = R.traceShot(o, d, w.range, past, near, mine), T = hit.target && (hit.target.real || hit.target);
        if (!end) end = [o[0] + d[0] * hit.t, o[1] + d[1] * hit.t, o[2] + d[2] * hit.t];
        if (T){ const e = hits.get(T) || { dmg:0, head:false }; e.dmg += R.damageAt(id, hit.t, hit.zone); e.head = e.head || hit.zone === 'head'; hits.set(T, e); }
      });
      this.others(p, ['f', p.idx, gun, n2(o[0]), n2(o[1]), n2(o[2]), n2(end[0]), n2(end[1]), n2(end[2])]);
    }
    BOTS.hearShot(this.F.filter(b => b.isBot), f.x, f.z, f, this.W);
    for (const [T, e] of hits) this.damage(T, e.dmg, f, e.head, id);
  }
  botShot(b, shot, o){
    const w = R.WEAPONS[shot.weapon], foes = this.F.filter(f => f.team !== b.team), hits = new Map(); let end = null;
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
    if (res.killed){ by.kills = (by.kills || 0) + 1; T.deaths = (T.deaths || 0) + 1; T.deadT = 1e9; this.all(['k', ti, bi, GUNS.indexOf(id)]); this.checkRound(); }
  }
}

export default {
  async fetch(request, env){
    const m = new URL(request.url).pathname.match(/^\/room\/([A-Z0-9]{4,6})$/);
    if (!m) return new Response('Kasala game server', { status:200 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status:426 });
    const url = new URL(request.url); url.searchParams.set('code', m[1]);
    return env.ROOM.get(env.ROOM.idFromName(m[1]), { locationHint:REGION }).fetch(new Request(url, request));
  },
};

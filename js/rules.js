/* =====================================================================
   Wayo shooter rules. Weapons, ammo, damage and hit checks.
   This file knows nothing about three.js, the screen or the controls, so a
   game server can run exactly the same rules when the game goes online.
   Tune the game from the WEAPONS table below.
   ===================================================================== */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.WAYO_RULES = make();
})(typeof self !== 'undefined' ? self : this, function () {
  const WEAPONS = {
    pistol: { name:'Pistol', slot:1, auto:false, dmg:26, headMul:2, cd:0.22, mag:12, reserve:48, reload:1.25, pellets:1, range:90,
      nearM:16, farM:45, farMul:0.6, hip:0.016, ads:0.004, bloom:0.007, bloomMax:0.03, kick:0.013, moveMul:1, zoom:58 },
    smg:    { name:'SMG', slot:2, auto:true, dmg:15, headMul:1.6, cd:0.075, mag:32, reserve:128, reload:1.7, pellets:1, range:90,
      nearM:12, farM:32, farMul:0.5, hip:0.022, ads:0.009, bloom:0.0035, bloomMax:0.035, kick:0.0065, moveMul:0.98, zoom:56 },
    rifle:  { name:'Rifle', slot:3, auto:true, dmg:21, headMul:2, cd:0.115, mag:30, reserve:120, reload:2.1, pellets:1, range:140,
      nearM:30, farM:80, farMul:0.65, hip:0.026, ads:0.0035, bloom:0.004, bloomMax:0.04, kick:0.0105, moveMul:0.93, zoom:46 },
    shotgun:{ name:'Shotgun', slot:4, auto:false, dmg:11, headMul:1.5, cd:0.85, mag:6, reserve:30, reload:2.4, pellets:9, range:45,
      nearM:7, farM:20, farMul:0.3, hip:0.05, ads:0.038, bloom:0, bloomMax:0, kick:0.05, moveMul:0.92, zoom:60 },
    sniper: { name:'Sniper', slot:5, auto:false, scope:true, dmg:85, headMul:2.5, cd:1.35, mag:5, reserve:25, reload:2.6, pellets:1, range:240,
      nearM:60, farM:170, farMul:0.8, hip:0.085, ads:0.0004, bloom:0, bloomMax:0, kick:0.038, moveMul:0.9, zoom:14 },
    knife:  { name:'Knife', slot:6, melee:true, auto:true, dmg:45, headMul:1.5, cd:0.5, reach:2.3, kick:0, moveMul:1.08, hip:0, ads:0, bloom:0, bloomMax:0 },
  };
  const ORDER = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper', 'knife'];
  const BEST = ['rifle', 'smg', 'shotgun', 'sniper', 'pistol'], ARMOR_SOAK = 0.6;
  const SWAP_TIME = 0.32, BLOOM_DECAY = 0.07;
  const MOVE_SPREAD = 0.012, RUN_SPREAD = 0.03, AIR_SPREAD = 0.05;
  const PLAYER = { hp:100, radius:0.3, bodyTop:1.42, headTop:1.78 };
  // standing, crouching, lying down: eye height, how tall you are, move speed and how steady your aim is
  const STANCE = [
    { name:'stand',  eye:1.62, height:1.78, speed:1,    steady:1,    aimAt:1.15 },
    { name:'crouch', eye:1.05, height:1.22, speed:0.55, steady:0.75, aimAt:0.8 },
    { name:'prone',  eye:0.36, height:0.5,  speed:0.24, steady:0.5,  aimAt:0.2 },
  ];

  function newFighter(o = {}) {
    const ammo = {};
    for (const id of ORDER) { const w = WEAPONS[id]; if (!w.melee) ammo[id] = { mag:w.mag, reserve:w.reserve }; }
    const f = { id:o.id ?? 'me', team:o.team ?? null, x:o.x || 0, y:o.y || 0, z:o.z || 0, hp:PLAYER.hp, maxHp:PLAYER.hp, armor:0, alive:true,
      ammo, weapon:o.weapon || 'rifle', nextFire:0, reloadAt:0, swapAt:0, bloom:0 };
    if (o.loadout) {   // battle royale: you only carry what you start with and what you find
      f.owned = {}; for (const id of o.loadout) f.owned[id] = true;
      for (const id in ammo) { ammo[id].mag = 0; ammo[id].reserve = 0; }
      f.ammo.pistol.mag = WEAPONS.pistol.mag; f.ammo.pistol.reserve = 12; f.weapon = 'pistol';
    }
    return f;
  }

  const reloading = (f, now) => f.reloadAt > now;
  function canFire(f, now) {
    return f.alive && now >= f.nextFire && now >= f.swapAt && !reloading(f, now) && (WEAPONS[f.weapon].melee || f.ammo[f.weapon].mag > 0);
  }
  function startReload(f, now) {
    const w = WEAPONS[f.weapon]; if (w.melee || !f.alive || reloading(f, now) || now < f.swapAt) return false;
    const a = f.ammo[f.weapon]; if (a.mag >= w.mag || a.reserve <= 0) return false;
    f.reloadAt = now + w.reload; f.reloadId = f.weapon; return true;
  }
  function switchWeapon(f, id, now) {
    if (!WEAPONS[id] || id === f.weapon || !f.alive || (f.owned && !f.owned[id])) return false;
    f.weapon = id; f.reloadAt = 0; f.bloom = 0; f.swapAt = now + SWAP_TIME; return true;
  }
  // call every simulation step
  function tick(f, dt, now) {
    if (f.reloadAt && now >= f.reloadAt) {
      const a = f.ammo[f.reloadId], w = WEAPONS[f.reloadId], n = Math.min(w.mag - a.mag, a.reserve);
      a.mag += n; a.reserve -= n; f.reloadAt = 0;
    }
    f.bloom = Math.max(0, f.bloom - BLOOM_DECAY * dt);
  }
  // how far off-centre a shot can land, in radians
  function spreadOf(f, s = {}) {
    const w = WEAPONS[f.weapon];
    return ((s.ads ? w.ads : w.hip) + f.bloom + (s.airborne ? AIR_SPREAD : s.running ? RUN_SPREAD : s.moving ? MOVE_SPREAD : 0) * (s.ads ? 0.6 : 1)) * STANCE[s.stance || 0].steady;
  }
  // uses one round and returns the direction of each pellet, or null if the gun can't fire
  function fire(f, dir, s, now, rand) {
    if (!canFire(f, now)) return null;
    const w = WEAPONS[f.weapon], spread = spreadOf(f, s), dirs = [];
    for (let i = 0; i < (w.pellets || 1); i++) dirs.push(w.melee ? dir : scatter(dir, spread, rand));
    f.nextFire = now + w.cd;
    if (!w.melee) { f.ammo[f.weapon].mag--; f.bloom = Math.min(w.bloomMax, f.bloom + w.bloom); if (f.ammo[f.weapon].mag === 0) startReload(f, now); }
    return { weapon:f.weapon, dirs, spread };
  }
  function scatter(d, spread, rand) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * spread;
    let ux = -d[2], uy = 0, uz = d[0], l = Math.hypot(ux, uz);
    if (l < 1e-5) { ux = 1; uz = 0; l = 1; } ux /= l; uz /= l;
    const vx = d[1] * uz - d[2] * uy, vy = d[2] * ux - d[0] * uz, vz = d[0] * uy - d[1] * ux;
    const p = Math.cos(a) * r, q = Math.sin(a) * r, x = d[0] + ux * p + vx * q, y = d[1] + uy * p + vy * q, z = d[2] + uz * p + vz * q, n = Math.hypot(x, y, z);
    return [x / n, y / n, z / n];
  }
  function damageAt(id, dist, zone) {
    const w = WEAPONS[id]; let m = 1;
    if (!w.melee) m = dist <= w.nearM ? 1 : dist >= w.farM ? w.farMul : 1 - (1 - w.farMul) * (dist - w.nearM) / (w.farM - w.nearM);
    return Math.max(1, Math.round(w.dmg * m * (zone === 'head' ? w.headMul : 1)));
  }
  function applyDamage(t, dmg) {
    if (!t.alive) return { dealt:0, killed:false };
    const soak = Math.min(t.armor || 0, dmg * ARMOR_SOAK); if (soak) t.armor -= soak;   // armour takes most of the hit until it runs out
    const dealt = Math.min(t.hp, dmg - soak); t.hp -= dealt; if (t.hp <= 0.001) { t.hp = 0; t.alive = false; }
    return { dealt, killed:!t.alive };
  }
  function burn(t, dmg) {   // zone damage ignores armour
    if (!t.alive) return false; t.hp -= dmg; if (t.hp <= 0.001) { t.hp = 0; t.alive = false; return true; } return false;
  }
  function bestGun(f) {
    for (const id of BEST) if ((!f.owned || f.owned[id]) && f.ammo[id] && f.ammo[id].mag + f.ammo[id].reserve > 0) return id;
    return null;
  }
  // try to use something from the ground. Returns false if it's no use to this fighter, so it stays there.
  function takeItem(f, it) {
    if (it.kind === 'gun') {
      const w = WEAPONS[it.weapon], a = f.ammo[it.weapon];
      if (f.owned && !f.owned[it.weapon]) { f.owned[it.weapon] = true; a.mag = w.mag; a.reserve = w.mag; return true; }
      a.reserve += w.mag; return true;
    }
    if (it.kind === 'ammo') { for (const id in f.ammo) if (!f.owned || f.owned[id]) f.ammo[id].reserve += Math.ceil(WEAPONS[id].mag * 0.75); return true; }
    if (it.kind === 'armor') { if ((f.armor || 0) >= 100) return false; f.armor = Math.min(100, (f.armor || 0) + 50); return true; }
    if (it.kind === 'med') { if (f.hp >= f.maxHp) return false; f.hp = Math.min(f.maxHp, f.hp + 50); return true; }
    return false;
  }
  /* the zone: wait, shrink towards the next circle, repeat. Hurts more every phase. */
  const ZONE_PHASES = [
    { wait:45, shrink:35, r:66, dps:3 }, { wait:35, shrink:30, r:43, dps:4 }, { wait:30, shrink:25, r:27, dps:6 },
    { wait:25, shrink:20, r:15, dps:9 }, { wait:20, shrink:20, r:4, dps:14 },
  ];
  function makeZone(cx, cz, r, nextCentre) {
    const z = { cx, cz, r, phase:0, shrinking:false, dps:3, done:false, nextCentre, sx:cx, sz:cz, sr:r };
    const p = ZONE_PHASES[0], c = nextCentre(cx, cz, r, p.r); z.nx = c[0]; z.nz = c[1]; z.nr = p.r; z.t = p.wait; return z;
  }
  function zoneTick(z, dt) {
    if (z.done) return; z.t -= dt; const p = ZONE_PHASES[z.phase];
    if (!z.shrinking) { if (z.t <= 0) { z.shrinking = true; z.t = p.shrink; z.sx = z.cx; z.sz = z.cz; z.sr = z.r; z.dps = p.dps; } return; }
    const k = Math.min(1, 1 - z.t / p.shrink); z.cx = z.sx + (z.nx - z.sx) * k; z.cz = z.sz + (z.nz - z.sz) * k; z.r = z.sr + (z.nr - z.sr) * k;
    if (z.t <= 0) {
      z.phase++; z.shrinking = false; const q = ZONE_PHASES[z.phase];
      if (!q) { z.done = true; z.t = 0; return; }
      const c = z.nextCentre(z.cx, z.cz, z.r, q.r); z.nx = c[0]; z.nz = c[1]; z.nr = q.r; z.t = q.wait;
    }
  }
  const inZone = (z, x, y) => Math.hypot(x - z.cx, y - z.cz) <= z.r;

  function slab(p, d, lo, hi, r) {
    if (Math.abs(d) < 1e-7) return p >= lo && p <= hi;
    let a = (lo - p) / d, b = (hi - p) / d; if (a > b) [a, b] = [b, a];
    r[0] = Math.max(r[0], a); r[1] = Math.min(r[1], b); return r[0] <= r[1];
  }
  // a ray against one upright box turned around the vertical axis. Returns the distance, or Infinity on a miss.
  function rayBox(o, d, b) {
    const rx = o[0] - b.cx, rz = o[2] - b.cz, c = b.c ?? 1, s = b.s ?? 0, r = [0, Infinity];
    if (!slab(rx * c - rz * s, d[0] * c - d[2] * s, -b.hw, b.hw, r)) return Infinity;
    if (!slab(o[1], d[1], b.y0, b.y1, r)) return Infinity;
    if (!slab(rx * s + rz * c, d[0] * s + d[2] * c, -b.hd, b.hd, r)) return Infinity;
    return r[0];
  }
  // first wall or floor along a ray. near(x, z) gives the collision boxes around a point.
  function rayWorld(o, d, maxLen, near) {
    let best = d[1] < -1e-6 ? Math.min(maxLen, -o[1] / d[1]) : maxLen; if (best < 0) best = maxLen;
    const seen = new Set();
    for (let s = 0; s <= best + 3; s += 3) {
      for (const b of near(o[0] + d[0] * s, o[2] + d[2] * s)) {
        if (seen.has(b)) continue; seen.add(b);
        if (b.ramp) continue;
        const t = rayBox(o, d, b); if (t < best) best = t;
      }
    }
    return best;
  }
  function hitboxes(t) {
    const r = PLAYER.radius, y = t.y || 0, st = t.stance || 0;
    if (st === 1) return [
      { zone:'head', cx:t.x, cz:t.z, hw:0.15, hd:0.15, y0:y + 0.92, y1:y + 1.22 },
      { zone:'body', cx:t.x, cz:t.z, hw:r, hd:r, y0:y, y1:y + 0.92 },
    ];
    if (st === 2) {   // lying down: a long low box along the way you are facing, head at the front
      const a = t.proneYaw || 0, sx = Math.sin(a), cx = Math.cos(a);
      return [
        { zone:'head', cx:t.x + sx * 0.72, cz:t.z + cx * 0.72, hw:0.15, hd:0.16, y0:y, y1:y + 0.34 },
        { zone:'body', cx:t.x - sx * 0.2, cz:t.z - cx * 0.2, c:cx, s:sx, hw:0.27, hd:0.78, y0:y, y1:y + 0.3 },
      ];
    }
    return [
      { zone:'head', cx:t.x, cz:t.z, hw:0.15, hd:0.15, y0:y + PLAYER.bodyTop, y1:y + PLAYER.headTop },
      { zone:'body', cx:t.x, cz:t.z, hw:r, hd:r, y0:y, y1:y + PLAYER.bodyTop },
    ];
  }
  // what a single bullet hits: { t, target, zone } with target null if it stopped on the world
  function traceShot(o, d, maxLen, targets, near, skip) {
    const wall = rayWorld(o, d, maxLen, near);
    let best = { t:wall, target:null, zone:null };
    for (const T of targets) {
      if (T === skip || !T.alive) continue;
      for (const h of hitboxes(T)) { const t = rayBox(o, d, h); if (t < best.t) best = { t, target:T, zone:h.zone }; }
    }
    return best;
  }
  // a knife stab: the closest target in reach inside a forward cone, with nothing solid in between
  function knifeTrace(o, d, targets, near, skip) {
    const w = WEAPONS.knife; let best = null;
    for (const T of targets) {
      if (T === skip || !T.alive) continue;
      const y = Math.min((T.y || 0) + PLAYER.bodyTop, Math.max(T.y || 0, o[1])), dx = T.x - o[0], dy = y - o[1], dz = T.z - o[2], dist = Math.hypot(dx, dy, dz);
      if (dist > w.reach + PLAYER.radius || dist < 1e-4) continue;
      if ((dx * d[0] + dy * d[1] + dz * d[2]) / dist < 0.72) continue;
      const u = [dx / dist, dy / dist, dz / dist];
      if (rayWorld(o, u, dist, near) < dist - 0.05) continue;
      if (!best || dist < best.t) best = { t:dist, target:T, zone:'body' };
    }
    return best;
  }
  return { WEAPONS, ORDER, BEST, PLAYER, STANCE, ZONE_PHASES, bestGun, takeItem, burn, makeZone, zoneTick, inZone, newFighter, canFire, reloading, startReload, switchWeapon, tick, spreadOf, fire, damageAt, applyDamage, rayBox, rayWorld, hitboxes, traceShot, knifeTrace };
});

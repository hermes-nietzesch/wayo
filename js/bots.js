/* =====================================================================
   Wayo bots: how they find their way and how they fight.
   Like rules.js, this knows nothing about three.js or the screen, so it can
   run on a game server later. Tune how good bots are in the DIFF table.
   ===================================================================== */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make(require('./rules.js'));
  else root.WAYO_BOTS = make(root.WAYO_RULES);
})(typeof self !== 'undefined' ? self : this, function (R) {
  const DIFF = {
    //        reaction time, aim error (radians), seconds to settle aim, sight, pause between bursts
    easy:   { react:[0.75, 1.2],  err:0.16, settle:1.5, sight:30, pause:[0.8, 1.5], burst:[2, 3], strafe:0.55, retreat:0.1 },
    medium: { react:[0.45, 0.8],  err:0.1,  settle:1.0, sight:38, pause:[0.45, 1.0], burst:[3, 5], strafe:0.8, retreat:0.45 },
    hard:   { react:[0.25, 0.45], err:0.055, settle:0.7, sight:48, pause:[0.25, 0.6], burst:[4, 7], strafe:1, retreat:0.8 },
  };
  // speeds in metres a second. They match the walk and run animations, so feet stay planted instead of sliding.
  const STRAFE = 2.0, JOG = 3.3, RUN = 4.8, RADIUS = 0.36, EYE = 1.55, PERSONAL = 1.5;
  const LIKES = { pistol:15, smg:13, rifle:24, shotgun:7, sniper:42 };
  const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

  /* ---------------- street map: a walkable grid and shortest routes through it */
  function makeNav(area, walkable, cell = 1.5) {
    const x0 = area[0], z0 = area[1], w = Math.ceil((area[2] - x0) / cell), h = Math.ceil((area[3] - z0) / cell);
    const open = new Uint8Array(w * h), I = (i, j) => i + j * w;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) open[I(i, j)] = walkable(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell) ? 1 : 0;
    // keep only the largest connected area, so nobody is sent somewhere they can't reach
    const label = new Int32Array(w * h), sizes = [0]; let best = 0;
    for (let s = 0; s < open.length; s++) {
      if (!open[s] || label[s]) continue;
      const id = sizes.length; let n = 0, st = [s]; label[s] = id;
      while (st.length) { const c = st.pop(); n++; const i = c % w, j = (c - i) / w;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const p = i + a, q = j + b; if (p < 0 || q < 0 || p >= w || q >= h) continue; const k = I(p, q); if (open[k] && !label[k]) { label[k] = id; st.push(k); } } }
      sizes.push(n); if (n > (sizes[best] || 0)) best = id;
    }
    const cells = [];
    for (let k = 0; k < open.length; k++) { open[k] = label[k] === best ? 1 : 0; if (open[k]) cells.push(k); }
    const centre = k => { const i = k % w; return [x0 + (i + 0.5) * cell, z0 + ((k - i) / w + 0.5) * cell]; };
    const cellAt = (x, z) => { const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell); return i >= 0 && j >= 0 && i < w && j < h ? I(i, j) : -1; };
    function snap(x, z) {
      const c = cellAt(x, z); if (c >= 0 && open[c]) return c;
      const i0 = Math.floor((x - x0) / cell), j0 = Math.floor((z - z0) / cell);
      for (let r = 1; r < 14; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
        if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue;
        const p = i0 + a, q = j0 + b; if (p < 0 || q < 0 || p >= w || q >= h) continue; if (open[I(p, q)]) return I(p, q);
      }
      return cells[0];
    }
    const g = new Float32Array(w * h), from = new Int32Array(w * h), seen = new Int32Array(w * h); let stamp = 0;
    // a straight walk between two cells that stays on open ground
    function clear(a, b) {
      const [ax, az] = centre(a), [bx, bz] = centre(b), d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / (cell * 0.5));
      for (let s = 1; s < n; s++) { const t = s / n, k = cellAt(ax + (bx - ax) * t, az + (bz - az) * t); if (k < 0 || !open[k]) return false; }
      return true;
    }
    function path(ax, az, bx, bz) {
      const S = snap(ax, az), T = snap(bx, bz); stamp++;
      const tx = T % w, ty = (T - tx) / w, H = k => { const i = k % w, j = (k - i) / w, dx = Math.abs(i - tx), dy = Math.abs(j - ty); return dx + dy - 0.59 * Math.min(dx, dy); };
      const heap = [[H(S), S]]; g[S] = 0; seen[S] = stamp; from[S] = -1;
      const push = n => { heap.push(n); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
      const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let c = 0; for (;;) { let m = c, a = 2 * c + 1, b = a + 1; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return t; };
      let found = false;
      while (heap.length) {
        const [f, c] = pop(); if (c === T) { found = true; break; }
        if (f > g[c] + H(c) + 1e-3) continue;
        const i = c % w, j = (c - i) / w;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          if (!a && !b) continue; const p = i + a, q = j + b; if (p < 0 || q < 0 || p >= w || q >= h) continue;
          const k = I(p, q); if (!open[k]) continue;
          if (a && b && (!open[I(i + a, j)] || !open[I(i, j + b)])) continue;   // no cutting corners
          const ng = g[c] + (a && b ? 1.41 : 1);
          if (seen[k] === stamp && ng >= g[k]) continue;
          seen[k] = stamp; g[k] = ng; from[k] = c; push([ng + H(k), k]);
        }
      }
      if (!found) return [];
      const raw = []; for (let c = T; c >= 0; c = from[c]) raw.push(c); raw.reverse();
      const out = []; let a = 0;       // pull the zig-zag grid route into straight lines
      while (a < raw.length - 1) { let b = raw.length - 1; while (b > a + 1 && !clear(raw[a], raw[b])) b--; out.push(centre(raw[b])); a = b; }
      return out;
    }
    return { path, snap, centre, cells, cellAt, isOpen:(x, z) => { const c = cellAt(x, z); return c >= 0 && !!open[c]; }, randomSpot:rand => centre(cells[Math.floor(rand() * cells.length)]) };
  }

  /* ---------------- moving: slide along walls exactly like a player does */
  function slide(b, dx, dz, near) {
    b.x += dx; b.z += dz;
    for (const C of near(b.x, b.z)) {
      if (C.ramp || C.y1 < 0.45 || C.y0 > 1.6) continue;
      const rx = b.x - C.cx, rz = b.z - C.cz, lx = rx * C.c - rz * C.s, lz = rx * C.s + rz * C.c;
      const cx = Math.max(-C.hw, Math.min(C.hw, lx)), cz = Math.max(-C.hd, Math.min(C.hd, lz));
      let ax = lx - cx, az = lz - cz; const d2 = ax * ax + az * az;
      if (d2 >= RADIUS * RADIUS) continue;
      const d = Math.sqrt(d2) || 1e-3, push = RADIUS - d; if (d2 < 1e-8) { ax = 1; az = 0; }
      const px = ax / d * push, pz = az / d * push; b.x += px * C.c + pz * C.s; b.z += -px * C.s + pz * C.c;
    }
  }

  function newBot(o, diff) {
    const b = R.newFighter(o); b.isBot = true; b.gearId = b.weapon; b.name = o.name; b.diff = DIFF[diff] || DIFF.medium; b.ry = 0; b.speed = 0; b.kills = 0; b.deaths = 0;
    Object.assign(b, { state:'roam', route:[], think:Math.random() * 0.3, target:null, seenAt:0, reactAt:0, trackT:0, burst:0, pauseAt:0, strafeDir:1, strafeAt:0, lastX:b.x, lastZ:b.z, stuck:0, heard:null, holdAt:0, aimYaw:0, aimPitch:0, runTo:null, vx:0, vz:0, wantX:0, wantZ:0, back:false });
    return b;
  }
  const rng = (r, [a, b]) => a + r() * (b - a);
  const aimAt = t => R.STANCE[t.stance || 0].aimAt;
  function sees(b, t, W) {
    const o = [b.x, b.y + EYE, b.z], dx = t.x - o[0], dy = t.y + aimAt(t) - o[1], dz = t.z - o[2], l = Math.hypot(dx, dy, dz);
    if (l < 1e-3) return true;
    return R.rayWorld(o, [dx / l, dy / l, dz / l], l, W.near) >= l - 0.2;
  }
  function pickTarget(b, W) {
    let best = null, bd = 1e9;
    // battle royale opens with a quiet looting spell: bots only fight back if someone starts it
    if (W.now < (W.graceUntil || 0) && !(b.lastHitBy && W.now - b.lastHitAt < 3)) return null;
    const fx = Math.sin(b.ry), fz = Math.cos(b.ry);
    for (const t of W.fighters) {
      if (t === b || !t.alive || (b.team !== null && b.team === t.team)) continue;
      // when the match is thinning out too fast bots leave each other alone, though they still answer if shot
      if (W.truce && t.isBot && !(b.lastHitBy === t && W.now - b.lastHitAt < 3)) continue;
      const dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz);
      const wasHit = b.lastHitBy === t && W.now - b.lastHitAt < 2.5;
      if (d > b.diff.sight * (W.sightMul || 1) * (wasHit ? 1 : [1, 0.8, 0.55][t.stance || 0])) continue;   // low targets are harder to spot
      const inView = d < 5 || (dx * fx + dz * fz) / (d || 1) > -0.15 || (b.lastHitBy === t && W.now - b.lastHitAt < 2.5);
      if (!inView) continue;
      const score = d - (t === b.target ? 8 : 0);
      if (score < bd && sees(b, t, W)) { best = t; bd = score; }
    }
    return best;
  }
  function routeTo(b, x, z, W) { b.route = W.nav.path(b.x, b.z, x, z); }
  function coverSpot(b, W) {
    const t = b.target; let best = null, bd = 1e9;
    for (let i = 0; i < 14; i++) {
      const a = W.rand() * 6.28, r = 5 + W.rand() * 12, x = b.x + Math.cos(a) * r, z = b.z + Math.sin(a) * r; if (!W.nav.isOpen(x, z)) continue;
      const dx = t.x - x, dz = t.z - z, l = Math.hypot(dx, dz), o = [x, EYE, z];
      if (R.rayWorld(o, [dx / l, 0, dz / l], l, W.near) >= l - 0.3) continue;
      const score = r + (Math.hypot(t.x - b.x, t.z - b.z) > l ? 8 : 0); if (score < bd) { bd = score; best = [x, z]; }
    }
    return best;
  }
  // what on the ground is worth walking to
  function wants(b, it) {
    if (it.kind === 'gun') return R.BEST.indexOf(it.weapon) < R.BEST.indexOf(b.weapon) && !(b.owned && b.owned[it.weapon]);
    if (it.kind === 'armor') return (b.armor || 0) < 50;
    if (it.kind === 'med') return b.hp < 70;
    if (it.kind === 'ammo') return b.ammo[b.weapon].reserve < R.WEAPONS[b.weapon].mag;
    return false;
  }
  function nearestLoot(b, W) {
    let best = null, bd = 34;
    for (const it of W.items) { if (it.gone || it.roof || !wants(b, it)) continue; const d = Math.hypot(it.ax - b.x, it.az - b.z); if (d < bd) { bd = d; best = it; } }
    return best;
  }
  function think(b, W) {
    const prev = b.target, t = pickTarget(b, W);
    // the zone comes first: get inside the next safe circle before it closes
    const Z = W.zone;
    if (Z) {
      const need = Z.shrinking ? 0.8 : 0.92, away = Math.hypot(b.x - Z.nx, b.z - Z.nz) > Z.nr * need, burning = Math.hypot(b.x - Z.cx, b.z - Z.cz) > Z.r - 1;
      if ((away && (Z.shrinking || Z.t < 16 || !t)) || burning) {
        if (t) { if (t !== prev) { b.reactAt = W.now + 0.4; b.trackT = 0; } b.target = t; } else b.target = null;
        if (b.state !== 'rotate' || !b.route.length) { const a = W.rand() * 6.28, r = Z.nr * 0.55 * W.rand(); routeTo(b, Z.nx + Math.cos(a) * r, Z.nz + Math.sin(a) * r, W); b.state = 'rotate'; }
        return;
      }
      if (b.state === 'rotate') { b.state = 'roam'; b.route = []; }
    }
    if (t) {
      if (t !== prev) { b.reactAt = W.now + rng(W.rand, b.diff.react) * (Math.hypot(t.x - b.x, t.z - b.z) < 5 ? 0.6 : 1); b.trackT = 0; b.burst = 0; }
      b.target = t; b.seenAt = W.now; b.lastSeen = [t.x, t.z]; b.state = 'fight';
      if (b.team !== null && W.intel) W.intel[b.team] = { x:t.x, z:t.z, t:W.now };   // tell the team where the enemy is
      if (b.hp < 35 && !b.runTo && W.rand() < b.diff.retreat) { const c = coverSpot(b, W); if (c) { b.runTo = W.now + 3; routeTo(b, c[0], c[1], W); b.state = 'retreat'; } }
    } else if (b.state === 'fight') {
      b.target = null; b.state = 'chase'; if (b.lastSeen) routeTo(b, b.lastSeen[0], b.lastSeen[1], W); b.chaseUntil = W.now + 6;
    } else if (b.state === 'chase' && (W.now > b.chaseUntil || !b.route.length)) {
      b.state = 'roam'; b.route = [];
    }
    if (b.runTo && W.now > b.runTo) { b.runTo = null; if (b.state === 'retreat') b.state = t ? 'fight' : 'roam'; }
    if (b.state === 'loot' && (!b.lootItem || b.lootItem.gone || !b.route.length)) { b.state = 'roam'; b.lootItem = null; b.route = []; }
    if (b.state === 'roam' && W.items) {
      const it = nearestLoot(b, W);
      if (it) { b.lootItem = it; routeTo(b, it.ax, it.az, W); b.state = 'loot'; }
    }
    if (b.state === 'roam') {
      const call = b.team !== null && W.intel && W.intel[b.team];
      if (call && W.now - call.t < 6 && Math.hypot(call.x - b.x, call.z - b.z) < 70) { routeTo(b, call.x + (W.rand() - 0.5) * 10, call.z + (W.rand() - 0.5) * 10, W); b.state = 'chase'; b.chaseUntil = W.now + 7; }
      else if (b.heard && W.now - b.heard.t < 6) { routeTo(b, b.heard.x, b.heard.z, W); b.heard = null; b.state = 'chase'; b.chaseUntil = W.now + 8; }
      else if (!b.route.length && W.now >= b.holdAt) {
        // real players go looking for a fight: mostly head towards someone, sometimes just patrol
        const foes = W.fighters.filter(f => f !== b && f.alive && (b.team === null || f.team !== b.team));
        let s = W.nav.randomSpot(W.rand);
        if (foes.length && W.rand() < (W.hunt ?? 0.65)) { const f = foes[Math.floor(W.rand() * foes.length)]; s = [f.x + (W.rand() - 0.5) * 16, f.z + (W.rand() - 0.5) * 16]; }
        routeTo(b, s[0], s[1], W); if (W.rand() < 0.15) b.holdAt = W.now + 0.6 + W.rand() * 1.2;
      }
    }
  }
  function want(b, dx, dz, sp) { const d = Math.hypot(dx, dz) || 1; b.wantX = dx / d * sp; b.wantZ = dz / d * sp; }
  function walkRoute(b, sp, dt, W) {
    let n = b.route[0]; if (!n) return 0;
    let dx = n[0] - b.x, dz = n[1] - b.z, d = Math.hypot(dx, dz);
    if (d < 0.7) { b.route.shift(); n = b.route[0]; if (!n) return 0; dx = n[0] - b.x; dz = n[1] - b.z; }
    want(b, dx, dz, sp); return sp;
  }
  function aimAndFire(b, dt, W) {
    const t = b.target; if (!t || !t.alive) return;
    const o = [b.x, b.y + EYE, b.z], tx = t.x, ty = t.y + aimAt(t) - (t.stance ? 0 : 0.1), tz = t.z, dx = tx - o[0], dy = ty - o[1], dz = tz - o[2], hd = Math.hypot(dx, dz);
    b.aimWant = Math.atan2(dx, dz); b.aimPitch = Math.atan2(dy, hd); b.trackT += dt;
    if (Math.abs(wrap(b.aimWant - b.aimYaw)) > 0.3) return;   // still turning towards the target
    if (W.now < b.reactAt) return;
    const D = b.diff, w = R.WEAPONS[b.weapon];
    if (hd > (w.range || 60) || (w.pellets > 1 && hd > 22)) return;
    if (W.now < b.pauseAt) return;
    if (!R.canFire(b, W.now)) return;
    if (!sees(b, t, W)) return;
    // aim starts rough and settles while the bot tracks you; running targets are harder
    const settle = 0.3 + 0.7 * Math.exp(-b.trackT / D.settle), mv = t.speed || 0, err = D.err * settle * (1 + mv * 0.09);
    const yaw = b.aimWant + (W.rand() - 0.5) * 2 * err, pitch = Math.atan2(dy, hd) + (W.rand() - 0.5) * 1.4 * err, c = Math.cos(pitch);
    const shot = R.fire(b, [Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c], { moving:b.speed > 0.5, running:false, ads:true }, W.now, W.rand);
    if (!shot) return;
    W.onShot(b, shot, o);
    if (w.auto) { if (b.burst <= 0) b.burst = Math.round(rng(W.rand, D.burst)); if (--b.burst <= 0) b.pauseAt = W.now + rng(W.rand, D.pause); }
    else b.pauseAt = W.now + rng(W.rand, D.pause) * 0.6;
  }
  function step(b, dt, W) {
    if (!b.alive) return;
    R.tick(b, dt, W.now);
    if (W.items) {
      for (const it of W.items) if (!it.gone && !it.roof && Math.hypot(it.ax - b.x, it.az - b.z) < 1.5 && R.takeItem(b, it)) W.onItem(it, b);
      const top = R.bestGun(b), a = b.ammo[b.weapon];
      if (!top) b.ammo.pistol.reserve = 12;                       // never left totally helpless
      else if (top !== b.weapon && (R.BEST.indexOf(top) < R.BEST.indexOf(b.weapon) || a.mag + a.reserve === 0) && !R.reloading(b, W.now)) b.weapon = top;
      if (b.weapon !== b.gearId) { b.gearId = b.weapon; W.onGear(b); }
      if (a.mag === 0 && !R.reloading(b, W.now)) R.startReload(b, W.now);
    }
    if ((b.think -= dt) <= 0) { b.think = 0.18 + W.rand() * 0.1; think(b, W); }
    let sp = 0; b.wantX = b.wantZ = 0; b.aimWant = null;
    if (b.state === 'fight' && b.target) {
      const t = b.target, dist = Math.hypot(t.x - b.x, t.z - b.z), like = LIKES[b.weapon] || 15;
      if (dist > like * 1.3) { if (!b.route.length || W.now > (b.repathAt || 0)) { routeTo(b, t.x, t.z, W); b.repathAt = W.now + 0.8; } sp = walkRoute(b, RUN, dt, W); }
      else {
        if (W.now > b.strafeAt) { b.strafing = W.rand() < b.diff.strafe; b.strafeDir = W.rand() < 0.5 ? -1 : 1; b.strafeAt = W.now + 0.9 + W.rand() * 1.4; }
        if (b.strafing) {
          const l = dist || 1, back = dist < like * 0.5 ? -0.7 : 0, nx = (t.x - b.x) / l, nz = (t.z - b.z) / l, mx = -nz * b.strafeDir + nx * back, mz = nx * b.strafeDir + nz * back;
          if (W.nav.isOpen(b.x + mx * 1.4, b.z + mz * 1.4)) { want(b, mx, mz, STRAFE); sp = STRAFE; } else b.strafeDir *= -1;
        }
      }
      aimAndFire(b, dt, W);
    } else if (b.state === 'rotate') { sp = walkRoute(b, RUN, dt, W); if (b.target && b.target.alive) aimAndFire(b, dt, W); else b.target = null; }
    else if (b.state === 'retreat') sp = walkRoute(b, RUN, dt, W);
    else if (b.state === 'chase' || b.state === 'loot') sp = walkRoute(b, RUN, dt, W);
    else sp = walkRoute(b, JOG, dt, W);
    // keep a person's distance from everyone else instead of walking through them
    let wx = b.wantX, wz = b.wantZ;
    for (const o of W.fighters) {
      if (o === b || !o.alive) continue;
      const dx = b.x - o.x, dz = b.z - o.z, d = Math.hypot(dx, dz);
      if (d < PERSONAL && d > 1e-3 && Math.abs((o.y || 0) - b.y) < 1.5) { const p = (PERSONAL - d) / PERSONAL * 4.5; wx += dx / d * p; wz += dz / d * p; }
    }
    // people speed up and slow down, they don't start and stop instantly
    const k = 1 - Math.exp(-dt * 9); b.vx += (wx - b.vx) * k; b.vz += (wz - b.vz) * k;
    const lim = Math.hypot(b.vx, b.vz); if (lim > RUN * 1.05) { b.vx *= RUN * 1.05 / lim; b.vz *= RUN * 1.05 / lim; }
    slide(b, b.vx * dt, b.vz * dt, W.near);
    for (const o of W.fighters) {
      if (o === b || !o.alive) continue;
      const dx = b.x - o.x, dz = b.z - o.z, d = Math.hypot(dx, dz);
      if (d < 0.7 && d > 1e-3 && Math.abs((o.y || 0) - b.y) < 1.5) slide(b, dx / d * (0.7 - d), dz / d * (0.7 - d), W.near);
    }
    b.y = W.groundAt(b.x, b.z, b.y + 0.6);
    const speed = Math.hypot(b.vx, b.vz); b.speed = speed;
    // legs face the way the bot is moving, the upper body keeps facing the fight
    const aiming = b.aimWant != null;
    let legs = b.ry; b.back = false;
    if (speed > 0.35) {
      legs = Math.atan2(b.vx, b.vz);
      if (aiming && Math.abs(wrap(legs - b.aimYaw)) > 1.95) { legs = wrap(legs + Math.PI); b.back = true; }
    } else if (aiming) legs = b.aimWant;
    b.ry = wrap(b.ry + wrap(legs - b.ry) * Math.min(1, dt * 10));
    const look = aiming ? b.aimWant : b.ry; b.aimYaw = wrap(b.aimYaw + wrap(look - b.aimYaw) * Math.min(1, dt * 11)); if (!aiming) b.aimPitch *= 0.9;
    // stuck on something: drop the route and let the next thought find a new one
    const moved = Math.hypot(b.x - b.lastX, b.z - b.lastZ); b.lastX = b.x; b.lastZ = b.z;
    if (sp > 0 && moved < sp * dt * 0.25) { b.stuck += dt; if (b.stuck > 0.7) { b.stuck = 0; b.route = []; b.holdAt = 0; const s = W.nav.snap(b.x, b.z), c = W.nav.centre(s); slide(b, (c[0] - b.x) * 0.3, (c[1] - b.z) * 0.3, W.near); } } else b.stuck = Math.max(0, b.stuck - dt);
  }
  // bots react to gunfire they can hear
  function hearShot(bots, x, z, shooter, W) {
    for (const b of bots) { if (b === shooter || !b.alive || b.state !== 'roam' || (b.team !== null && b.team === shooter.team)) continue; const d = Math.hypot(b.x - x, b.z - z); if (d < 34 && W.rand() < 0.5) b.heard = { x, z, t:W.now }; }
  }
  function respawn(b, spot, W) {
    const fresh = R.newFighter({ id:b.id, weapon:b.weapon, team:b.team });
    b.think = W.rand() * 0.3; b.holdAt = 0; b.pauseAt = 0; b.lastHitBy = null;
    Object.assign(b, { ammo:fresh.ammo, hp:b.maxHp, alive:true, reloadAt:0, nextFire:0, bloom:0, x:spot[0], z:spot[1], y:W.groundAt(spot[0], spot[1], 2), state:'roam', route:[], target:null, runTo:null, lastSeen:null, burst:0, heard:null, lastX:spot[0], lastZ:spot[1], vx:0, vz:0, speed:0, back:false });
  }
  return { DIFF, makeNav, newBot, step, hearShot, respawn, sees, RADIUS };
});

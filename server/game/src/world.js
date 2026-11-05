// Computer Village as the server sees it: only walls, floors and walkable ground. world.json is exported from the game itself.
import R from '../../../js/rules.js';
import BOTS from '../../../js/bots.js';
import DATA from './world.json';

const CELL = 6, HASH = new Map(), RAD = 0.32, STEP = 0.45, NOTHING = [];
const COLS = DATA.cols.map(a => ({ cx:a[0], cz:a[1], c:a[2], s:a[3], hw:a[4], hd:a[5], y0:a[6], y1:a[7], ramp:a.length > 8 ? { base:a[8], rise:a[9] } : null }));
for (const C of COLS){
  const r = Math.hypot(C.hw, C.hd);
  for (let gx = Math.floor((C.cx - r) / CELL); gx <= Math.floor((C.cx + r) / CELL); gx++)
    for (let gz = Math.floor((C.cz - r) / CELL); gz <= Math.floor((C.cz + r) / CELL); gz++){ const k = gx + ',' + gz; let l = HASH.get(k); if (!l) HASH.set(k, l = []); l.push(C); }
}
export function near(x, z){
  const out = new Set(), gx = Math.floor(x / CELL), gz = Math.floor(z / CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const c of HASH.get((gx + i) + ',' + (gz + j)) || NOTHING) out.add(c);
  return out;
}
const local = (C, x, z) => { const dx = x - C.cx, dz = z - C.cz; return [dx * C.c - dz * C.s, dx * C.s + dz * C.c]; };
const topAt = (C, lz) => { if (!C.ramp) return C.y1; const t = Math.min(1, Math.max(0, (lz + C.hd) / (2 * C.hd))); return C.ramp.base + C.ramp.rise * t; };
export function groundAt(x, z, fromY){
  let g = 0;
  for (const C of near(x, z)){
    const [lx, lz] = local(C, x, z); if (Math.abs(lx) > C.hw + RAD * 0.5 || Math.abs(lz) > C.hd + RAD * 0.5) continue;
    const top = topAt(C, lz); if (top <= fromY + STEP && top > g) g = top;
  }
  return g;
}
const a = DATA.area, S = 1.5, W = Math.ceil((a[2] - a[0]) / S), OPEN = new Set(DATA.cells);
export const nav = BOTS.makeNav(a, (x, z) => OPEN.has(Math.floor((x - a[0]) / S) + Math.floor((z - a[1]) / S) * W));
export { R, BOTS };

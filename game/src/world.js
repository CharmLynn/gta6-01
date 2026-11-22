// Solmar City — procedural city generation and collision queries.
// The map is a grid of roads; blocks between them hold buildings, a park,
// a port yard, the beach and the sea. Everything is placed from a seed.
import { CFG } from './config.js';
import { makeRng, range, rangeInt, pick, chance } from './random.js';

// Named places the missions and the HUD point at. Coordinates are on
// roadside pavement so the player can always reach them.
export const PLACES = {
  garage: { x: 872, y: 1130, label: "Mama Rosa's Garage" },
  marina: { x: 3050, y: 2440, label: 'Marina Pickup' },
  hotel: { x: 1872, y: 690, label: 'Downtown Hotel' },
  port: { x: 420, y: 2350, label: 'Port Drop-off' },
  industrial: { x: 550, y: 520, label: 'Industrial Yard' },
  bank: { x: 1420, y: 1080, label: 'Solmar Bank' },
  hideout: { x: 2872, y: 2030, label: 'Hideout' },
  hospital: { x: 1372, y: 2030, label: 'Solmar Hospital' },
  policeStation: { x: 2372, y: 1130, label: 'Police Station' },
  playerStart: { x: 950, y: 1330, label: 'Start' },
};

const ROOF_COLORS = ['#c96f4a', '#b85c5c', '#7d8aa0', '#a08a6d', '#8a7ba8', '#5f7d6b', '#c9a35c'];
const DOWN_ROOFS = ['#5d6b8c', '#6b7d9c', '#8c7d5d', '#7d5c6b'];
const CONTAINER_COLORS = ['#c65a3a', '#3a7dc6', '#4a9c5c', '#c6a53a', '#8c5aa8'];

export function generateCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const containers = [];
  const zones = [];
  const { roadsX, roadsY, roadW } = CFG;

  // Blocks are the rectangles between neighbouring roads.
  for (let ix = 0; ix < roadsX.length - 1; ix++) {
    for (let iy = 0; iy < roadsY.length - 1; iy++) {
      const x0 = roadsX[ix] + roadW / 2 + 14;
      const x1 = roadsX[ix + 1] - roadW / 2 - 14;
      const y0 = roadsY[iy] + roadW / 2 + 14;
      const y1 = roadsY[iy + 1] - roadW / 2 - 14;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const downtown = cx > 1100 && cx < 2500 && cy > 600 && cy < 1800;
      const isPark = ix === 3 && iy === 3; // central park block
      const isPort = ix === 0 && iy === 4; // port yard, south-west
      const isIndustrial = ix === 0 && iy === 0; // shark territory, north-west
      const zone = isPark ? 'park' : isPort ? 'port' : isIndustrial ? 'industrial' : downtown ? 'downtown' : 'residential';
      zones.push({ x0, y0, x1, y1, zone });
      if (isPark) {
        for (let t = 0; t < 26; t++) trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: range(rng, 10, 16) });
        continue;
      }
      if (isPort) {
        for (let c = 0; c < 22; c++) {
          containers.push({ x: range(rng, x0 + 30, x1 - 70), y: range(rng, y0 + 20, y1 - 30), w: 62, h: 26, color: pick(rng, CONTAINER_COLORS), angle: chance(rng, 0.5) ? 0 : Math.PI / 2 });
        }
        continue;
      }
      // Normal block: 1-4 buildings with pavement around them.
      const bw = x1 - x0, bh = y1 - y0;
      const cols = bw > 340 ? 2 : 1, rows = bh > 300 ? 2 : 1;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (chance(rng, 0.12)) continue; // empty lot / parking
          const bx = x0 + (c * bw) / cols + 12, by = y0 + (r * bh) / rows + 12;
          const bwid = bw / cols - 24, bhgt = bh / rows - 24;
          const tall = downtown && chance(rng, 0.55);
          buildings.push({
            x: bx, y: by, w: bwid, h: bhgt,
            height: tall ? rangeInt(rng, 3, 6) : rangeInt(rng, 1, 2),
            color: tall ? pick(rng, DOWN_ROOFS) : pick(rng, ROOF_COLORS),
            zone,
          });
        }
      }
      if (chance(rng, 0.6)) trees.push({ x: range(rng, x0 + 10, x1 - 10), y: range(rng, y0 + 10, y1 - 10), r: 12 });
    }
  }
  // Beach strip: a few palms and umbrellas east of the last road.
  for (let t = 0; t < 14; t++) trees.push({ x: range(rng, 2920, 3160), y: range(rng, 120, CFG.worldH - 120), r: 13 });

  return { seed, buildings, trees, containers, zones, roadsX, roadsY };
}

// --- Collision -------------------------------------------------------------
// All colliders are axis-aligned rectangles; circles resolve by axis push-out.
export function circleHitsRect(x, y, r, rect) {
  const nx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - nx, dy = y - ny;
  return dx * dx + dy * dy < r * r;
}

export function solidAt(world, x, y, r) {
  if (x < r || y < r || x > CFG.worldW - r || y > CFG.worldH - r) return true;
  if (x > CFG.seaX - r) return true; // the sea is not walkable
  for (const b of world.buildings) if (circleHitsRect(x, y, r, b)) return true;
  for (const c of world.containers) {
    const w = c.angle === 0 ? c.w : c.h, h = c.angle === 0 ? c.h : c.w;
    if (circleHitsRect(x, y, r, { x: c.x, y: c.y, w, h })) return true;
  }
  return false;
}

// Move a circle, sliding along walls: try x then y separately.
export function moveCircle(world, pos, dx, dy, r) {
  if (!solidAt(world, pos.x + dx, pos.y, r)) pos.x += dx;
  if (!solidAt(world, pos.x, pos.y + dy, r)) pos.y += dy;
}

export function onRoad(x, y) {
  const half = CFG.roadW / 2;
  for (const rx of CFG.roadsX) if (Math.abs(x - rx) < half) return true;
  for (const ry of CFG.roadsY) if (Math.abs(y - ry) < half) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let bx = CFG.roadsX[0], bd = Math.abs(x - bx);
  for (const rx of CFG.roadsX) if (Math.abs(x - rx) < bd) { bd = Math.abs(x - rx); bx = rx; }
  let by = CFG.roadsY[0]; bd = Math.abs(y - by);
  for (const ry of CFG.roadsY) if (Math.abs(y - ry) < bd) { bd = Math.abs(y - ry); by = ry; }
  return Math.abs(x - bx) < Math.abs(y - by) ? { x: bx, y, vertical: true } : { x, y: by, vertical: false };
}

export function randomRoadPoint(rng) {
  if (chance(rng, 0.5)) return { x: pick(rng, CFG.roadsX), y: range(rng, 120, CFG.worldH - 120), vertical: true };
  return { x: range(rng, 120, CFG.worldW - 240), y: pick(rng, CFG.roadsY), vertical: false };
}

export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

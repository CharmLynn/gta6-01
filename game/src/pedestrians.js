// Solmar City — pedestrians, gang members and police on foot.
// Peds stroll the sidewalks and flee gunfire or speeding cars; cops chase
// the player when wanted; gang members hold ground and shoot back.
import { CFG } from './config.js';
import { makeRng, pick, range, chance } from './random.js';
import { moveCircle, onRoad, randomRoadPoint, dist, clamp } from './world.js';

const SHIRTS = ['#e86a5a', '#5a8de8', '#e8c85a', '#7bc96a', '#c95ad9', '#e8e8e8', '#6ad9c9', '#d97b3a'];

export function makePed(x, y, rng) {
  const p = randomRoadPoint(rng);
  return {
    x, y, angle: rng() * Math.PI * 2, speed: range(rng, 40, 70),
    shirt: pick(rng, SHIRTS), state: 'walk', fleeX: 0, fleeY: 0,
    roadX: p.x, roadY: p.y, vertical: p.vertical, dir: chance(rng, 0.5) ? 1 : -1,
    panic: 0, hp: 100,
  };
}

export function spawnPeds(rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(rng);
    const off = chance(rng, 0.5) ? 62 : -62;
    peds.push(makePed(p.vertical ? p.x + off : p.x, p.vertical ? p.y : p.y + off, rng));
  }
  return peds;
}

export function updatePed(ped, dt, world, state) {
  const player = state.player;
  const dPlayer = dist(ped.x, ped.y, player.x, player.y);
  const carNear = state.cars.some((c) => !c.parked && dist(ped.x, ped.y, c.x, c.y) < 60 && Math.abs(c.speed) > 80);
  if (ped.panic > 0) ped.panic -= dt;
  if ((dPlayer < 90 && state.gunshotTimer > 0) || carNear || ped.panic > 0) {
    // Flee away from the player / the loudest danger.
    ped.state = 'flee';
    const away = Math.atan2(ped.y - player.y, ped.x - player.x);
    const dx = Math.cos(away) * CFG.pedFleeSpeed * dt;
    const dy = Math.sin(away) * CFG.pedFleeSpeed * dt;
    moveCircle(world, ped, dx, dy, 10);
    ped.angle = away;
    return;
  }
  ped.state = 'walk';
  // Stroll along a sidewalk, flipping direction at world edges.
  if (ped.vertical) {
    ped.y += ped.dir * ped.speed * dt;
    ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (ped.y < 120 || ped.y > CFG.worldH - 120) ped.dir *= -1;
  } else {
    ped.x += ped.dir * ped.speed * dt;
    ped.angle = ped.dir > 0 ? 0 : Math.PI;
    if (ped.x < 120 || ped.x > CFG.worldW - 260) ped.dir *= -1;
  }
}

// --- Gang members ----------------------------------------------------------
export function makeEnemy(x, y, i) {
  return {
    x, y, angle: Math.random() * Math.PI * 2, hp: CFG.enemyHp,
    shirt: '#22262e', bandana: '#e83a3a', state: 'guard',
    shootCd: 1 + Math.random(), homeX: x, homeY: y, id: 'shark-' + i,
  };
}

export function updateEnemy(e, dt, state) {
  const p = state.player;
  const d = dist(e.x, e.y, p.x, p.y);
  e.shootCd -= dt;
  if (d < 520) {
    e.state = 'fight';
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    if (e.shootCd <= 0 && state.mode === 'playing') {
      e.shootCd = 1.1 + Math.random() * 0.8;
      state.audio.enemyShot();
      spawnTracer(state, e.x, e.y, p.x, p.y);
      // Sharks are bad shots at range; closer is deadlier.
      if (Math.random() < clamp(0.55 - d / 900, 0.08, 0.5)) damagePlayer(state, 7 + Math.floor(Math.random() * 6));
    }
  } else if (d > 80) {
    // Drift back to their post.
    e.state = 'guard';
    e.angle = Math.atan2(e.homeY - e.y, e.homeX - e.x);
    const dx = Math.cos(e.angle) * 40 * dt, dy = Math.sin(e.angle) * 40 * dt;
    moveCircle(state.world, e, dx, dy, 11);
  }
}

export function spawnTracer(state, x1, y1, x2, y2) {
  state.particles.push({ x: x1, y: y1, vx: 0, vy: 0, life: 0.08, max: 0.08, color: '#ffe9a8', size: 2, tracer: { x2, y2 } });
}

// --- Police on foot --------------------------------------------------------
export function makeCop(x, y, i) {
  return { x, y, angle: 0, hp: CFG.copHp, speed: CFG.copFootSpeed, id: 'cop-' + i, state: 'chase', shootCd: 2 };
}

export function updateCop(cop, dt, state) {
  const p = state.player;
  const d = dist(cop.x, cop.y, p.x, p.y);
  cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
  if (p.car) {
    // Cops cannot catch a car on foot: run at it, then give up and shoot tyres.
    if (d < 60) { /* touching a moving car hurts the cop, handled by car collision */ }
  }
  const dx = Math.cos(cop.angle) * cop.speed * dt;
  const dy = Math.sin(cop.angle) * cop.speed * dt;
  moveCircle(state.world, cop, dx, dy, 11);
  cop.shootCd -= dt;
  if (d < 300 && cop.shootCd <= 0 && !p.car) {
    cop.shootCd = 2.2;
    state.audio.enemyShot();
    spawnTracer(state, cop.x, cop.y, p.x, p.y);
    if (Math.random() < 0.25) damagePlayer(state, 5);
  }
  if (d < 22 && !p.car) state.busted = true; // caught on foot
}

// --- Shared damage ---------------------------------------------------------
export function damagePlayer(state, amount) {
  if (state.mode !== 'playing' || state.playerDead) return;
  state.player.hp -= amount;
  state.shake = Math.min(9, state.shake + 3);
  spawnBlood(state, state.player.x, state.player.y);
  if (state.player.hp <= 0) { state.player.hp = 0; state.wasted = true; }
}

export function spawnBlood(state, x, y) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 90;
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, max: 0.5, color: '#c22a2a', size: 3 });
  }
}

export function killPed(state, ped) {
  ped.dead = true;
  spawnBlood(state, ped.x, ped.y);
  addWanted(state, 1, 'Pedestrian hit');
}
export function addWanted(state, stars, reason) {
  state.wanted = Math.min(CFG.maxWanted, state.wanted + stars);
  state.lastCrimeAt = state.time;
  state.crimeFlash = reason || '';
  state.crimeFlashT = 2;
}

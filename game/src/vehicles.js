// Solmar City — vehicle physics, parked cars, traffic AI and police cars.
import { CFG } from './config.js';
import { makeRng, pick, range, chance } from './random.js';
import { solidAt, moveCircle, onRoad, randomRoadPoint, dist, clamp } from './world.js';

const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8b73a', '#4fae6b', '#e8e8e8', '#2b2b33', '#9c5ad9', '#d97b2f', '#7fb8c9'];
const CAR_NAMES = ['Solmar', 'Viento', 'Brisa', 'Tiburon', 'Coral', 'Palma', 'Onda', 'Faro'];

export function makeCar(x, y, angle, opts = {}) {
  return {
    id: opts.id || ('car-' + Math.floor(Math.random() * 1e9)),
    x, y, angle, speed: 0,
    color: opts.color || pick(Math.random, CAR_COLORS),
    name: opts.name || pick(Math.random, CAR_NAMES),
    police: !!opts.police, taxi: !!opts.taxi, traffic: !!opts.traffic,
    parked: !!opts.parked, stolen: false, hp: 100,
    // traffic AI
    dir: opts.dir || 0, // 0:+x 1:-x 2:+y 3:-y along a road
    lane: opts.lane || 0, targetSpeed: opts.targetSpeed || CFG.trafficSpeed,
    w: 44, h: 22,
  };
}

// Parked cars along road edges for the player to steal.
export function spawnParkedCars(world, rng, count) {
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries++ < count * 12) {
    const p = randomRoadPoint(rng);
    const off = chance(rng, 0.5) ? 34 : -34;
    const x = p.vertical ? p.x + off : p.x;
    const y = p.vertical ? p.y : p.y + off;
    if (solidAt(world, x, y, 24) || cars.some((c) => dist(c.x, c.y, x, y) < 120)) continue;
    cars.push(makeCar(x, y, p.vertical ? (chance(rng, 0.5) ? 0 : Math.PI) : (chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2), {
      parked: true, id: 'parked-' + cars.length,
    }));
  }
  return cars;
}

export function spawnTraffic(world, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(rng);
    const vertical = p.vertical;
    const dir = vertical ? (chance(rng, 0.5) ? 2 : 3) : (chance(rng, 0.5) ? 0 : 1);
    const lane = chance(rng, 0.5) ? 22 : -22;
    const x = vertical ? p.x + lane : p.x;
    const y = vertical ? p.y : p.y + lane;
    const angle = [0, Math.PI, Math.PI / 2, -Math.PI / 2][dir];
    cars.push(makeCar(x, y, angle, { traffic: true, dir, lane, targetSpeed: range(rng, 120, 190), id: 'traffic-' + i }));
  }
  return cars;
}

// Arcade car physics: throttle, steering that scales with speed, drag.
export function driveCar(car, input, dt, world, state) {
  const up = input.down('w', 'arrowup'), down = input.down('s', 'arrowdown');
  const left = input.down('a', 'arrowleft'), right = input.down('d', 'arrowright');
  const brake = input.down(' ');
  if (up) car.speed += CFG.carAccel * dt;
  if (down) car.speed -= (car.speed > 0 ? CFG.carBrake : CFG.carReverseAccel) * dt;
  if (brake) {
    car.speed -= Math.sign(car.speed) * CFG.carBrake * 0.8 * dt;
    if (Math.abs(car.speed) < 30) car.speed = 0;
    if (Math.abs(car.speed) > 60) addSkid(state, car);
  }
  car.speed -= car.speed * CFG.carDrag * dt;
  car.speed = clamp(car.speed, -CFG.carMaxReverse, CFG.carMaxSpeed);
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const spd = Math.abs(car.speed) / CFG.carMaxSpeed;
  car.angle += steer * CFG.carTurnRate * dt * (0.35 + 0.65 * spd) * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  moveCircle(world, car, nx - car.x, ny - car.y, CFG.carRadius);
  if (Math.hypot(car.x - before.x, car.y - before.y) < Math.abs(car.speed) * dt * 0.4 && Math.abs(car.speed) > 120) {
    car.speed *= 0.55; // hit a wall
    state.audio.crash();
    state.shake = Math.min(10, Math.abs(car.speed) * 0.02);
    spawnSparks(state, car.x, car.y, 8);
  }
}

function addSkid(state, car) {
  const bx = car.x - Math.cos(car.angle) * 16, by = car.y - Math.sin(car.angle) * 16;
  state.skids.push({ x: bx, y: by, angle: car.angle, life: 5 });
  if (state.skids.length > CFG.skidCap) state.skids.shift();
}

export function spawnSparks(state, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160;
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4, max: 0.4, color: '#ffd23a', size: 3 });
  }
  if (state.particles.length > CFG.particleCap) state.particles.splice(0, state.particles.length - CFG.particleCap);
}

// Traffic follows the road grid: drive straight, turn at intersections.
export function updateTraffic(car, dt, world, rng) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const [dx, dy] = dirs[car.dir];
  car.speed = car.targetSpeed;
  car.x += dx * car.speed * dt;
  car.y += dy * car.speed * dt;
  car.angle = [0, Math.PI, Math.PI / 2, -Math.PI / 2][car.dir];
  // At an intersection, sometimes turn onto the crossing road.
  const nearX = CFG.roadsX.some((rx) => Math.abs(car.x - rx) < 6);
  const nearY = CFG.roadsY.some((ry) => Math.abs(car.y - ry) < 6);
  if ((car.dir < 2 && nearX) || (car.dir >= 2 && nearY)) {
    if (rng() < 0.012) {
      const options = car.dir < 2 ? [2, 3] : [0, 1];
      car.dir = pick(rng, options);
      if (car.dir < 2) car.y = nearestRoadY(car.y); else car.x = nearestRoadX(car.x);
    }
  }
  // Wrap around the world edges so traffic never runs out.
  if (car.x < 80) car.x = CFG.worldW - 200;
  if (car.x > CFG.worldW - 80) car.x = 200;
  if (car.y < 80) car.y = CFG.worldH - 200;
  if (car.y > CFG.worldH - 80) car.y = 200;
}

function nearestRoadX(x) {
  let best = CFG.roadsX[0];
  for (const rx of CFG.roadsX) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}
function nearestRoadY(y) {
  let best = CFG.roadsY[0];
  for (const ry of CFG.roadsY) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

// Police cars chase the player's car and ram it.
export function updatePoliceCar(car, player, dt, world) {
  const target = player.car || player;
  const dx = target.x - car.x, dy = target.y - car.y;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
  car.speed = Math.min(CFG.copCarSpeed, car.speed + 500 * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const bx = car.x, by = car.y;
  moveCircle(world, car, nx - car.x, ny - car.y, CFG.carRadius);
  if (Math.hypot(car.x - bx, car.y - by) < 2 && Math.abs(car.speed) > 60) car.speed *= 0.4;
}

export function carOverlapsCar(a, b) {
  return dist(a.x, a.y, b.x, b.y) < 34;
}

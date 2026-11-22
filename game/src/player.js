// Solmar City — the player: walking, running, stealing and driving cars,
// pistol shooting, melee, and picking up health and ammo.
import { CFG } from './config.js';
import { moveCircle, dist, clamp } from './world.js';
import { spawnSparks } from './vehicles.js';
import { damagePlayer, spawnBlood, addWanted, killPed } from './pedestrians.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, hp: CFG.playerHp, money: CFG.startMoney,
    car: null, // the car the player is driving, or null on foot
    hasPistol: false, ammo: 0, meleeCd: 0, shootCd: 0,
    walkPhase: 0, moving: false,
  };
}

// Find the nearest usable car within reach (parked or traffic, not police).
export function nearestCar(state, maxDist) {
  let best = null, bd = maxDist;
  for (const c of state.cars) {
    if (c.police) continue;
    const d = dist(state.player.x, state.player.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function updatePlayer(state, dt) {
  const p = state.player, input = state.input;
  p.meleeCd -= dt; p.shootCd -= dt;
  if (p.car) { updateDriving(state, dt); return; }
  updateOnFoot(state, dt);
  // Enter / steal a car.
  if (input.hit('e')) {
    const car = nearestCar(state, 55);
    if (car) enterCar(state, car);
  }
  // Melee.
  if (input.hit(' ') && p.meleeCd <= 0) doMelee(state);
  // Shoot toward the mouse.
  if (input.mouseClicked && p.hasPistol && p.shootCd <= 0) doShoot(state);
  // Pickups.
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    if (dist(p.x, p.y, pk.x, pk.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'health') p.hp = Math.min(CFG.playerHp, p.hp + 50);
      else { p.ammo += 12; if (!p.hasPistol) p.hasPistol = true; }
      state.audio.pickup();
      state.toast = pk.kind === 'health' ? '+50 HEALTH' : '+12 AMMO';
      state.toastT = 1.6;
    }
  }
}

function updateOnFoot(state, dt) {
  const p = state.player, input = state.input;
  let mx = (input.down('d', 'arrowright') ? 1 : 0) - (input.down('a', 'arrowleft') ? 1 : 0);
  let my = (input.down('s', 'arrowdown') ? 1 : 0) - (input.down('w', 'arrowup') ? 1 : 0);
  p.moving = mx !== 0 || my !== 0;
  if (!p.moving) return;
  const len = Math.hypot(mx, my); mx /= len; my /= len;
  const speed = input.down('shift') ? CFG.runSpeed : CFG.walkSpeed;
  p.angle = Math.atan2(my, mx);
  p.walkPhase += dt * speed * 0.05;
  moveCircle(state.world, p, mx * speed * dt, my * speed * dt, CFG.playerRadius);
}

function enterCar(state, car) {
  const p = state.player;
  p.car = car;
  car.parked = false; car.traffic = false;
  if (!car.stolen) {
    car.stolen = true;
    addWanted(state, 1, 'Grand theft auto');
    state.toast = 'Stole a ' + car.name + '!  +1 ★';
    state.toastT = 2;
  }
  state.audio.doorSlam();
  state.missions.onEnterCar(state, car);
}

export function exitCar(state) {
  const p = state.player, car = p.car;
  if (!car) return;
  p.car = null;
  car.speed *= 0.3;
  // Step out to the side of the car.
  p.x = car.x - Math.sin(car.angle) * 30;
  p.y = car.y + Math.cos(car.angle) * 30;
  p.angle = car.angle;
  state.audio.doorSlam();
}

function updateDriving(state, dt) {
  const p = state.player, car = p.car;
  const { driveCar, carOverlapsCar } = state.vehicleFns;
  driveCar(car, state.input, dt, state.world, state);
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  state.audio.setEngine(Math.abs(car.speed) / CFG.carMaxSpeed, true);
  // Running over pedestrians is a crime.
  for (const ped of state.peds) {
    if (ped.dead) continue;
    if (dist(ped.x, ped.y, car.x, car.y) < 30 && Math.abs(car.speed) > 60) {
      killPed(state, ped);
      car.speed *= 0.7;
      state.shake = 6;
    }
  }
  // Bumping police cars and traffic.
  for (const other of state.cars) {
    if (other === car || other.parked) continue;
    if (carOverlapsCar(car, other) && Math.abs(car.speed) > 150) {
      other.speed = 0;
      if (other.police) addWanted(state, 1, 'Assaulted an officer');
      car.speed *= 0.5;
      state.audio.crash();
      spawnSparks(state, (car.x + other.x) / 2, (car.y + other.y) / 2, 10);
    }
  }
  if (state.input.hit('e')) exitCar(state);
}

function doMelee(state) {
  const p = state.player;
  p.meleeCd = 0.45;
  state.audio.punch();
  state.meleeFlash = 0.18;
  const targets = [...state.enemies, ...state.cops, ...state.peds.filter((pd) => !pd.dead)];
  for (const t of targets) {
    if (t.hp <= 0) continue;
    const d = dist(p.x, p.y, t.x, t.y);
    if (d > CFG.meleeRange + 12) continue;
    const ang = Math.atan2(t.y - p.y, t.x - p.x);
    let diff = Math.abs(ang - p.angle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff > 1.2) continue;
    t.hp -= CFG.meleeDamage;
    spawnBlood(state, t.x, t.y);
    if (t.hp <= 0) onKill(state, t);
    else if (t.panic !== undefined) t.panic = 3;
  }
}

function doShoot(state) {
  const p = state.player;
  if (p.ammo <= 0) { state.toast = 'OUT OF AMMO — find ammo crates'; state.toastT = 1.5; state.audio.blip(180, 0.1, 'square', 0.1); return; }
  p.ammo--; p.shootCd = 0.22;
  state.audio.gunshot();
  state.gunshotTimer = 1.2; // nearby peds hear it and flee
  state.muzzle = 0.07;
  const wx = state.camera.x + state.input.mouseX;
  const wy = state.camera.y + state.input.mouseY;
  const aim = Math.atan2(wy - p.y, wx - p.x);
  p.angle = aim;
  state.missions.onShoot(state);
  // Hitscan: nearest living target near the aim line.
  let best = null, bestD = CFG.pistolRange;
  const targets = [...state.enemies, ...state.cops, ...state.peds.filter((pd) => !pd.dead)];
  for (const t of targets) {
    const d = dist(p.x, p.y, t.x, t.y);
    if (d > CFG.pistolRange) continue;
    const ang = Math.atan2(t.y - p.y, t.x - p.x);
    let diff = Math.abs(ang - aim);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    const lateral = d * Math.sin(diff);
    if (Math.abs(lateral) < 16 && d < bestD) { best = t; bestD = d; }
  }
  const endX = best ? best.x : p.x + Math.cos(aim) * CFG.pistolRange;
  const endY = best ? best.y : p.y + Math.sin(aim) * CFG.pistolRange;
  state.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.06, max: 0.06, color: '#ffe9a8', size: 2, tracer: { x2: endX, y2: endY } });
  if (best) {
    best.hp -= CFG.pistolDamage;
    spawnBlood(state, best.x, best.y);
    if (best.hp <= 0) onKill(state, best);
    else if (best.panic !== undefined) best.panic = 3;
  }
  if (state.wanted < 1) addWanted(state, 1, 'Shots fired');
}

function onKill(state, t) {
  if (state.enemies.includes(t)) {
    t.dead = true;
    state.missions.onEnemyKilled(state, t);
  } else if (state.cops.includes(t)) {
    t.dead = true;
    addWanted(state, 2, 'Officer down');
    state.missions.onCopKilled(state);
  } else {
    killPed(state, t);
  }
}

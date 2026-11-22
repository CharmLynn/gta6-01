// Solmar City — boot, game loop and the state machine:
// menu / playing / paused / busted / wasted / victory, plus wanted decay,
// police spawning, camera, respawn and autosave.
import { CFG } from './config.js';
import { makeRng } from './random.js';
import { generateCity, PLACES, dist, clamp } from './world.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { makePlayer, updatePlayer, exitCar } from './player.js';
import { makeCar, spawnParkedCars, spawnTraffic, updateTraffic, updatePoliceCar, driveCar, carOverlapsCar } from './vehicles.js';
import { spawnPeds, updatePed, updateEnemy, updateCop, makeCop } from './pedestrians.js';
import { Missions } from './missions.js';
import { drawWorld, drawHUD, drawMenu, drawPaused, drawHelp, drawBusted, drawWasted, drawVictory } from './render.js';
import { saveGame, loadSave } from './save.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
fitCanvas();
addEventListener('resize', fitCanvas);

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || 20261122;
const shotMode = params.get('shot');

const state = {
  mode: 'menu',
  time: 0, runStart: 0,
  seed,
  rng: makeRng(seed),
  world: generateCity(seed),
  player: makePlayer(PLACES.playerStart.x, PLACES.playerStart.y),
  cars: [], peds: [], cops: [], enemies: [],
  pickups: [], particles: [], skids: [],
  wanted: 0, lastCrimeAt: -999, wantedTimer: 0,
  camera: { x: 0, y: 0 },
  shake: 0, shakeX: 0, shakeY: 0,
  gunshotTimer: 0, muzzle: 0, meleeFlash: 0,
  toast: '', toastT: 0, crimeFlash: '', crimeFlashT: 0,
  busted: false, wasted: false,
  missions: new Missions(),
  audio: new AudioSys(),
  input: new Input(canvas),
  vehicleFns: { driveCar, carOverlapsCar },
  menuSel: 0, helpOpen: false,
  saveData: loadSave(), saveDirty: false, saveTimer: 0,
  victoryStats: null,
  shot: shotMode,
};

function resetWorld(freshSeed) {
  state.seed = freshSeed;
  state.rng = makeRng(freshSeed);
  state.world = generateCity(freshSeed);
  state.cars = [...spawnParkedCars(state.world, state.rng, 16), ...spawnTraffic(state.world, state.rng, CFG.trafficCount)];
  state.peds = spawnPeds(state.rng, CFG.pedCount);
  state.cops = []; state.enemies = []; state.particles = []; state.skids = [];
  state.pickups = [
    { x: PLACES.hospital.x + 60, y: PLACES.hospital.y, kind: 'health', taken: false },
    { x: PLACES.garage.x - 60, y: PLACES.garage.y + 40, kind: 'ammo', taken: false },
    { x: PLACES.industrial.x + 140, y: PLACES.industrial.y - 60, kind: 'ammo', taken: false },
    { x: PLACES.bank.x + 120, y: PLACES.bank.y - 80, kind: 'health', taken: false },
    { x: PLACES.port.x + 80, y: PLACES.port.y - 60, kind: 'ammo', taken: false },
  ];
}

function newGame() {
  resetWorld(state.seed);
  state.player = makePlayer(PLACES.playerStart.x, PLACES.playerStart.y);
  state.missions = new Missions();
  state.wanted = 0; state.lastCrimeAt = -999;
  state.time = 0; state.runStart = 0;
  state.busted = false; state.wasted = false;
  state.mode = 'playing';
  state.missions.start(state);
  saveGame(state);
}

function continueGame() {
  const s = state.saveData;
  if (!s) return;
  resetWorld(s.seed || state.seed);
  state.player = makePlayer(s.x, s.y);
  state.player.money = s.money;
  state.player.hp = s.hp ?? CFG.playerHp;
  state.player.ammo = s.ammo ?? 0;
  state.player.hasPistol = !!s.hasPistol;
  state.missions = new Missions();
  state.missions.index = Math.min(s.missionIndex, 5);
  state.wanted = 0;
  state.time = 0; state.runStart = 0;
  state.mode = 'playing';
  state.missions.start(state);
}

function respawn(after) {
  const p = state.player;
  if (p.car) exitCar(state);
  p.money = Math.floor(p.money * (1 - CFG.bustWastePenalty));
  p.hp = CFG.playerHp;
  p.x = after === 'wasted' ? PLACES.hospital.x : PLACES.policeStation.x;
  p.y = after === 'wasted' ? PLACES.hospital.y : PLACES.policeStation.y;
  p.angle = -Math.PI / 2;
  state.wanted = 0; state.lastCrimeAt = -999;
  state.cops = [];
  state.cars = state.cars.filter((c) => !c.police);
  state.busted = false; state.wasted = false;
  state.mode = 'playing';
  state.missions.restart(state);
  saveGame(state);
}

// --- Wanted decay and police spawning --------------------------------------
function updateWanted(dt) {
  if (state.wanted === 0) return;
  const quiet = state.time - state.lastCrimeAt > CFG.wantedDecayDelay;
  const copNear = state.cops.some((c) => !c.dead && dist(c.x, c.y, state.player.x, state.player.y) < 300);
  if (quiet && !copNear) {
    state.wantedTimer += dt;
    if (state.wantedTimer >= CFG.wantedDecayStep) {
      state.wantedTimer = 0;
      state.wanted--;
      state.toast = state.wanted === 0 ? 'You lost them. The heat is off.' : 'Heat cooling down… ' + state.wanted + ' ★ left';
      state.toastT = 2;
    }
  } else state.wantedTimer = 0;
  // Foot cops: one per star, up to 3.
  const wantCops = Math.min(state.wanted, 3);
  const liveCops = state.cops.filter((c) => !c.dead).length;
  if (liveCops < wantCops) {
    const spot = randomSpawnNear(state.player, 380);
    state.cops.push(makeCop(spot.x, spot.y, state.cops.length));
  }
  if (state.wanted === 0) {
    // Cops give up once the heat is off.
    state.cops = [];
  } else {
    // Foot cops lose you if you get far away — outrun them to cool off.
    state.cops = state.cops.filter((c) => !c.dead && dist(c.x, c.y, state.player.x, state.player.y) < 650);
  }
  // Police cars: from 2 stars up.
  const wantCars = state.wanted >= 2 ? Math.min(state.wanted - 1, 2) : 0;
  const liveCars = state.cars.filter((c) => c.police).length;
  if (liveCars < wantCars) {
    const spot = randomSpawnNear(state.player, 520);
    const car = makeCar(spot.x, spot.y, 0, { police: true, id: 'police-' + state.cars.length });
    state.cars.push(car);
  }
  // Police cars give up if you outrun them far enough.
  state.cars = state.cars.filter((c) => !c.police || dist(c.x, c.y, state.player.x, state.player.y) < 1000);
  state.audio.setSiren(state.wanted > 0);
}

function randomSpawnNear(player, radius) {
  const a = state.rng() * Math.PI * 2;
  const x = clamp(player.x + Math.cos(a) * radius, 120, CFG.worldW - 300);
  const y = clamp(player.y + Math.sin(a) * radius, 120, CFG.worldH - 120);
  return { x, y };
}

// --- Per-frame update --------------------------------------------------------
function update(dt) {
  state.time += dt;
  state.gunshotTimer = Math.max(0, state.gunshotTimer - dt);
  state.muzzle = Math.max(0, state.muzzle - dt);
  state.meleeFlash = Math.max(0, state.meleeFlash - dt);
  state.toastT = Math.max(0, state.toastT - dt);
  state.crimeFlashT = Math.max(0, state.crimeFlashT - dt);
  for (const pt of state.particles) { pt.life -= dt; pt.x += (pt.vx || 0) * dt; pt.y += (pt.vy || 0) * dt; }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const s of state.skids) s.life -= dt;
  state.skids = state.skids.filter((s) => s.life > 0);
  state.shake = Math.max(0, state.shake - dt * 22);
  state.shakeX = (Math.random() - 0.5) * state.shake;
  state.shakeY = (Math.random() - 0.5) * state.shake;

  if (state.mode !== 'playing') return;

  updatePlayer(state, dt);
  for (const c of state.cars) {
    if (c.police) updatePoliceCar(c, state.player, dt, state.world);
    else if (c.traffic) updateTraffic(c, dt, state.world, state.rng);
  }
  // Police cars ramming the player's car.
  const pc = state.player.car;
  if (pc) {
    for (const c of state.cars) {
      if (!c.police) continue;
      if (dist(c.x, c.y, pc.x, pc.y) < 36 && Math.abs(c.speed) > 120) {
        pc.speed *= 0.75; c.speed *= 0.5;
        state.shake = 7; state.audio.crash();
      }
    }
    if (pc.hp <= 0) { exitCar(state); state.toast = 'Your car is wrecked!'; state.toastT = 2; }
  }
  for (const p of state.peds) if (!p.dead) updatePed(p, dt, state.world, state);
  state.peds = state.peds.filter((p) => !p.dead || state.time % 2 < 1);
  for (const e of state.enemies) if (!e.dead && !e.inCar) updateEnemy(e, dt, state);
  state.missions.updateChasers(state, dt);
  for (const c of state.cops) if (!c.dead) updateCop(c, dt, state);
  state.cops = state.cops.filter((c) => !c.dead);
  state.missions.update(state, dt);
  updateWanted(dt);

  // Camera follows the player.
  const tx = clamp(state.player.x - canvas.width / 2, 0, Math.max(0, CFG.worldW - canvas.width));
  const ty = clamp(state.player.y - canvas.height / 2, 0, Math.max(0, CFG.worldH - canvas.height));
  state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 5);

  if (state.busted) { state.mode = 'busted'; state.audio.busted(); state.audio.setEngine(0, false); }
  if (state.wasted) { state.mode = 'wasted'; state.audio.busted(); state.audio.setEngine(0, false); }

  // Autosave while playing.
  state.saveTimer += dt;
  if (state.saveDirty && state.saveTimer > 1) { saveGame(state); state.saveTimer = 0; }
  if (!state.player.car) state.audio.setEngine(0, false);
}

// Fixed-step driver used by the deterministic screenshot scenes.
state.stepFixed = function stepFixed(dt, scripted) {
  const real = state.input;
  state.input = {
    down: (...names) => !!scripted && names.some((n) => scripted[n] || (n === 'w' && scripted.up)),
    hit: () => false,
    mouseClicked: false, mouseX: canvas.width / 2, mouseY: canvas.height / 2,
  };
  update(dt);
  state.input = real;
};

// --- Menu / key handling ------------------------------------------------------
function handleMenuKeys() {
  const input = state.input;
  if (input.hit('enter')) {
    state.audio.ensure();
    if (state.menuSel === 1 && state.saveData) continueGame();
    else newGame();
    return;
  }
  if (input.hit('arrowup', 'arrowdown', 'w', 's')) {
    state.menuSel = state.menuSel === 0 ? 1 : 0;
    if (state.menuSel === 1 && !state.saveData) state.menuSel = 0;
  }
  if (input.mouseClicked) {
    const W = canvas.width;
    if (input.mouseX > W / 2 - 140 && input.mouseX < W / 2 + 140) {
      if (input.mouseY > 330 && input.mouseY < 382) { state.audio.ensure(); newGame(); }
      if (state.saveData && input.mouseY > 396 && input.mouseY < 448) { state.audio.ensure(); continueGame(); }
    }
  }
}

function handleGlobalKeys() {
  const input = state.input;
  if (input.hit('m')) { const muted = state.audio.toggleMute(); state.toast = muted ? 'Muted' : 'Sound on'; state.toastT = 1.2; }
  if (input.hit('h')) state.helpOpen = !state.helpOpen;
  if (input.hit('p', 'escape')) {
    if (state.mode === 'playing') { state.mode = 'paused'; state.audio.setEngine(0, false); }
    else if (state.mode === 'paused') state.mode = 'playing';
  }
  if (state.mode === 'paused') {
    if (input.hit('r')) newGame();
    if (input.hit('q')) { state.mode = 'menu'; state.menuSel = 0; }
  }
  if (state.mode === 'busted' && input.hit('enter')) respawn('busted');
  if (state.mode === 'wasted' && input.hit('enter')) respawn('wasted');
  if (state.mode === 'victory' && input.hit('enter')) {
    state.mode = 'playing';
    state.missions.objective = 'Free roam — Solmar City is yours, Leo';
    state.missions.marker = null;
  }
  if (input.mouseClicked || input.keys.size) state.audio.ensure();
}

// --- Render + loop -------------------------------------------------------------
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.mode === 'menu') { drawMenu(ctx, state); return; }
  drawWorld(ctx, state);
  if (state.mode === 'playing' || state.mode === 'paused') drawHUD(ctx, state);
  if (state.helpOpen && (state.mode === 'playing' || state.mode === 'paused')) drawHelp(ctx);
  else if (state.mode === 'paused') drawPaused(ctx, state);
  else if (state.mode === 'busted') drawBusted(ctx, state);
  else if (state.mode === 'wasted') drawWasted(ctx, state);
  else if (state.mode === 'victory') drawVictory(ctx, state);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.mode === 'menu') handleMenuKeys();
  else handleGlobalKeys();
  // In a screenshot scene (?shot=…) the staged state is frozen: the setup
  // already advanced the scene a fixed number of steps, so the frame the
  // headless browser captures is exactly the staged one.
  if (state.mode !== 'paused' && !state.shot) update(dt);
  render();
  state.input.endFrame();
  requestAnimationFrame(loop);
}

// Boot: a fresh world for the menu backdrop, then the shot scene if asked.
// ?debug=1 exposes the state for automated play-testing only.
if (params.get('debug')) window.__solmar = state;
resetWorld(seed);
if (shotMode) {
  // Show Continue on the title screenshot so both options are visible.
  if (shotMode === 'start') state.saveData = state.saveData || { money: 940, missionIndex: 2, x: 950, y: 1330 };
  setupShot(state, shotMode);
  state.camera.x = clamp(state.player.x - canvas.width / 2, 0, Math.max(0, CFG.worldW - canvas.width));
  state.camera.y = clamp(state.player.y - canvas.height / 2, 0, Math.max(0, CFG.worldH - canvas.height));
} else {
  state.player.x = PLACES.playerStart.x;
  state.player.y = PLACES.playerStart.y;
}
requestAnimationFrame(loop);

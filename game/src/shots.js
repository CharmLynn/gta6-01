// Solmar City — deterministic screenshot scenes for ?shot=…&seed=1.
// Each scene sets the game to a fixed, reproducible state and advances it
// a few scripted seconds so a headless screenshot needs no input.
import { CFG } from './config.js';
import { PLACES } from './world.js';
import { makeCar } from './vehicles.js';
import { makeCop, makeEnemy } from './pedestrians.js';

function placePlayerInCar(state, x, y, angle, speed) {
  const car = makeCar(x, y, angle, { color: '#d94f3d', id: 'shot-car' });
  car.speed = speed;
  state.cars.push(car);
  state.player.car = car;
  state.player.x = x; state.player.y = y; state.player.angle = angle;
}

export function setupShot(state, mode) {
  const P = PLACES;
  if (mode === 'start') {
    state.mode = 'menu';
    state.menuSel = 0;
    return;
  }
  if (mode === 'end') {
    state.mode = 'victory';
    state.victoryStats = { time: 1423, money: 6840, missions: 6 };
    state.missions.index = 6;
    return;
  }
  state.mode = 'playing';
  if (mode === 'drive') {
    // A 3-star chase through downtown: Leo in a stolen car, two police
    // cars on his tail, mission 6 on the HUD.
    state.missions.index = 5;
    state.missions.start(state);
    state.missions.stage = 2;
    state.missions.marker = { ...P.hideout };
    state.missions.objective = 'Got the cash! Lose 3 stars and reach the Hideout';
    state.missions.card = null;
    state.wanted = 3;
    state.player.money = 6420;
    placePlayerInCar(state, 1800, 1200, 0, 380);
    const cop1 = makeCar(1620, 1200, 0, { police: true, id: 'shot-cop-1' });
    cop1.speed = 340;
    const cop2 = makeCar(1560, 1290, 0.3, { police: true, id: 'shot-cop-2' });
    cop2.speed = 300;
    state.cars.push(cop1, cop2);
    state.cops.push(makeCop(1700, 1330, 0));
    // Scripted seconds: the car rolls forward, cops close in.
    for (let i = 0; i < 150; i++) state.stepFixed(1 / 60, { up: true });
    state.missions.card = null;
    state.wanted = 3;
    return;
  }
  if (mode === 'mission') {
    // Mission 5 mid-fight: Leo on foot with the pistol, Sharks in the yard.
    state.missions.index = 4;
    state.missions.start(state);
    state.missions.stage = 1;
    state.missions.objective = 'Take out the Sharks — 4 left';
    state.missions.card = null;
    state.player.x = P.industrial.x - 180;
    state.player.y = P.industrial.y + 40;
    state.player.angle = 0.2;
    state.player.hasPistol = true;
    state.player.ammo = 18;
    state.player.hp = 82;
    state.player.money = 940;
    state.wanted = 1;
    state.cops.push(makeCop(P.industrial.x - 520, P.industrial.y + 320, 0));
    for (let i = 0; i < 45; i++) state.stepFixed(1 / 60, {});
    state.missions.card = null;
    return;
  }
}

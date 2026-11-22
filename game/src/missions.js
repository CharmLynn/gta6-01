// Solmar City — the story: six missions in order, each with a marker,
// an objective line, stages, and its reward. Completing mission 6 wins.
import { CFG } from './config.js';
import { PLACES, dist } from './world.js';
import { makeEnemy, addWanted } from './pedestrians.js';
import { makeCar } from './vehicles.js';

export const MISSION_DEFS = [
  { id: 1, name: 'Wheels', giver: 'Mama Rosa', brief: 'Leo, I need wheels. Steal any car and bring it to my garage.', reward: 80 },
  { id: 2, name: 'Fare Play', giver: 'Mama Rosa', brief: 'A fare is waiting at the Marina. Drive them to the Downtown Hotel — fast, they tip for speed.', reward: 150 },
  { id: 3, name: 'Hot Wheels', giver: 'Mama Rosa', brief: 'The Sharks are watching. Get the cops on you — 2 stars — then lose them. Hide till it cools off.', reward: 120 },
  { id: 4, name: 'Special Delivery', giver: 'Mama Rosa', brief: 'A package for the Port. The Sharks will try to stop you. Do not stop.', reward: 250 },
  { id: 5, name: 'Shark Hunt', giver: 'Mama Rosa', brief: 'Four Sharks are muscling in on the Industrial Yard. Take them out. Take this pistol.', reward: 300 },
  { id: 6, name: 'The Big Score', giver: 'Mama Rosa', brief: 'Solmar Bank. In, out, rich. Then lose the heat and get to the hideout.', reward: 5000 },
];

export class Missions {
  constructor() {
    this.index = 0; // 0-based, 6 means all done
    this.stage = 0;
    this.timer = 0;
    this.marker = null; // {x, y, label}
    this.objective = '';
    this.card = null; // {title, text, t}
    this.hadTwoStars = false;
    this.robProgress = 0;
    this.chasers = [];
    this.started = false;
  }

  get current() { return MISSION_DEFS[this.index] || null; }
  get done() { return this.index >= MISSION_DEFS.length; }

  showCard(state, title, text) {
    this.card = { title, text, t: 4 };
    state.audio.missionStart();
  }

  start(state) {
    const m = this.current;
    if (!m) return;
    this.started = true;
    this.stage = 0; this.timer = 0; this.robProgress = 0;
    this.hadTwoStars = false;
    this.chasers = [];
    const P = PLACES;
    if (m.id === 1) {
      this.marker = { ...P.garage };
      this.objective = 'Steal any car and drive it to Mama Rosa\'s garage';
    } else if (m.id === 2) {
      this.marker = { ...P.marina };
      this.objective = 'Pick up the fare at the Marina (in a car)';
    } else if (m.id === 3) {
      this.marker = null;
      this.objective = 'Raise your wanted level to 2 stars, then lose the heat';
    } else if (m.id === 4) {
      this.marker = { ...P.garage };
      this.objective = 'Pick up the package at the garage';
    } else if (m.id === 5) {
      this.marker = { ...P.industrial };
      this.objective = 'Go to the Industrial Yard — the Sharks are waiting';
      state.player.hasPistol = true;
      state.player.ammo = Math.max(state.player.ammo, CFG.pistolAmmoStart);
      state.enemies = [
        makeEnemy(P.industrial.x - 60, P.industrial.y - 40, 0),
        makeEnemy(P.industrial.x + 70, P.industrial.y - 20, 1),
        makeEnemy(P.industrial.x - 20, P.industrial.y + 70, 2),
        makeEnemy(P.industrial.x + 90, P.industrial.y + 60, 3),
      ];
    } else if (m.id === 6) {
      this.marker = { ...P.bank };
      this.objective = 'Go to Solmar Bank and hold the vault';
    }
    this.showCard(state, 'MISSION ' + m.id + ' — ' + m.name, m.brief);
    state.saveDirty = true;
  }

  // Called when the current mission is (re)started after busted/wasted.
  restart(state) {
    state.enemies = [];
    for (const c of this.chasers) c.dead = true;
    this.chasers = [];
    this.start(state);
  }

  complete(state) {
    const m = this.current;
    state.player.money += m.reward;
    this.showCard(state, 'MISSION COMPLETE — ' + m.name, 'Reward: $' + m.reward + '   •   ' + (this.index + 1) + ' of 6 done');
    state.audio.missionDone();
    this.index++;
    this.marker = null;
    this.objective = '';
    this.started = false;
    state.saveDirty = true;
    if (this.done) {
      state.mode = 'victory';
      state.victoryStats = {
        time: Math.round(state.time - state.runStart),
        money: state.player.money,
        missions: 6,
      };
      return;
    }
    this.start(state);
  }

  update(state, dt) {
    if (this.done || !this.current) return;
    if (this.card) { this.card.t -= dt; if (this.card.t <= 0) this.card = null; }
    const m = this.current, p = state.player, P = PLACES;
    const near = (place, r) => dist(p.x, p.y, place.x, place.y) < r;

    if (m.id === 1) {
      if (p.car && near(P.garage, 90)) this.complete(state);
    } else if (m.id === 2) {
      if (this.stage === 0) {
        if (p.car && near(P.marina, 80)) {
          this.stage = 1; this.timer = CFG.taxiTimeLimit;
          this.marker = { ...P.hotel };
          this.objective = 'Drive the fare to the Downtown Hotel — ' + Math.ceil(this.timer) + 's left';
          state.toast = 'Passenger aboard! Drive fast.'; state.toastT = 2;
          state.audio.pickup();
        }
      } else {
        this.timer -= dt;
        this.objective = 'Drive the fare to the Downtown Hotel — ' + Math.max(0, Math.ceil(this.timer)) + 's left';
        if (this.timer <= 0) {
          state.toast = 'Too slow — the fare walked off. Try again.'; state.toastT = 2.5;
          this.stage = 0; this.marker = { ...P.marina };
          this.objective = 'Pick up the fare at the Marina (in a car)';
        } else if (p.car && near(P.hotel, 90)) {
          state.toast = 'Fare delivered! Tip included.'; state.toastT = 2;
          this.complete(state);
        }
      }
    } else if (m.id === 3) {
      if (state.wanted >= 2) this.hadTwoStars = true;
      if (this.hadTwoStars && state.wanted === 0) this.complete(state);
      else if (this.hadTwoStars) this.objective = 'Now lose them — stay out of sight till the stars fade';
      else this.objective = 'Raise your wanted level to 2 stars (steal cars, hit peds, fire shots)';
    } else if (m.id === 4) {
      if (this.stage === 0) {
        if (near(P.garage, 80)) {
          this.stage = 1; this.marker = { ...P.port };
          this.objective = 'Deliver the package to the Port — Sharks incoming!';
          state.toast = 'Package secured. GO!'; state.toastT = 2;
          this.spawnChasers(state);
        }
      } else if (near(P.port, 90)) {
        this.complete(state);
      }
    } else if (m.id === 5) {
      const alive = state.enemies.filter((e) => !e.dead);
      if (this.stage === 0) {
        if (near(P.industrial, 260)) { this.stage = 1; this.objective = 'Take out the Sharks — ' + alive.length + ' left'; }
      } else {
        this.objective = 'Take out the Sharks — ' + alive.length + ' left';
        if (alive.length === 0) this.complete(state);
      }
    } else if (m.id === 6) {
      if (this.stage === 0) {
        if (near(P.bank, 90)) { this.stage = 1; this.objective = 'Hold the vault — stay inside the marker'; }
      } else if (this.stage === 1) {
        if (near(P.bank, 90)) {
          this.robProgress += dt;
          this.objective = 'Cracking the vault… ' + Math.ceil(CFG.bankRobTime - this.robProgress) + 's';
          if (this.robProgress >= CFG.bankRobTime) {
            this.stage = 2; this.marker = { ...P.hideout };
            this.objective = 'Got the cash! Lose 3 stars and reach the Hideout';
            addWanted(state, 3, 'Bank robbery');
            state.toast = '$5,000! Run!'; state.toastT = 2.5;
          }
        } else {
          this.robProgress = Math.max(0, this.robProgress - dt * 2);
          this.objective = 'Go to Solmar Bank and hold the vault';
        }
      } else if (near(P.hideout, 100) && state.wanted === 0) {
        this.complete(state);
      } else if (near(P.hideout, 100)) {
        this.objective = 'Too hot — lose the stars first, then reach the Hideout';
      }
    }
  }

  spawnChasers(state) {
    const p = state.player;
    for (let i = 0; i < 2; i++) {
      const car = makeCar(p.x + (i === 0 ? -260 : 260), p.y + 120, 0, { color: '#22262e', id: 'shark-car-' + i });
      car.traffic = false; car.chaser = true; car.speed = 0;
      state.cars.push(car);
      const rider = makeEnemy(car.x, car.y, 100 + i);
      rider.inCar = car;
      this.chasers.push(rider);
      state.enemies.push(rider);
    }
  }

  // Chaser riders shoot from their cars while the delivery runs.
  updateChasers(state, dt) {
    if (this.current?.id !== 4 || this.stage !== 1) return;
    const p = state.player;
    for (const e of this.chasers) {
      if (e.dead || !e.inCar) continue;
      const car = e.inCar;
      // Chase the player's car.
      const dx = p.x - car.x, dy = p.y - car.y;
      const want = Math.atan2(dy, dx);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      car.speed = Math.min(430, car.speed + 420 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      e.x = car.x; e.y = car.y;
      e.shootCd -= dt;
      const d = dist(car.x, car.y, p.x, p.y);
      if (e.shootCd <= 0 && d < 480) {
        e.shootCd = 1.4;
        state.audio.enemyShot();
        if (Math.random() < 0.3 && p.car) { p.car.hp -= 8; state.shake = 4; }
        else if (Math.random() < 0.2) { /* near miss sparks */ }
      }
      if (d > 1400) { car.x = p.x - 500; car.y = p.y - 300; car.speed = 200; } // catch up
    }
  }

  onEnterCar(state, car) { /* mission 1/2 check their own proximity each frame */ }
  onShoot(state) { /* wanted is raised by the shooter */ }
  onEnemyKilled(state, t) {
    if (this.chasers.includes(t)) { if (t.inCar) { t.inCar.chaser = false; t.inCar.traffic = false; t.inCar.parked = true; } }
  }
  onCopKilled(state) { /* wanted rises in player.js */ }
}

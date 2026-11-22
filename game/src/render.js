// Solmar City — all drawing: the city, entities, effects, HUD, minimap
// and every menu screen. Canvas 2D, sun-soaked flat colours.
import { CFG } from './config.js';
import { dist, clamp } from './world.js';

export function drawWorld(ctx, state) {
  const cam = state.camera;
  ctx.save();
  ctx.translate(-cam.x + (state.shakeX || 0), -cam.y + (state.shakeY || 0));
  drawGround(ctx, state);
  drawSkids(ctx, state);
  drawPickups(ctx, state);
  drawMarker(ctx, state);
  drawContainers(ctx, state);
  drawBuildings(ctx, state);
  drawTrees(ctx, state);
  drawCars(ctx, state);
  drawPeds(ctx, state);
  drawEnemies(ctx, state);
  drawCops(ctx, state);
  drawPlayer(ctx, state);
  drawParticles(ctx, state);
  ctx.restore();
}

function visible(ctx, cam, x, y, m) {
  return x > cam.x - m && x < cam.x + ctx.canvas.width + m && y > cam.y - m && y < cam.y + ctx.canvas.height + m;
}

function drawGround(ctx, state) {
  const w = state.world;
  // Grass base.
  ctx.fillStyle = '#8fc06a';
  ctx.fillRect(state.camera.x - 20, state.camera.y - 20, ctx.canvas.width + 40, ctx.canvas.height + 40);
  // Beach and sea (east edge).
  ctx.fillStyle = '#f2dd9e';
  ctx.fillRect(CFG.beachX, 0, CFG.seaX - CFG.beachX, CFG.worldH);
  ctx.fillStyle = '#2f9fd8';
  ctx.fillRect(CFG.seaX, 0, CFG.worldW - CFG.seaX, CFG.worldH);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let y = 60; y < CFG.worldH; y += 180) {
    ctx.fillRect(CFG.seaX + 6, y, 26, 5);
    ctx.fillRect(CFG.seaX + 40, y + 90, 20, 4);
  }
  // Park and port ground.
  for (const z of w.zones) {
    if (z.zone === 'park') { ctx.fillStyle = '#6fae4e'; ctx.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0); }
    if (z.zone === 'port') { ctx.fillStyle = '#9a938a'; ctx.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0); }
    if (z.zone === 'industrial') { ctx.fillStyle = '#8d8578'; ctx.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0); }
  }
  // Roads.
  ctx.fillStyle = '#3d3f45';
  for (const rx of CFG.roadsX) ctx.fillRect(rx - CFG.roadW / 2, 0, CFG.roadW, CFG.worldH);
  for (const ry of CFG.roadsY) ctx.fillRect(0, ry - CFG.roadW / 2, CFG.worldW, CFG.roadW);
  // Lane dashes.
  ctx.fillStyle = '#e8d44f';
  for (const rx of CFG.roadsX) for (let y = 20; y < CFG.worldH; y += 64) ctx.fillRect(rx - 2, y, 4, 30);
  for (const ry of CFG.roadsY) for (let x = 20; x < CFG.worldW; x += 64) ctx.fillRect(x, ry - 2, 30, 4);
  // Sidewalk edges.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (const rx of CFG.roadsX) {
    ctx.beginPath(); ctx.moveTo(rx - CFG.roadW / 2, 0); ctx.lineTo(rx - CFG.roadW / 2, CFG.worldH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx + CFG.roadW / 2, 0); ctx.lineTo(rx + CFG.roadW / 2, CFG.worldH); ctx.stroke();
  }
}

function drawSkids(ctx, state) {
  ctx.strokeStyle = 'rgba(20,20,20,0.45)';
  ctx.lineWidth = 5;
  for (const s of state.skids) {
    ctx.globalAlpha = Math.min(1, s.life / 2);
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 10, s.y - Math.sin(s.angle) * 10);
    ctx.lineTo(s.x + Math.cos(s.angle) * 10, s.y + Math.sin(s.angle) * 10);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPickups(ctx, state) {
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(state.time * 3 + pk.x) * 3;
    ctx.fillStyle = pk.kind === 'health' ? '#fff' : '#ffd23a';
    ctx.strokeStyle = pk.kind === 'health' ? '#e83a3a' : '#8a6d00';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pk.kind === 'health' ? '#e83a3a' : '#8a6d00';
    ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'health' ? '+' : 'A', pk.x, pk.y + bob + 0.5);
  }
}

function drawMarker(ctx, state) {
  const m = state.missions.marker;
  if (!m || state.mode !== 'playing') return;
  const pulse = 1 + Math.sin(state.time * 4) * 0.15;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,58,0.18)';
  ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.fill();
  // Beacon pillar.
  ctx.fillStyle = 'rgba(255,210,58,0.10)';
  ctx.fillRect(-14, -220, 28, 220);
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(m.label, 0, -52);
  ctx.restore();
}

function drawContainers(ctx, state) {
  for (const c of state.world.containers) {
    if (!visible(ctx, state.camera, c.x, c.y, 80)) continue;
    ctx.save();
    ctx.translate(c.x + (c.angle === 0 ? c.w / 2 : c.h / 2), c.y + (c.angle === 0 ? c.h / 2 : c.w / 2));
    ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-c.w / 2 + 4, -c.h / 2 + 5, c.w, c.h);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 12, -c.h / 2); ctx.lineTo(i * 12, c.h / 2); ctx.stroke(); }
    ctx.restore();
  }
}

function drawBuildings(ctx, state) {
  for (const b of state.world.buildings) {
    if (!visible(ctx, state.camera, b.x, b.y, 200)) continue;
    const h = b.height * 7;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + h * 0.5, b.y + h * 0.5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof detail: lighter inner slab + windows for tall blocks.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    if (b.height >= 3) {
      ctx.fillStyle = 'rgba(30,40,60,0.5)';
      for (let wx = b.x + 12; wx < b.x + b.w - 14; wx += 22)
        for (let wy = b.y + 12; wy < b.y + b.h - 14; wy += 22) ctx.fillRect(wx, wy, 10, 12);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
}

function drawTrees(ctx, state) {
  for (const t of state.world.trees) {
    if (!visible(ctx, state.camera, t.x, t.y, 40)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f8f3a';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5cb85c';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCarBody(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(3, 4, 24, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = car.police ? '#f2f2f2' : car.color;
  roundRect(ctx, -22, -11, 44, 22, 6); ctx.fill();
  if (car.police) {
    ctx.fillStyle = '#1a4fd6'; ctx.fillRect(-6, -11, 12, 22);
    ctx.fillStyle = '#e83a3a'; ctx.fillRect(-14, -4, 5, 8);
    ctx.fillStyle = '#2f7de8'; ctx.fillRect(9, -4, 5, 8);
  }
  ctx.fillStyle = 'rgba(20,30,50,0.75)';
  roundRect(ctx, -8, -9, 15, 18, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(14, -9, 3, 18);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-18, -12, 6, 4); ctx.fillRect(-18, 8, 6, 4);
  ctx.fillRect(12, -12, 6, 4); ctx.fillRect(12, 8, 6, 4);
  ctx.restore();
}

function drawCars(ctx, state) {
  for (const c of state.cars) {
    if (c.parked && !visible(ctx, state.camera, c.x, c.y, 60)) continue;
    if (!visible(ctx, state.camera, c.x, c.y, 60)) continue;
    drawCarBody(ctx, c);
    if (c.taxi) {
      ctx.fillStyle = '#ffd23a';
      ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('TAXI', c.x, c.y - 18);
    }
  }
}

function drawPerson(ctx, x, y, angle, shirt, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(2, 3, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(angle);
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(4, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  if (opts.hat) { ctx.fillStyle = opts.hat; ctx.beginPath(); ctx.arc(4, 0, 6.5, Math.PI, Math.PI * 2); ctx.fill(); }
  if (opts.gun) {
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(18, 0); ctx.stroke();
  }
  ctx.restore();
  if (opts.hp != null && opts.hp < 100) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 14, y - 24, 28, 5);
    ctx.fillStyle = '#e83a3a'; ctx.fillRect(x - 14, y - 24, 28 * Math.max(0, opts.hp) / 100, 5);
  }
}

function drawPeds(ctx, state) {
  for (const p of state.peds) {
    if (p.dead || !visible(ctx, state.camera, p.x, p.y, 40)) continue;
    const bob = p.state === 'flee' ? Math.sin(state.time * 14) * 2 : Math.sin(state.time * 6 + p.x) * 1;
    drawPerson(ctx, p.x, p.y + bob, p.angle, p.shirt);
  }
}

function drawEnemies(ctx, state) {
  for (const e of state.enemies) {
    if (e.dead || !visible(ctx, state.camera, e.x, e.y, 40)) continue;
    drawPerson(ctx, e.x, e.y, e.angle, e.shirt, { gun: true, hp: e.hp });
    ctx.fillStyle = '#e83a3a';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('SHARK', e.x, e.y - 30);
  }
}

function drawCops(ctx, state) {
  for (const c of state.cops) {
    if (c.dead || !visible(ctx, state.camera, c.x, c.y, 40)) continue;
    drawPerson(ctx, c.x, c.y, c.angle, '#1a4fd6', { hat: '#0d2a6b', gun: true, hp: c.hp });
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.car) return; // drawn as the car itself
  const bob = p.moving ? Math.sin(p.walkPhase) * 2 : 0;
  drawPerson(ctx, p.x, p.y + bob, p.angle, '#e8a33a', { gun: p.hasPistol });
  // Muzzle flash.
  if (state.muzzle > 0) {
    ctx.fillStyle = 'rgba(255,220,120,0.9)';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.meleeFlash > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 34, p.angle - 0.9, p.angle + 0.9); ctx.stroke();
  }
  // Direction tick so the player reads at a glance.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.angle) * 12, p.y + Math.sin(p.angle) * 12);
  ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
  ctx.stroke();
}

function drawParticles(ctx, state) {
  for (const pt of state.particles) {
    const a = Math.max(0, pt.life / pt.max);
    if (pt.tracer) {
      ctx.strokeStyle = 'rgba(255,233,168,' + a + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.tracer.x2, pt.tracer.y2); ctx.stroke();
      continue;
    }
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- HUD (screen space) ----------------------------------------------------
export function drawHUD(ctx, state) {
  const p = state.player;
  const W = ctx.canvas.width;
  // Top-left: wanted stars, health, cash.
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 26px sans-serif';
  for (let i = 0; i < CFG.maxWanted; i++) {
    ctx.fillStyle = i < state.wanted ? '#ffd23a' : 'rgba(0,0,0,0.45)';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    const sx = 20 + i * 30;
    ctx.fillText('★', sx, 36);
  }
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 16, 48, 180, 16, 4); ctx.fill();
  ctx.fillStyle = p.hp > 50 ? '#4fae4f' : p.hp > 25 ? '#e8a33a' : '#e83a3a';
  roundRect(ctx, 16, 48, 180 * Math.max(0, p.hp) / 100, 16, 4); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif';
  ctx.fillText('HP ' + Math.ceil(p.hp), 204, 61);
  // Cash.
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#7dff8a';
  ctx.fillText('$' + p.money.toLocaleString('en-US'), 18, 96);
  // Ammo / weapon.
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif';
  ctx.fillText(p.hasPistol ? '🔫 Pistol  ' + p.ammo : '👊 Fists', 18, 120);
  if (p.car) ctx.fillText(p.car.name + '  •  ' + Math.round(Math.abs(p.car.speed) * 0.18) + ' km/h', 18, 142);
  // Minimap.
  drawMinimap(ctx, state);
  // Objective bar, bottom centre.
  const obj = state.missions.objective;
  if (obj && state.mode === 'playing') {
    ctx.font = 'bold 16px sans-serif';
    const tw = ctx.measureText(obj).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, (W - tw) / 2 - 16, ctx.canvas.height - 52, tw + 32, 32, 8); ctx.fill();
    ctx.fillStyle = '#ffd23a';
    ctx.textAlign = 'center';
    ctx.fillText('◆ ' + obj, W / 2, ctx.canvas.height - 30);
  }
  // Controls hint, bottom-left.
  ctx.textAlign = 'left';
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(p.car ? 'W/S drive • A/D steer • Space handbrake • E exit car' : 'WASD move • Shift run • E steal car • Click shoot • Space punch', 16, ctx.canvas.height - 16);
  ctx.fillText('P pause • H help • M mute', 16, ctx.canvas.height - 34);
  // Toast + crime flash.
  if (state.toastT > 0) {
    ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const tw = ctx.measureText(state.toast).width;
    roundRect(ctx, W / 2 - tw / 2 - 14, 108, tw + 28, 30, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(state.toast, W / 2, 129);
  }
  if (state.crimeFlashT > 0) {
    ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#ff8a7a';
    ctx.fillText(state.crimeFlash, W / 2, 92);
  }
  // Mission card.
  const card = state.missions.card;
  if (card) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,20,40,0.85)';
    roundRect(ctx, W / 2 - 300, 150, 600, 96, 10); ctx.fill();
    ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2;
    roundRect(ctx, W / 2 - 300, 150, 600, 96, 10); ctx.stroke();
    ctx.fillStyle = '#ffd23a'; ctx.font = 'bold 22px sans-serif';
    ctx.fillText(card.title, W / 2, 184);
    ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif';
    ctx.fillText(card.text, W / 2, 214);
  }
}

function drawMinimap(ctx, state) {
  const W = ctx.canvas.width;
  const mw = CFG.minimapW, mh = CFG.minimapH;
  const mx = W - mw - 16, my = 16;
  const sx = mw / CFG.worldW, sy = mh / CFG.worldH;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
  ctx.fillStyle = '#7fae5e'; ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#2f9fd8'; ctx.fillRect(mx + CFG.seaX * sx, my, mw, mh);
  ctx.fillStyle = '#f2dd9e'; ctx.fillRect(mx + CFG.beachX * sx, my, (CFG.seaX - CFG.beachX) * sx, mh);
  ctx.fillStyle = '#5a5d66';
  for (const rx of CFG.roadsX) ctx.fillRect(mx + rx * sx - 2, my, 4, mh);
  for (const ry of CFG.roadsY) ctx.fillRect(mx, my + ry * sy, mw, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (const b of state.world.buildings) ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  // Mission marker.
  const mk = state.missions.marker;
  if (mk) {
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.arc(mx + mk.x * sx, my + mk.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx + mk.x * sx, my + mk.y * sy, 5, 0, Math.PI * 2); ctx.stroke();
  }
  // Cops, cars, player.
  ctx.fillStyle = '#4f8cff';
  for (const c of state.cops) if (!c.dead) { ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#fff';
  for (const c of state.cars) if (!c.parked) { ctx.fillRect(mx + c.x * sx - 1.5, my + c.y * sy - 1.5, 3, 3); }
  const p = state.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffd23a';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
  roundRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('SOLMAR CITY', mx, my + mh + 22);
}

// --- Screens ----------------------------------------------------------------
function panel(ctx, title, lines, accent) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = 'rgba(8,16,32,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || '#ffd23a';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 110);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, H / 2 - 60 + i * 30));
}

export function drawMenu(ctx, state) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  // Sunny title backdrop: sky, sea and a skyline silhouette.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#7ec8f2'); grad.addColorStop(0.55, '#f2c96a'); grad.addColorStop(1, '#e88a4a');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2f9fd8'; ctx.fillRect(0, H * 0.72, W, H * 0.28);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.arc(W * 0.8, 110, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a3f4a';
  const skyline = [90, 150, 110, 190, 130, 170, 210, 140, 100, 180, 120];
  let sx = 60;
  for (const h of skyline) { ctx.fillRect(sx, H * 0.72 - h, 84, h); sx += 108; }
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR CITY', W / 2, 190);
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  ctx.fillText('A sun-soaked open-world crime story — Leo Marín is back in town.', W / 2, 232);
  ctx.font = '18px sans-serif';
  ctx.fillText('Steal cars • Outrun the law • Run six jobs for Mama Rosa • Take the bank', W / 2, 264);
  // Menu buttons.
  const hasSave = !!state.saveData;
  drawButton(ctx, W / 2 - 140, 330, 280, 52, '▶  NEW GAME', state.menuSel === 0);
  if (hasSave) drawButton(ctx, W / 2 - 140, 396, 280, 52, '↻  CONTINUE', state.menuSel === 1);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD move • Shift run • E steal / exit car • Click shoot • Space punch / handbrake', W / 2, 500);
  ctx.fillText('P pause • H help • M mute   •   Enter to start', W / 2, 528);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px sans-serif';
  ctx.fillText('An original game. Not affiliated with Rockstar Games or Grand Theft Auto.', W / 2, H - 24);
}

function drawButton(ctx, x, y, w, h, label, sel) {
  ctx.fillStyle = sel ? '#ffd23a' : 'rgba(255,255,255,0.15)';
  roundRect(ctx, x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 8); ctx.stroke();
  ctx.fillStyle = sel ? '#1a1a1a' : '#fff';
  ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + 34);
}

export function drawPaused(ctx, state) {
  panel(ctx, 'PAUSED', [
    'The city waits for you, Leo.',
    '',
    'Enter / P — resume',
    'H — help  •  R — restart the run  •  Q — quit to menu',
    'WASD move • E steal car • Click shoot • Space punch',
  ], '#fff');
}

export function drawHelp(ctx) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = 'rgba(8,16,32,0.92)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23a'; ctx.font = 'bold 34px sans-serif';
  ctx.fillText('HOW TO PLAY', W / 2, 120);
  ctx.fillStyle = '#fff'; ctx.font = '17px sans-serif';
  const lines = [
    'WASD / arrows — walk and drive (Shift to run)',
    'E — steal the nearest car / get out of a car',
    'Mouse click — shoot the pistol (aim with the cursor)',
    'Space — punch on foot, handbrake in a car',
    'Stars — the police come for you. Hide till they fade.',
    'Busted or Wasted — you lose 10% of your cash and the job restarts.',
    'Follow the yellow marker. Finish all six jobs to win.',
    '',
    'Press H or Esc to close',
  ];
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, 180 + i * 32));
}

export function drawBusted(ctx, state) {
  panel(ctx, 'BUSTED', [
    'The Solmar PD caught up with you.',
    'You lost 10% of your cash. The current job restarts.',
    '',
    'Press Enter to get out and keep playing',
  ], '#7fb8ff');
}

export function drawWasted(ctx, state) {
  panel(ctx, 'WASTED', [
    'Leo is down. The paramedics patch him up at Solmar Hospital.',
    'You lost 10% of your cash. The current job restarts.',
    '',
    'Press Enter to get out and keep playing',
  ], '#ff6a5a');
}

export function drawVictory(ctx, state) {
  const s = state.victoryStats || { time: 0, money: 0, missions: 6 };
  const mins = Math.floor(s.time / 60), secs = s.time % 60;
  panel(ctx, 'THE BIG SCORE!', [
    'Leo walks away from Solmar Bank a rich man.',
    'Mama Rosa is proud. The Sharks are history.',
    '',
    'Time: ' + mins + 'm ' + String(secs).padStart(2, '0') + 's     •     Cash: $' + s.money.toLocaleString('en-US') + '     •     Jobs: ' + s.missions + ' / 6',
    '',
    'Press Enter to keep cruising Solmar City',
  ], '#ffd23a');
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

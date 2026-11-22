// Solmar City — save games in localStorage: cash, jobs done, position.
const KEY = 'solmar-city-save-v1';

export function saveGame(state) {
  try {
    const data = {
      money: state.player.money,
      missionIndex: state.missions.index,
      x: state.player.x, y: state.player.y,
      hp: state.player.hp, ammo: state.player.ammo,
      hasPistol: state.player.hasPistol,
      seed: state.seed,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    state.saveData = data;
    state.saveDirty = false;
    return true;
  } catch { return false; }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

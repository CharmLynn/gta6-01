// Solmar City — tuning constants and shared values.
// One place for every number the rest of the game reads, so balance
// changes never mean hunting through gameplay code.
export const CFG = {
  worldW: 3600,
  worldH: 2800,
  roadW: 96,
  // Vertical and horizontal road centre lines across the city.
  roadsX: [300, 800, 1300, 1800, 2300, 2800],
  roadsY: [300, 750, 1200, 1650, 2100, 2500],
  beachX: 3180, // sand starts here
  seaX: 3360, // water starts here
  viewW: 1280,
  viewH: 800,
  // Player on foot.
  walkSpeed: 185,
  runSpeed: 305,
  playerRadius: 13,
  playerHp: 100,
  // Cars.
  carAccel: 420,
  carReverseAccel: 260,
  carBrake: 620,
  carMaxSpeed: 540,
  carMaxReverse: 180,
  carTurnRate: 2.6,
  carDrag: 0.55,
  carRadius: 20,
  trafficSpeed: 150,
  trafficCount: 14,
  // Pedestrians.
  pedCount: 42,
  pedSpeed: 55,
  pedFleeSpeed: 190,
  // Wanted / police.
  maxWanted: 5,
  wantedDecayDelay: 12, // seconds of no crime before stars start falling
  wantedDecayStep: 8, // seconds per star lost while hiding
  copFootSpeed: 205,
  copCarSpeed: 470,
  // Combat.
  pistolDamage: 34,
  pistolRange: 460,
  pistolAmmoStart: 24,
  meleeDamage: 30,
  meleeRange: 46,
  enemyHp: 70,
  copHp: 60,
  // Missions.
  taxiTimeLimit: 90,
  bankRobTime: 5,
  // Economy.
  startMoney: 120,
  taxiFare: 150,
  sharkReward: 300,
  bankTake: 5000,
  bustWastePenalty: 0.10,
  // Rendering.
  minimapW: 196,
  minimapH: 152,
  particleCap: 420,
  skidCap: 240,
};

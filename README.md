# Solmar City

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/CharmLynn/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/CharmLynn/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

Bounty: https://make.fun/bounty/gta6-01
Play: open game/index.html in a desktop browser — offline, no install.

**Solmar City** is an original 2D top-down open-world crime game that runs
offline in a desktop browser from static files — no build step, no network
requests, no external libraries. Pure Canvas 2D and vanilla JavaScript.

You are **Leo Marín**, a former getaway driver back in the sun-soaked
fictional coastal city of Solmar. **Mama Rosa** has six jobs for you, and
**Los Tiburones** (the Sharks) want you gone. Steal cars, outrun the Solmar
PD, and pull off the big one at Solmar Bank.

## How to play

Serve `game/` with any static server (for example `node serve.ts`) and open
`http://localhost:8080` in desktop Chrome. The game also runs by opening
`game/index.html` directly from disk.

### Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk and drive (Shift to run) |
| E | Steal the nearest car / get out of a car |
| Mouse click | Shoot the pistol (aim with the cursor) |
| Space | Punch on foot, handbrake in a car |
| P / Esc | Pause |
| H | Help |
| M | Mute |

### The city

A procedurally generated city (seeded, so every run rebuilds the same
streets): a downtown of high-rises, a beach and sea to the east, a container
port, a park, and an industrial yard. Traffic drives the road grid,
pedestrians stroll the sidewalks and flee gunfire, and the camera follows you
everywhere.

### Wanted level

Stealing cars, hitting pedestrians, firing shots and killing officers raise
your wanted level (0–5 stars). Foot police chase you down and police cars
ram you. Get **Busted** or **Wasted** and you wake up at the police station
or hospital, 10% poorer, with the current job restarted. Lay low and the
stars fade.

### The story — six jobs

1. **Wheels** — steal any car and bring it to Mama Rosa's garage.
2. **Fare Play** — taxi a fare from the Marina to the Downtown Hotel in 90 seconds.
3. **Hot Wheels** — get 2 stars of heat, then lose the cops.
4. **Special Delivery** — run a package to the Port while Shark cars shoot at you.
5. **Shark Hunt** — clear four Sharks out of the Industrial Yard, pistol in hand.
6. **The Big Score** — rob Solmar Bank, then lose 3 stars and reach the hideout.

Finish all six and the victory screen settles your time and your take.
Progress autosaves to localStorage — **Continue** on the title screen picks
up where you left off.

## Sound

Every sound is synthesised live with WebAudio — engine hum, sirens, gunshots,
pickups, mission jingles and a bass-led music loop. No audio files.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game itself,
taken in headless Chrome from the deterministic shot modes
(`?shot=start|drive|mission|end&seed=1`):

1. `1-start.jpg` — title screen
2. `2-drive.jpg` — a 3-star police chase in a stolen car
3. `3-mission.jpg` — the Shark Hunt firefight, on foot
4. `4-end.jpg` — the victory screen after the Big Score

## Structure

```
game/
  index.html        canvas + module loader
  src/
    config.js       tuning constants
    random.js       seeded RNG
    world.js        city generation + collision
    audio.js        WebAudio sound + music
    input.js        keyboard / mouse
    player.js       walking, driving, combat
    vehicles.js     car physics, traffic AI, police cars
    pedestrians.js  pedestrians, gang members, police on foot
    missions.js     the six-job story
    render.js       world, HUD, minimap, menus
    shots.js        deterministic screenshot scenes
    save.js         localStorage saves
    main.js         boot, loop, state machine
```

## License

MIT — see `LICENSE`. An original game, not affiliated with Rockstar Games
or Grand Theft Auto.

<sub>Entered on [make.fun](https://make.fun/?ref=mpd17n5r&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

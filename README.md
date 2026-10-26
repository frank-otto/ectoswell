# 🟢 Ectoswell

Day 19 of a daily Halloween web-game series – **1 day to Halloween 🎃**

A cinematic 3D goo game in a Halloween village at night. You are a tiny, hungry, glowing blob of goo. Roll it around: everything smaller than you sticks to it – sweets, apples, pumpkins, skulls, lanterns, gravestones, fences, carts, scarecrows, trees, houses – and with every gulp you swell a little bigger. Things that are still too big just bump you, and a hard bump knocks some of your loot off again.

**The hook – THE BIG GULP.** Each night has a giant you cannot touch at first. Swell big enough and roll into it: time slows, the ground cracks, the giant is torn up and swallowed whole, shockwaves roll over the village – and then the burp. Night I ends with the Giant Pumpkin, Night II with the stone crypt, Night III with the church itself, bell tower and all.

## How to play
- **Drag anywhere** (a stick appears under your finger) or use the **arrow keys / WASD** to roll. The camera turns with you, so "up" is always forward. **Esc** opens the menu.
- Anything smaller than you sticks; bigger things bump you. A hard bump knocks a few stuck things off.
- Gulp quickly in a row for a **gulp chain** (×2 … up to ×5).
- The dawn bar runs down; when the sun comes up the night is over. Gulp the night's giant before dawn to win – time left becomes bonus points. 1 to 3 stars per night.
- The 🎯 marker shows where the giant is and how big you need to be (🔒 until you are big enough).

**Nights:** I Pumpkin Patch (Giant Pumpkin) · II Old Graveyard (the crypt) · III The Whole Town (the church).
**Modes:** Night · **Swell till Dawn** (no goal – the village grows back out of sight and every gulp holds back the dawn; how big can you get?) · **Player 1 vs Player 2** hot-seat duel (same night, same village, one turn each, highest score wins).
**Difficulty:** Easy / Medium / Hard (how fast you grow, how hard bumps knock things off, how long the night lasts). **Kids mode:** extra sticky goo that grows faster, nothing gets knocked off, and the dawn waits – you cannot really lose.

**One tap to play.** The game opens in the middle of a Big Gulp: frame one shows a giant blob, full of houses and trees, tearing the church off the ground. Then it rewinds to a marble-sized blob next to a single sweet, and the title lands. Tap (or click) anywhere and you are straight in Night I, sound on, with a short hint. The start screen has one big PLAY button; Swell till Dawn, the duel, nights, difficulty, kids mode, quality, sound and the intro replay sit behind the small ⚙. The language follows the browser (German for German browsers, English otherwise) with a tiny DE/EN switch (remembered). A 1080×1350 score card to save or share. Quality is automatic (steps down only if the frame rate stays low).

## Tech
- Three.js (WebGL): about 1,600 procedurally built props (merged low-poly geometry with vertex colours, carved glowing jack-o'-lantern faces, houses with lit windows, a crypt, a church with bell tower and rose window), drawn as instanced meshes; a painted 2048² village ground texture; a sky shader with moon, stars, clouds and dawn; fog; moonlight with a shadow camera that follows the blob; HDR bloom with a clamped high-pass; ACES tone mapping and a colour grade.
- The blob: a wobbling translucent shader with fresnel rim, inner bubbles and a gulp pulse, eyes and a mouth, its own green light that makes nearby things glow, a slime trail and shockwave rings. Swallowed things really stick at the spot where they touched and roll with it.
- A pure, deterministic rules engine (`src/rules.js`): rolling physics with quaternions, a spatial grid, sticking + growth, bumps and knock-offs, gulp chains, the dawn clock, nights, endless regrowth, identical duel villages, kids rules, and a human-like autoplayer for tests, the balance check and the video. It only emits events; visuals and sounds react to them.
- Sounds: real CC0 recordings only, no oscillators; original sample-based music (a goo polka). See `LICENSES/SOUNDS.md`.
- Everything is bundled into `js/game.bundle.js` + `js/sounds-src.js`, so it also runs straight from the file system (`start.command` or open `index.html`).

## Build & test
```
npm install
node tools/build.mjs
node tools/sim.mjs            # balance check with simulated players
python3 test/test_game.py     # headless Chrome (SwiftShader) via Playwright
python3 test/test_mobile.py   # phones: WebKit iPhone + Chromium Pixel, real taps, portrait + landscape
```

Built with Grok Bot · @Frank_AI_Lab. Sound credits by source ID in `LICENSES/SOUNDS.md`. Code licenses: three.js (MIT), Fredoka font (OFL).

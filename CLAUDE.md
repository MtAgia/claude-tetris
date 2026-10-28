# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no `package.json`, no build, no tests, no linter. The README and UI text are in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`) and visit `http://localhost:8000`.

## Architecture

- `index.html` – DOM structure. `game.js` looks elements up by id at load (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`); renaming any of them breaks the script.
- `game.js` – all game logic in one file with global mutable state (`board`, `current`, `next`, `score`, ...), reset by `init()` (also the restart button handler).
- `style.css` – dark retro theme.

Key points in `game.js` that span multiple functions:

- Board cells hold `0` or a piece type index 1–7; the same index selects the entry in `COLORS` and `PIECES` (index 0 is `null` in both).
- Power-ups: `clearLines()` sets `pendingPower` every `POWERUP_EVERY` lines; `spawn()` then makes `next = randomPowerup()` (1×1 piece, `type` 8, has `.power`). Type 8 is never written to `board`: `lockPiece()` calls `applyPower()` instead of `merge()`. `freeze` sets `freezeLeft`, which `loop()` counts down instead of accumulating `dropAccum`. HUD element id `power` is also looked up by `game.js`.
- Piece lifecycle: `lockPiece()` = `merge()` (or `applyPower()`) → `clearLines()` → `spawn()`. `spawn()` calls `endGame()` if the new piece collides immediately.
- Game loop: `loop()` is driven by `requestAnimationFrame` and accumulates time in `dropAccum` against `dropInterval`. Pause and game over both `cancelAnimationFrame(animId)`; resuming restarts `loop` manually. Any new code that stops/starts the loop must keep `animId` and `lastTime` consistent.
- `clearLines()` owns level/speed progression (`level = startLevel + floor(lines/10)`, `startLevel` from localStorage `tetris-start-level`, set in `#pause-menu`; `dropInterval = max(100, 1000 - (level-1)*90)`).
- Rotation is `rotateCW` plus horizontal kicks `[0,-1,1,-2,2]` in `tryRotate()` (not SRS).
- Canvas size is hardcoded in `index.html` (`300×600` board, `120×120` next preview) and must equal `COLS*BLOCK × ROWS*BLOCK` if those constants change. `drawNext` uses its own block size of 30.

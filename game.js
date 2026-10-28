'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Skins visuales. `colors`: índice 0 null, 1–7 piezas, 8 power-up (nunca se escribe en board).
// `background`: {dark, light} para el fondo del canvas, o null para usar el del tema (--canvas-bg).
// `grid`: color de rejilla o null para usar el del tema. `drawBlock(ctx, px, py, s, color)` recibe
// la esquina superior izquierda en píxeles y el tamaño de celda; alpha e icono los gestiona drawBlock().
function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    name: 'Retro',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#f5f5f5'],
    background: null,
    grid: null,
    drawBlock(context, px, py, s, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, s - 2, s - 2);
      context.fillStyle = highlightColor;
      context.fillRect(px + 1, py + 1, s - 2, 4);
    },
  },
  neon: {
    name: 'Neon',
    colors: [null, '#00f0ff', '#fff200', '#d500f9', '#39ff14', '#ff1744', '#2979ff', '#ff9100', '#ffffff'],
    background: { dark: '#000000', light: '#000000' },
    grid: '#161628',
    drawBlock(context, px, py, s, color) {
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.fillStyle = color + '55';
      context.fillRect(px + 3, py + 3, s - 6, s - 6);
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 3, py + 3, s - 6, s - 6);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
    },
  },
  pastel: {
    name: 'Pastel',
    colors: [null, '#a8e6ef', '#fff1b8', '#d9b8f0', '#b9e8c0', '#f7b8b8', '#b8d4f7', '#fbd3a6', '#fffafa'],
    background: { dark: '#2b2838', light: '#fff8fb' },
    grid: null,
    drawBlock(context, px, py, s, color) {
      roundedRectPath(context, px + 2, py + 2, s - 4, s - 4, s * 0.3);
      context.fillStyle = color;
      context.fill();
      // brillo suave arriba-izquierda
      roundedRectPath(context, px + 5, py + 5, s - 14, 4, 2);
      context.fillStyle = 'rgba(255, 255, 255, 0.55)';
      context.fill();
    },
  },
  pixel: {
    name: 'Pixel art',
    colors: [null, '#29b6f6', '#fdd835', '#ab47bc', '#66bb6a', '#ef5350', '#5c6bc0', '#ff9800', '#eceff1'],
    background: null,
    grid: null,
    drawBlock(context, px, py, s, color) {
      // sub-cuadrícula 3x3: bordes sombreados, centro claro y damero de texturas
      const inner = s - 2, u = Math.floor(inner / 3);
      const ox = px + 1, oy = py + 1;
      context.fillStyle = color;
      context.fillRect(ox, oy, inner, inner);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (i === 1 && j === 1) context.fillStyle = 'rgba(255, 255, 255, 0.35)';
          else if (i === 2 || j === 2) context.fillStyle = 'rgba(0, 0, 0, 0.35)';
          else if ((i + j) % 2 === 0) context.fillStyle = 'rgba(255, 255, 255, 0.18)';
          else continue;
          context.fillRect(ox + j * u, oy + i * u, u, u);
        }
      }
      context.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      context.lineWidth = 1;
      context.strokeRect(ox + 0.5, oy + 0.5, inner - 1, inner - 1);
    },
  },
};

const SKIN_KEY = 'tetris-skin';
const DEFAULT_SKIN = 'retro';
let skin = SKINS[DEFAULT_SKIN];

const POWERUPS = { bomb: '💣', ray: '⚡', tint: '🎨', gravity: '⬇️', freeze: '❄️' };
const POWERUP_EVERY = 5;
const FREEZE_MS = 5000;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const powerEl = document.getElementById('power');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

const THEME_KEY = 'tetris-theme';
let gridColor, highlightColor;

function applyTheme(theme) {
  const isLight = theme === 'light';
  if (isLight) document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  const style = getComputedStyle(document.documentElement);
  gridColor = style.getPropertyValue('--grid').trim();
  highlightColor = style.getPropertyValue('--block-highlight').trim();
  themeToggle.setAttribute('aria-pressed', String(isLight));
  themeToggle.setAttribute('aria-label', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  themeToggle.textContent = isLight ? '🌙 Modo oscuro' : '☀️ Modo claro';
  applySkinBackground();
  // El loop está detenido en pausa/game over: redibujar sin tocar animId/lastTime
  if (current && next) { draw(); drawNext(); }
}

function loadTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

// Fondo de los canvas según skin + tema; '' devuelve el control a la regla CSS (--canvas-bg)
function applySkinBackground() {
  const bg = skin.background;
  const value = bg ? (document.documentElement.dataset.theme === 'light' ? bg.light : bg.dark) : '';
  canvas.style.background = value;
  nextCanvas.style.background = value;
}

function applySkin(name) {
  skin = SKINS[name] || SKINS[DEFAULT_SKIN];
  skinSelect.value = SKINS[name] ? name : DEFAULT_SKIN;
  applySkinBackground();
  // Loop detenido en pausa/game over: redibujar sin tocar animId/lastTime
  if (current && next) { draw(); drawNext(); }
}

function loadSkin() {
  try {
    const saved = localStorage.getItem(SKIN_KEY);
    return Object.hasOwn(SKINS, saved) ? saved : DEFAULT_SKIN;
  } catch { return DEFAULT_SKIN; }
}

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, pendingPower, freezeLeft;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPowerup() {
  const names = Object.keys(POWERUPS);
  const power = names[Math.floor(Math.random() * names.length)];
  return { type: 8, power, shape: [[8]], x: Math.floor(COLS / 2), y: 0 };
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    if (Math.floor((lines + cleared) / POWERUP_EVERY) > Math.floor(lines / POWERUP_EVERY)) pendingPower = true;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

// Baja todas las celdas de cada columna al fondo, conservando el orden
function compact() {
  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = 0; r < ROWS; r++) if (board[r][c]) col.push(board[r][c]);
    for (let r = ROWS - 1; r >= 0; r--) board[r][c] = col.pop() ?? 0;
  }
}

function applyPower({ power, x, y }) {
  let removed = 0;
  const clear = (r, c) => {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || !board[r][c]) return;
    board[r][c] = 0;
    removed++;
  };
  switch (power) {
    case 'bomb':
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) clear(y + dr, x + dc);
      break;
    case 'ray':
      for (let c = 0; c < COLS; c++) clear(y, c);
      for (let r = 0; r < ROWS; r++) clear(r, x);
      break;
    case 'tint': {
      const color = board[y + 1]?.[x];
      if (!color) break;
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) if (board[r][c] === color) clear(r, c);
      compact();
      break;
    }
    case 'gravity':
      compact();
      break;
    case 'freeze':
      freezeLeft = FREEZE_MS;
      break;
  }
  score += removed * 10 * level;
}

function lockPiece() {
  if (current.power) applyPower(current);
  else merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = pendingPower ? randomPowerup() : randomPiece();
  pendingPower = false;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  powerEl.textContent = freezeLeft > 0 ? `❄️ ${(freezeLeft / 1000).toFixed(1)}s` : '—';
}

function drawBlock(context, x, y, colorIndex, size, alpha, icon) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  skin.drawBlock(context, x * size, y * size, size, skin.colors[colorIndex]);
  if (icon) {
    context.font = `${size - 10}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(icon, x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = skin.grid || gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2, POWERUPS[current.power]);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK, 1, POWERUPS[current.power]);

  if (freezeLeft > 0) {
    ctx.fillStyle = 'rgba(100, 181, 246, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB, 1, POWERUPS[next.power]);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - dt);
    updateHUD();
  } else {
    dropAccum += dt;
  }
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  pendingPower = false;
  freezeLeft = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === skinSelect) skinSelect.blur(); // las flechas no deben cambiar la skin
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
  applyTheme(theme);
  themeToggle.blur(); // evita que Space/Enter vuelvan a activar el botón
});

skinSelect.addEventListener('change', () => {
  try { localStorage.setItem(SKIN_KEY, skinSelect.value); } catch {}
  applySkin(skinSelect.value);
  skinSelect.blur(); // evita que Space/flechas cambien la opción
});

for (const [key, s] of Object.entries(SKINS)) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = s.name;
  skinSelect.appendChild(opt);
}
skin = SKINS[loadSkin()];
applyTheme(loadTheme());
applySkin(loadSkin());
init();

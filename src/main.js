import * as THREE from 'three';
import './style.css';

const VIRTUAL_WIDTH = 480;
const VIRTUAL_HEIGHT = 288;
const TILE = 24;
const COLS = 20;
const ROWS = 12;
const FLOOR = '#1a2234';
const FLOOR_ALT = '#1d2940';
const WALL = '#303b57';
const WALL_TOP = '#485575';

const canvas = document.querySelector('#game-canvas');
const gameWrap = document.querySelector('#game-wrap');
const resultPanel = document.querySelector('#result-panel');
const resultTitle = document.querySelector('#result-title');
const resultKicker = document.querySelector('#result-kicker');
const resultCopy = document.querySelector('#result-copy');
const runState = document.querySelector('#run-state');
const healthFill = document.querySelector('#health-fill');
const healthValue = document.querySelector('#health-value');
const coinValue = document.querySelector('#coin-value');
const threatValue = document.querySelector('#threat-value');
const missionStatus = document.querySelector('#mission-status');
const coinStatus = document.querySelector('#coin-status');
const exitStatus = document.querySelector('#exit-status');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
renderer.setPixelRatio(1);
renderer.setSize(VIRTUAL_WIDTH, VIRTUAL_HEIGHT, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.style.imageRendering = 'pixelated';

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b0f1a');
const camera = new THREE.OrthographicCamera(0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT, 0, 0.1, 100);
camera.position.z = 10;

const clock = new THREE.Clock();
const world = new THREE.Group();
scene.add(world);

const blockedCells = new Set([
  '4,3', '4,4', '4,5', '5,5', '6,5',
  '12,2', '13,2', '14,2', '14,3',
  '9,8', '10,8', '11,8', '11,7',
  '16,7', '16,8', '16,9', '15,9',
]);

const state = {
  mode: 'playing',
  time: 0,
  score: 0,
  coins: 0,
  enemiesDefeated: 0,
  keys: new Set(),
  player: { x: 58, y: 232, hp: 100, maxHp: 100, speed: 90, facing: 'right', attackCooldown: 0, invulnerable: 0, sprite: null, slash: null },
  enemies: [],
  coinsOnMap: [],
  particles: [],
  exit: null,
};

const palette = {
  player: { '1': '#101827', '2': '#65e6d0', '3': '#f4c95d', '4': '#f7f1d1' },
  enemy: { '1': '#241b31', '2': '#ff6f61', '3': '#db3f5b', '4': '#f4c95d' },
  coin: { '1': '#f4c95d', '2': '#ffe5a3' },
  exit: { '1': '#131b2c', '2': '#65e6d0', '3': '#c0fff3', '4': '#f4c95d' },
};

function makePixelTexture(rows, colors, scale = 2) {
  const size = rows.length;
  const bitmap = document.createElement('canvas');
  bitmap.width = size * scale;
  bitmap.height = size * scale;
  const context = bitmap.getContext('2d');
  context.imageSmoothingEnabled = false;
  rows.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell !== '.' && colors[cell]) {
      context.fillStyle = colors[cell];
      context.fillRect(x * scale, y * scale, scale, scale);
    }
  }));
  const texture = new THREE.CanvasTexture(bitmap);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const textures = {
  player: makePixelTexture([
    '....1111....',
    '...122221...',
    '..12222221..',
    '..12244221..',
    '..12222221..',
    '...122221...',
    '..13333331..',
    '.1133333311.',
    '.1123333211.',
    '..12222221..',
    '..12222221..',
    '..11....11..',
  ], palette.player),
  enemy: makePixelTexture([
    '....1111....',
    '...122221...',
    '..12222221..',
    '.1224442221.',
    '.1222222221.',
    '.1122222211.',
    '..13333331..',
    '..13333331..',
    '.1133333311.',
    '.11.3333.11.',
    '....1111....',
    '...11..11...',
  ], palette.enemy),
  coin: makePixelTexture([
    '...11...',
    '..1221..',
    '.122221.',
    '.122221.',
    '.122221.',
    '..1221..',
    '...11...',
  ], palette.coin),
  exit: makePixelTexture([
    '...1111...',
    '..122221..',
    '.12222221.',
    '.12233221.',
    '1223344221',
    '1223344221',
    '.12233221.',
    '.12222221.',
    '..122221..',
    '...1111...',
  ], palette.exit),
};

function rect(x, y, width, height, color, z = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color }));
  mesh.position.set(x + width / 2, VIRTUAL_HEIGHT - (y + height / 2), z);
  world.add(mesh);
  return mesh;
}

function screenPosition(x, y, z = 2) { return new THREE.Vector3(x, VIRTUAL_HEIGHT - y, z); }

function createSprite(texture, width, height, x, y, z = 3) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(width, height, 1);
  sprite.position.copy(screenPosition(x, y, z));
  world.add(sprite);
  return sprite;
}

function buildMap() {
  rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT, '#111829', -1);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cellKey = `${col},${row}`;
      const x = col * TILE;
      const y = row * TILE;
      if (blockedCells.has(cellKey)) {
        rect(x, y, TILE, TILE, WALL, 0);
        rect(x + 3, y + 3, TILE - 6, 5, WALL_TOP, 0.2);
      } else {
        rect(x, y, TILE, TILE, (col + row) % 2 ? FLOOR : FLOOR_ALT, 0);
        rect(x + 1, y + TILE - 2, TILE - 2, 1, '#151d2d', 0.1);
      }
    }
  }
  rect(0, 0, VIRTUAL_WIDTH, 6, '#090e1a', 0.2);
  rect(0, VIRTUAL_HEIGHT - 6, VIRTUAL_WIDTH, 6, '#090e1a', 0.2);
  rect(0, 0, 6, VIRTUAL_HEIGHT, '#090e1a', 0.2);
  rect(VIRTUAL_WIDTH - 6, 0, 6, VIRTUAL_HEIGHT, '#090e1a', 0.2);
}

function createExit() {
  const sprite = createSprite(textures.exit, 28, 28, 426, 50, 2);
  state.exit = { x: 438, y: 64, sprite, pulse: 0 };
}

function spawnPlayer() {
  state.player.sprite = createSprite(textures.player, 28, 28, state.player.x, state.player.y, 4);
}

function spawnEnemy(x, y, speed = 32) {
  const sprite = createSprite(textures.enemy, 27, 27, x, y, 3);
  state.enemies.push({ x, y, hp: 2, speed, hitCooldown: 0, flash: 0, sprite, alive: true });
}

function spawnCoin(x, y) {
  const sprite = createSprite(textures.coin, 16, 16, x, y, 2);
  state.coinsOnMap.push({ x, y, sprite, phase: Math.random() * Math.PI * 2, collected: false });
}

function initGame() {
  buildMap();
  createExit();
  spawnPlayer();
  spawnEnemy(184, 67, 29);
  spawnEnemy(304, 190, 31);
  spawnEnemy(394, 218, 33);
  spawnCoin(122, 57);
  spawnCoin(342, 61);
  spawnCoin(386, 170);
  syncHud();
}

function isBlocked(x, y, radius = 9) {
  if (x < 16 + radius || x > VIRTUAL_WIDTH - 16 - radius || y < 14 + radius || y > VIRTUAL_HEIGHT - 14 - radius) return true;
  const samples = [[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]];
  return samples.some(([dx, dy]) => {
    const col = Math.floor((x + dx) / TILE);
    const row = Math.floor((y + dy) / TILE);
    return blockedCells.has(`${col},${row}`);
  });
}

function moveEntity(entity, dx, dy, radius = 9) {
  const nextX = entity.x + dx;
  const nextY = entity.y + dy;
  if (!isBlocked(nextX, entity.y, radius)) entity.x = nextX;
  if (!isBlocked(entity.x, nextY, radius)) entity.y = nextY;
}

function faceForVector(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

function directionVector() {
  let dx = 0; let dy = 0;
  if (state.keys.has('ArrowLeft') || state.keys.has('a')) dx -= 1;
  if (state.keys.has('ArrowRight') || state.keys.has('d')) dx += 1;
  if (state.keys.has('ArrowUp') || state.keys.has('w')) dy -= 1;
  if (state.keys.has('ArrowDown') || state.keys.has('s')) dy += 1;
  const length = Math.hypot(dx, dy) || 1;
  return { dx: dx / length, dy: dy / length };
}

function facingVector() {
  return { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[state.player.facing];
}

function startAudio() {
  if (!window.__pixelAudio) window.__pixelAudio = new AudioContext();
  if (window.__pixelAudio.state === 'suspended') window.__pixelAudio.resume();
}

function beep(frequency, duration = 0.06, type = 'square', volume = 0.035) {
  if (!window.__pixelAudio) return;
  const audio = window.__pixelAudio;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + duration);
}

function attack() {
  if (state.mode !== 'playing' || state.player.attackCooldown > 0) return;
  startAudio();
  state.player.attackCooldown = 0.34;
  const [fx, fy] = facingVector();
  const slash = new THREE.Mesh(new THREE.PlaneGeometry(18, 6), new THREE.MeshBasicMaterial({ color: '#f4c95d', transparent: true, opacity: 0.95 }));
  slash.position.copy(screenPosition(state.player.x + fx * 18, state.player.y + fy * 18, 3.8));
  slash.rotation.z = fx ? 0 : Math.PI / 2;
  world.add(slash);
  state.player.slash = slash;
  setTimeout(() => { world.remove(slash); if (state.player.slash === slash) state.player.slash = null; }, 110);
  beep(270, 0.08);
  state.enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const distance = Math.hypot(dx, dy);
    const inFront = (fx && Math.sign(dx) === fx) || (fy && Math.sign(dy) === fy);
    if (distance < 42 && inFront) {
      enemy.hp -= 1;
      enemy.flash = 0.16;
      spawnBurst(enemy.x, enemy.y, '#f4c95d', 4);
      beep(140, 0.1, 'sawtooth', 0.045);
      if (enemy.hp <= 0) defeatEnemy(enemy);
    }
  });
}

function defeatEnemy(enemy) {
  enemy.alive = false;
  enemy.sprite.visible = false;
  state.enemiesDefeated += 1;
  state.score += 100;
  spawnCoin(enemy.x, enemy.y);
  spawnBurst(enemy.x, enemy.y, '#ff6f61', 9);
  beep(82, 0.18, 'square', 0.05);
  syncHud();
}

function spawnBurst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const size = 2 + Math.random() * 3;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color, transparent: true }));
    mesh.position.copy(screenPosition(x, y, 5));
    world.add(mesh);
    state.particles.push({ mesh, life: 0.35 + Math.random() * 0.2, vx: (Math.random() - 0.5) * 65, vy: (Math.random() - 0.5) * 65 });
  }
}

function damagePlayer(amount) {
  if (state.player.invulnerable > 0 || state.mode !== 'playing') return;
  state.player.hp = Math.max(0, state.player.hp - amount);
  state.player.invulnerable = 0.85;
  spawnBurst(state.player.x, state.player.y, '#ff6f61', 6);
  beep(95, 0.15, 'sawtooth', 0.06);
  if (state.player.hp <= 0) finishRun(false);
  syncHud();
}

function updatePlayer(delta) {
  const { dx, dy } = directionVector();
  if (dx || dy) {
    moveEntity(state.player, dx * state.player.speed * delta, dy * state.player.speed * delta, 9);
    state.player.facing = faceForVector(dx, dy);
  }
  state.player.attackCooldown = Math.max(0, state.player.attackCooldown - delta);
  state.player.invulnerable = Math.max(0, state.player.invulnerable - delta);
  state.player.sprite.position.copy(screenPosition(state.player.x, state.player.y + (state.player.invulnerable > 0 ? Math.sin(state.time * 30) * 2 : 0), 4));
  state.player.sprite.material.opacity = state.player.invulnerable > 0 && Math.floor(state.time * 20) % 2 ? 0.35 : 1;
}

function updateEnemies(delta) {
  state.enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    enemy.hitCooldown = Math.max(0, enemy.hitCooldown - delta);
    enemy.flash = Math.max(0, enemy.flash - delta);
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 24) moveEntity(enemy, (dx / distance) * enemy.speed * delta, (dy / distance) * enemy.speed * delta, 8);
    if (distance < 21 && enemy.hitCooldown <= 0) { enemy.hitCooldown = 0.8; damagePlayer(12); }
    enemy.sprite.position.copy(screenPosition(enemy.x, enemy.y + Math.sin(state.time * 6 + enemy.x) * 1.2, 3));
    enemy.sprite.material.opacity = enemy.flash > 0 ? 0.35 : 1;
  });
}

function updateCoins(delta) {
  state.coinsOnMap.forEach((coin) => {
    if (coin.collected) return;
    coin.phase += delta * 4;
    coin.sprite.position.copy(screenPosition(coin.x, coin.y + Math.sin(coin.phase) * 2, 2));
    if (Math.hypot(coin.x - state.player.x, coin.y - state.player.y) < 15) {
      coin.collected = true;
      coin.sprite.visible = false;
      state.coins += 1;
      state.score += 25;
      spawnBurst(coin.x, coin.y, '#f4c95d', 6);
      beep(620, 0.08, 'square', 0.04);
      syncHud();
    }
  });
}

function updateExit(delta) {
  const unlocked = state.enemies.filter((enemy) => enemy.alive).length === 0;
  state.exit.pulse += delta * 4;
  state.exit.sprite.position.copy(screenPosition(state.exit.x, state.exit.y + Math.sin(state.exit.pulse) * 2, 2));
  state.exit.sprite.material.opacity = unlocked ? 0.75 + Math.sin(state.exit.pulse) * 0.2 : 0.25;
  if (unlocked && Math.hypot(state.exit.x - state.player.x, state.exit.y - state.player.y) < 22) finishRun(true);
}

function updateParticles(delta) {
  state.particles = state.particles.filter((particle) => {
    particle.life -= delta;
    particle.mesh.position.x += particle.vx * delta;
    particle.mesh.position.y += -particle.vy * delta;
    particle.mesh.material.opacity = Math.max(0, particle.life * 3);
    if (particle.life <= 0) { world.remove(particle.mesh); return false; }
    return true;
  });
}

function finishRun(won) {
  if (state.mode !== 'playing') return;
  state.mode = won ? 'won' : 'lost';
  resultPanel.classList.remove('hidden');
  resultKicker.textContent = won ? 'RUN COMPLETE' : 'SIGNAL LOST';
  resultTitle.textContent = won ? 'SECTOR CLEARED' : 'RUN TERMINATED';
  resultCopy.textContent = won ? `出口已开启。你带回了 ${state.coins} 枚信号核心，得分 ${state.score}。` : '护盾耗尽。按 R 或点击下方按钮重新进入扇区。';
  runState.textContent = won ? 'SECTOR CLEAR' : 'RUN ENDED';
  document.querySelector('.run-dot').style.background = won ? '#65e6d0' : '#ff6f61';
  beep(won ? 740 : 60, 0.28, 'square', 0.045);
}

function syncHud() {
  const liveEnemies = state.enemies.filter((enemy) => enemy.alive).length;
  const health = Math.round(state.player.hp);
  healthFill.style.width = `${health}%`;
  healthValue.textContent = String(health).padStart(3, '0');
  coinValue.textContent = String(state.coins).padStart(3, '0');
  threatValue.textContent = String(liveEnemies).padStart(2, '0');
  missionStatus.textContent = liveEnemies ? 'OPEN' : 'CLEAR';
  missionStatus.style.color = liveEnemies ? 'var(--cyan)' : 'var(--yellow)';
  coinStatus.textContent = `${state.coins} / 3`;
  exitStatus.textContent = liveEnemies ? 'LOCKED' : 'OPEN';
  exitStatus.classList.toggle('locked', Boolean(liveEnemies));
}

function restart() {
  window.location.reload();
}

function frame() {
  const delta = Math.min(clock.getDelta(), 0.05);
  state.time += delta;
  if (state.mode === 'playing') {
    updatePlayer(delta);
    updateEnemies(delta);
    updateCoins(delta);
    updateExit(delta);
    updateParticles(delta);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd'].includes(key)) event.preventDefault();
  if (key === ' ') attack();
  if (key === 'r' && state.mode !== 'playing') restart();
  state.keys.add(key);
  startAudio();
});

window.addEventListener('keyup', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  state.keys.delete(key);
});

window.addEventListener('blur', () => state.keys.clear());

document.querySelector('#restart-button').addEventListener('click', restart);
document.querySelector('#touch-attack').addEventListener('pointerdown', (event) => { event.preventDefault(); attack(); });
document.querySelectorAll('.control-button').forEach((button) => {
  const direction = button.dataset.dir;
  const keys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  const key = keys[direction];
  const press = (event) => { event.preventDefault(); state.keys.add(key); startAudio(); };
  const release = (event) => { event.preventDefault(); state.keys.delete(key); };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointerleave', release);
  button.addEventListener('pointercancel', release);
});

initGame();
frame();

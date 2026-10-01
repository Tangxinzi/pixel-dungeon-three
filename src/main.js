import * as THREE from 'three';
import './style.css';

const WIDTH = 640;
const HEIGHT = 360;
const GROUND_Y = 286;
const RUN_LENGTH = 2800;
const STAR_TARGET = 8;
const PLAYER_X = 142;

const canvas = document.querySelector('#game-canvas');
const resultPanel = document.querySelector('#result-panel');
const resultTitle = document.querySelector('#result-title');
const resultKicker = document.querySelector('#result-kicker');
const resultCopy = document.querySelector('#result-copy');
const runState = document.querySelector('#run-state');
const healthFill = document.querySelector('#health-fill');
const healthValue = document.querySelector('#health-value');
const distanceValue = document.querySelector('#distance-value');
const distanceFill = document.querySelector('#distance-fill');
const starValue = document.querySelector('#star-value');
const missionStatus = document.querySelector('#mission-status');
const starStatus = document.querySelector('#star-status');
const exitStatus = document.querySelector('#exit-status');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#a4d4cb');
const camera = new THREE.OrthographicCamera(0, WIDTH, HEIGHT, 0, 0.1, 100);
camera.position.z = 10;

const world = new THREE.Group();
scene.add(world);
const clock = new THREE.Clock();

const state = {
  mode: 'playing',
  time: 0,
  distance: 0,
  speed: 178,
  score: 0,
  stars: 0,
  hp: 3,
  keys: new Set(),
  jumpQueued: false,
  spawnTimer: 0.9,
  starTimer: 0.35,
  player: { y: GROUND_Y - 36, vy: 0, grounded: true, sliding: false, invulnerable: 0, animationFrame: -1, sprite: null },
  obstacles: [],
  collectibles: [],
  particles: [],
  parallax: [],
  groundDetails: [],
};

function makeTexture(width, height, draw) {
  const bitmap = document.createElement('canvas');
  bitmap.width = width;
  bitmap.height = height;
  const context = bitmap.getContext('2d');
  context.imageSmoothingEnabled = true;
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(bitmap);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function rect(x, y, width, height, color, z = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color }));
  mesh.position.set(x + width / 2, HEIGHT - (y + height / 2), z);
  world.add(mesh);
  return mesh;
}

function createSprite(texture, width, height, x, y, z = 2) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(width, height, 1);
  sprite.position.set(x + width / 2, HEIGHT - (y + height / 2), z);
  world.add(sprite);
  return sprite;
}

function placeSprite(sprite, width, height, x, y) {
  sprite.position.set(x + width / 2, HEIGHT - (y + height / 2), sprite.position.z);
}

const textures = {
  playerA: makeTexture(64, 80, (ctx) => {
    ctx.fillStyle = '#274f43'; ctx.fillRect(22, 21, 22, 37);
    ctx.fillStyle = '#f3c19f'; ctx.beginPath(); ctx.arc(33, 18, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#345e52'; ctx.beginPath(); ctx.arc(31, 12, 14, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e7765a'; ctx.fillRect(10, 29, 25, 7); ctx.fillRect(10, 35, 10, 12);
    ctx.fillStyle = '#d9b45a'; ctx.fillRect(22, 54, 8, 18); ctx.fillRect(36, 54, 8, 16);
    ctx.fillStyle = '#f7e8c7'; ctx.fillRect(19, 70, 13, 4); ctx.fillRect(35, 68, 13, 4);
    ctx.fillStyle = '#203b35'; ctx.fillRect(27, 18, 3, 3); ctx.fillRect(39, 18, 3, 3);
  }),
  playerB: makeTexture(64, 80, (ctx) => {
    ctx.fillStyle = '#274f43'; ctx.fillRect(22, 21, 22, 37);
    ctx.fillStyle = '#f3c19f'; ctx.beginPath(); ctx.arc(33, 18, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#345e52'; ctx.beginPath(); ctx.arc(31, 12, 14, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e7765a'; ctx.fillRect(10, 29, 25, 7); ctx.fillRect(10, 35, 10, 12);
    ctx.fillStyle = '#d9b45a'; ctx.fillRect(20, 54, 8, 16); ctx.fillRect(38, 54, 8, 18);
    ctx.fillStyle = '#f7e8c7'; ctx.fillRect(16, 68, 14, 4); ctx.fillRect(35, 70, 14, 4);
    ctx.fillStyle = '#203b35'; ctx.fillRect(27, 18, 3, 3); ctx.fillRect(39, 18, 3, 3);
  }),
  cloud: makeTexture(150, 54, (ctx) => {
    ctx.fillStyle = 'rgba(255, 252, 231, 0.72)';
    ctx.beginPath(); ctx.arc(45, 32, 22, 0, Math.PI * 2); ctx.arc(73, 24, 30, 0, Math.PI * 2); ctx.arc(105, 31, 23, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(34, 31, 84, 18);
  }),
  mountain: makeTexture(340, 170, (ctx, width, height) => {
    ctx.fillStyle = '#70978a'; ctx.beginPath(); ctx.moveTo(0, height); ctx.lineTo(0, 112); ctx.lineTo(82, 45); ctx.lineTo(142, 99); ctx.lineTo(216, 28); ctx.lineTo(340, 116); ctx.lineTo(340, height); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(245, 235, 203, 0.36)'; ctx.beginPath(); ctx.moveTo(82, 45); ctx.lineTo(107, 67); ctx.lineTo(76, 63); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(216, 28); ctx.lineTo(248, 52); ctx.lineTo(203, 47); ctx.closePath(); ctx.fill();
  }),
  tree: makeTexture(110, 170, (ctx) => {
    ctx.fillStyle = '#805f49'; ctx.fillRect(47, 73, 18, 93);
    ctx.fillStyle = '#416e58';
    [[28, 70, 28], [58, 56, 34], [80, 82, 25], [46, 29, 26], [20, 102, 25]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#5d8b62';
    [[38, 45, 16], [68, 73, 18], [18, 89, 14]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#f3bb58'; ctx.fillRect(36, 89, 5, 5); ctx.fillRect(70, 50, 4, 4);
  }),
  sun: makeTexture(80, 80, (ctx) => {
    ctx.fillStyle = 'rgba(255, 227, 142, 0.24)'; ctx.beginPath(); ctx.arc(40, 40, 35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f8cf72'; ctx.beginPath(); ctx.arc(40, 40, 22, 0, Math.PI * 2); ctx.fill();
  }),
  star: makeTexture(28, 28, (ctx) => {
    ctx.fillStyle = '#ffe285'; ctx.beginPath();
    for (let i = 0; i < 10; i += 1) { const angle = -Math.PI / 2 + (i * Math.PI) / 5; const radius = i % 2 === 0 ? 12 : 5; const x = 14 + Math.cos(angle) * radius; const y = 14 + Math.sin(angle) * radius; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff8c9'; ctx.fillRect(12, 10, 4, 8);
  }),
  log: makeTexture(70, 40, (ctx) => {
    ctx.fillStyle = '#845b43'; ctx.fillRect(8, 12, 54, 20); ctx.fillStyle = '#a67550'; ctx.beginPath(); ctx.arc(10, 22, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d6a56d'; ctx.beginPath(); ctx.arc(9, 22, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#527b54'; ctx.fillRect(28, 8, 6, 6); ctx.fillRect(46, 26, 6, 6);
  }),
  branch: makeTexture(90, 48, (ctx) => {
    ctx.strokeStyle = '#795541'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(5, 31); ctx.quadraticCurveTo(36, 14, 84, 24); ctx.stroke();
    ctx.fillStyle = '#4e7c5a'; [[25, 15, 11], [49, 10, 13], [71, 19, 10]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
  }),
};

function spawnParticle(x, y, color, count = 5) {
  for (let i = 0; i < count; i += 1) {
    const size = 2 + Math.random() * 3;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color, transparent: true }));
    mesh.position.set(x, HEIGHT - y, 5); world.add(mesh);
    state.particles.push({ mesh, life: 0.4 + Math.random() * 0.25, vx: (Math.random() - 0.5) * 70, vy: (Math.random() - 0.5) * 80 });
  }
}

function buildScene() {
  rect(0, 0, WIDTH, HEIGHT, '#a4d4cb', -5); rect(0, 0, WIDTH, 200, '#a9d8d0', -4); rect(0, 200, WIDTH, 86, '#84b47c', -3);
  rect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y, '#7f9e61', -2); rect(0, GROUND_Y, WIDTH, 6, '#d8d47a', -1); rect(0, GROUND_Y + 6, WIDTH, 7, '#9b714e', -1); rect(0, GROUND_Y + 13, WIDTH, HEIGHT - GROUND_Y - 13, '#a77a53', -1);
  createSprite(textures.sun, 80, 80, 492, 32, -3);

  [[-50, 108, 0.035], [210, 84, 0.02], [480, 130, 0.03]].forEach(([x, y, rate]) => { const sprite = createSprite(textures.mountain, 340, 170, x, y, -2); state.parallax.push({ sprite, width: 340, height: 170, baseX: x, y, rate, wrap: 720 }); });
  [[-80, 70, 0.06], [170, 52, 0.05], [430, 88, 0.07], [650, 42, 0.05]].forEach(([x, y, rate]) => { const sprite = createSprite(textures.cloud, 150, 54, x, y, -1); state.parallax.push({ sprite, width: 150, height: 54, baseX: x, y, rate, wrap: 850 }); });
  [[-30, 132, 0.11], [85, 137, 0.14], [280, 126, 0.12], [455, 140, 0.13], [610, 119, 0.1]].forEach(([x, y, rate]) => { const sprite = createSprite(textures.tree, 110, 170, x, y, 0); state.parallax.push({ sprite, width: 110, height: 170, baseX: x, y, rate, wrap: 760 }); });

  for (let i = 0; i < 14; i += 1) { const blade = rect(i * 56 + 8, GROUND_Y - 4, 3 + (i % 3), 10 + (i % 4) * 3, i % 2 ? '#537d58' : '#6b965d', 0); state.groundDetails.push({ mesh: blade, baseX: i * 56 + 8, width: 56 }); }
  state.player.sprite = createSprite(textures.playerA, 32, 40, PLAYER_X - 16, state.player.y - 3, 4);
}

function updateParallax() {
  state.parallax.forEach((item) => { const cycle = item.wrap; const x = ((item.baseX - state.distance * item.rate) % cycle + cycle) % cycle - item.width; placeSprite(item.sprite, item.width, item.height, x, item.y); });
  state.groundDetails.forEach((item) => { const x = ((item.baseX - state.distance * 0.9) % (WIDTH + item.width) + WIDTH + item.width) % (WIDTH + item.width) - item.width; item.mesh.position.x = x + item.mesh.geometry.parameters.width / 2; });
}

function spawnObstacle() {
  const kind = Math.random() > 0.62 ? 'branch' : 'log';
  const config = kind === 'branch' ? { width: 74, height: 40, y: 220, texture: textures.branch } : { width: 44, height: 25, y: 261, texture: textures.log };
  const sprite = createSprite(config.texture, config.width, config.height, WIDTH + 12, config.y, 3);
  state.obstacles.push({ x: WIDTH + 12, y: config.y, width: config.width, height: config.height, sprite, hit: false });
}

function spawnStar() {
  const y = Math.random() > 0.5 ? 236 : 198;
  const sprite = createSprite(textures.star, 22, 22, WIDTH + 12, y, 3);
  state.collectibles.push({ x: WIDTH + 12, y, width: 22, height: 22, sprite, phase: Math.random() * Math.PI * 2, collected: false });
}

function overlaps(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
function playerBox() { const height = state.player.sliding ? 23 : 36; return { x: PLAYER_X - 12, y: state.player.y + (state.player.sliding ? 13 : 0), width: 24, height }; }

function startAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  if (!window.__forestAudio) window.__forestAudio = new AudioContextClass();
  if (window.__forestAudio.state === 'suspended') window.__forestAudio.resume();
}

function beep(frequency, duration = 0.07, type = 'sine', volume = 0.025) {
  if (!window.__forestAudio) return;
  const audio = window.__forestAudio; const oscillator = audio.createOscillator(); const gain = audio.createGain(); oscillator.type = type; oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration); oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + duration);
}

function jump() { if (state.mode === 'playing') { startAudio(); state.jumpQueued = true; } }

function updatePlayer(delta) {
  state.player.sliding = state.keys.has('ArrowDown') || state.keys.has('s');
  if (state.jumpQueued && state.player.grounded && !state.player.sliding) { state.player.vy = -420; state.player.grounded = false; spawnParticle(PLAYER_X, state.player.y + 35, '#f3bb58', 5); beep(390, 0.09, 'triangle', 0.03); }
  state.jumpQueued = false; state.player.vy += 1050 * delta; state.player.y += state.player.vy * delta;
  const playerHeight = 36;
  if (state.player.y >= GROUND_Y - playerHeight) { state.player.y = GROUND_Y - playerHeight; state.player.vy = 0; state.player.grounded = true; }
  state.player.invulnerable = Math.max(0, state.player.invulnerable - delta);
  const animationFrame = Math.floor(state.time * 9) % 2;
  if (animationFrame !== state.player.animationFrame) { state.player.animationFrame = animationFrame; state.player.sprite.material.map = animationFrame === 0 ? textures.playerA : textures.playerB; state.player.sprite.material.needsUpdate = true; }
  const spriteHeight = state.player.sliding ? 27 : 40; placeSprite(state.player.sprite, 32, spriteHeight, PLAYER_X - 16, state.player.y - (state.player.sliding ? 2 : 4));
  state.player.sprite.material.opacity = state.player.invulnerable > 0 && Math.floor(state.time * 18) % 2 ? 0.35 : 1;
}

function hitObstacle(obstacle) {
  obstacle.hit = true; obstacle.sprite.visible = false; state.hp = Math.max(0, state.hp - 1); state.player.invulnerable = 1.05; spawnParticle(PLAYER_X, state.player.y + 18, '#e9785d', 9); beep(110, 0.14, 'sawtooth', 0.04); if (state.hp === 0) finishRun(false);
}

function updateObstacles(delta) {
  const player = playerBox();
  state.obstacles = state.obstacles.filter((obstacle) => { obstacle.x -= state.speed * delta; placeSprite(obstacle.sprite, obstacle.width, obstacle.height, obstacle.x, obstacle.y); if (!obstacle.hit && state.player.invulnerable <= 0 && overlaps(player, obstacle)) hitObstacle(obstacle); if (obstacle.x < -obstacle.width - 20) { world.remove(obstacle.sprite); return false; } return true; });
}

function updateCollectibles(delta) {
  const player = playerBox();
  state.collectibles = state.collectibles.filter((item) => { item.x -= state.speed * delta; item.phase += delta * 5; placeSprite(item.sprite, item.width, item.height, item.x, item.y + Math.sin(item.phase) * 4); if (!item.collected && overlaps(player, { x: item.x - 4, y: item.y - 4, width: item.width + 8, height: item.height + 8 })) { item.collected = true; item.sprite.visible = false; state.stars += 1; state.score += 50; spawnParticle(item.x + 10, item.y + 10, '#ffe285', 8); beep(760, 0.11, 'sine', 0.035); } if (item.x < -30) { world.remove(item.sprite); return false; } return true; });
}

function updateParticles(delta) {
  state.particles = state.particles.filter((particle) => { particle.life -= delta; particle.mesh.position.x += particle.vx * delta; particle.mesh.position.y -= particle.vy * delta; particle.mesh.material.opacity = Math.max(0, particle.life * 2.6); if (particle.life <= 0) { world.remove(particle.mesh); return false; } return true; });
}

function finishRun(won) {
  if (state.mode !== 'playing') return;
  state.mode = won ? 'won' : 'lost'; resultPanel.classList.remove('hidden'); resultKicker.textContent = won ? '旅程完成' : '风声停下'; resultTitle.textContent = won ? '抵达山谷' : '再试一次'; resultCopy.textContent = won ? `你跑过了林间小路，收集了 ${state.stars} 颗萤火，带着 ${state.score} 分抵达终点。` : '树根挡住了去路。调整节奏，再沿着风的方向出发。'; runState.textContent = won ? '旅程完成' : '需要重启'; document.querySelector('.run-dot').style.background = won ? '#f3bb58' : '#e9785d'; beep(won ? 620 : 70, 0.28, won ? 'sine' : 'sawtooth', 0.035);
}

function syncHud() {
  const progress = Math.min(100, (state.distance / RUN_LENGTH) * 100); healthFill.style.width = `${(state.hp / 3) * 100}%`; healthValue.textContent = String(state.hp); distanceValue.textContent = `${String(Math.floor(state.distance)).padStart(3, '0')}m`; distanceFill.style.width = `${progress}%`; starValue.textContent = String(state.stars).padStart(3, '0'); missionStatus.textContent = state.distance >= RUN_LENGTH ? '完成' : '进行中'; missionStatus.style.color = state.distance >= RUN_LENGTH ? 'var(--sun)' : 'var(--forest)'; starStatus.textContent = `${Math.min(state.stars, STAR_TARGET)} / ${STAR_TARGET}`; exitStatus.textContent = `${Math.floor(progress)}%`;
}

function updateGame(delta) {
  state.time += delta; state.speed = Math.min(305, 178 + state.distance * 0.045); state.distance += state.speed * delta; state.score += Math.floor(state.speed * delta * 0.05); state.spawnTimer -= delta; state.starTimer -= delta;
  if (state.spawnTimer <= 0) { spawnObstacle(); state.spawnTimer = Math.max(0.72, 1.14 - state.distance / 6200) + Math.random() * 0.35; }
  if (state.starTimer <= 0) { spawnStar(); state.starTimer = 0.65 + Math.random() * 0.75; }
  updatePlayer(delta); updateObstacles(delta); updateCollectibles(delta); updateParticles(delta); updateParallax(); syncHud(); if (state.distance >= RUN_LENGTH) finishRun(true);
}

function frame() { const delta = Math.min(clock.getDelta(), 0.05); if (state.mode === 'playing') updateGame(delta); renderer.render(scene, camera); requestAnimationFrame(frame); }
function normalizeKey(key) { return key.length === 1 ? key.toLowerCase() : key; }

window.addEventListener('keydown', (event) => { const key = normalizeKey(event.key); if (['ArrowUp', 'ArrowDown', ' ', 'w', 's'].includes(key)) event.preventDefault(); if (!event.repeat && [' ', 'ArrowUp', 'w'].includes(key)) jump(); if (key === 'r' && state.mode !== 'playing') window.location.reload(); state.keys.add(key); startAudio(); });
window.addEventListener('keyup', (event) => state.keys.delete(normalizeKey(event.key)));
window.addEventListener('blur', () => state.keys.clear());
document.querySelector('#restart-button').addEventListener('click', () => window.location.reload());

function bindTouchButton(button, action) {
  const press = (event) => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); if (action === 'jump') jump(); if (action === 'slide') { startAudio(); state.keys.add('ArrowDown'); } };
  const release = (event) => { event.preventDefault(); state.keys.delete('ArrowDown'); };
  button.addEventListener('pointerdown', press); button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('pointerleave', release);
}

bindTouchButton(document.querySelector('#touch-jump'), 'jump');
bindTouchButton(document.querySelector('#touch-slide'), 'slide');

buildScene();
syncHud();
frame();

import * as THREE from '/vendor/three.module.js';

const $ = (id) => document.getElementById(id);
const ROUND_MS = 30_000;
const canvas = $('game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
} catch {
  $('start').disabled = true;
  $('status').textContent = 'This game needs a browser with WebGL enabled.';
  throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#d6e2ba');
const camera = new THREE.OrthographicCamera(-6, 6, 5, -5, 0.1, 70);
camera.position.set(0, 11, 13);
camera.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight(0xfff9e8, 0x63834d, 2.6));
const sunlight = new THREE.DirectionalLight(0xfff5d7, 3);
sunlight.position.set(-5, 12, 7);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(1024, 1024);
Object.assign(sunlight.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
scene.add(sunlight);

const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, ...extra });
const fur = material('#9b6b4b');
const cream = material('#e9c9a3');
const dark = material('#292d28');
const pink = material('#d9957f');
const soil = material('#4b3e2e');
const grass = material('#9bb871');
function mesh(geometry, mat, parent, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function ball(parent, mat, x, y, z, sx, sy = sx, sz = sx) {
  const object = mesh(new THREE.SphereGeometry(1, 24, 16), mat, parent, x, y, z);
  object.scale.set(sx, sy, sz);
  return object;
}
const ground = mesh(new THREE.BoxGeometry(9.5, .32, 8.8), grass, scene, 0, -.22, 0);
ground.castShadow = false;
const holes = [];
for (let index = 0; index < 9; index++) {
  const x = (index % 3 - 1) * 2.6;
  const z = (Math.floor(index / 3) - 1) * 2.5;
  const disk = mesh(new THREE.CircleGeometry(.78, 48), soil, scene, x, -.048, z);
  disk.rotation.x = -Math.PI / 2;
  const rim = mesh(new THREE.TorusGeometry(.79, .12, 10, 40), material('#789453'), scene, x, .01, z);
  rim.rotation.x = -Math.PI / 2;
  const group = new THREE.Group();
  group.position.set(x, .02, z);
  scene.add(group);
  ball(group, fur, 0, .48, 0, .61, .78, .56);
  ball(group, fur, -.47, 1.05, 0, .2);
  ball(group, fur, .47, 1.05, 0, .2);
  ball(group, pink, -.47, 1.07, .14, .11);
  ball(group, pink, .47, 1.07, .14, .11);
  ball(group, cream, 0, .56, .46, .4, .29, .18);
  ball(group, dark, -.23, .91, .49, .075);
  ball(group, dark, .23, .91, .49, .075);
  ball(group, material('#ffffff'), -.25, .94, .55, .022);
  ball(group, material('#ffffff'), .21, .94, .55, .022);
  ball(group, pink, 0, .7, .65, .115, .075, .085);
  const tooth = mesh(new THREE.BoxGeometry(.14, .14, .08), material('#fff9e8'), group, 0, .39, .62);
  tooth.rotation.z = .06;
  group.scale.y = 0;
  group.visible = false;
  group.traverse(child => { child.userData.hole = index; });
  holes.push({ group, active: false, until: 0, height: 0 });
}
// Little pebbles and daisies around the board, all generated locally.
for (let i = 0; i < 18; i++) {
  const side = i % 2 ? -1 : 1;
  const x = side * (4.05 + .12 * Math.sin(i * 3));
  const z = -3.6 + (i / 18) * 7.2;
  if (i % 3 === 0) {
    ball(scene, material('#b5bf91'), x, .06, z, .14, .09, .11);
  } else {
    const stalk = mesh(new THREE.CylinderGeometry(.018, .025, .28, 5), material('#567a42'), scene, x, .12, z);
    stalk.castShadow = false;
    ball(scene, material('#ebbe54'), x, .28, z, .065);
    for (let p = 0; p < 5; p++) {
      const a = p * Math.PI * 2 / 5;
      ball(scene, material('#fff7dd'), x + Math.cos(a) * .09, .28, z + Math.sin(a) * .09, .065, .025, .065);
    }
  }
}

function resize() {
  const { width, height } = canvas.getBoundingClientRect();
  renderer.setSize(width, height, false);
  const aspect = width / height;
  const halfHeight = Math.max(5.1, 5.2 / aspect);
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($('arena'));
resize();

let playing = false;
let score = 0;
let finalScore = 0;
let deadline = 0;
let nextSpawn = 0;
let previous = performance.now();
let saved = false;
let submitting = false;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function startGame() {
  if (submitting) return;
  $('result').close();
  holes.forEach(h => { h.active = false; h.height = 0; h.group.visible = false; });
  score = 0;
  saved = false;
  $('score').textContent = '000';
  $('time').textContent = '30';
  $('splash').hidden = true;
  $('status').textContent = 'Go! Bop those moles.';
  $('start').textContent = 'Play another round ↗';
  playing = true;
  const now = performance.now();
  deadline = now + ROUND_MS;
  nextSpawn = now;
  canvas.focus({ preventScroll: true });
}
function finishGame() {
  if (!playing) return;
  playing = false;
  finalScore = score;
  holes.forEach(h => { h.active = false; });
  $('time').textContent = '0';
  $('status').textContent = `Round over · ${finalScore} points`;
  $('final-score').textContent = String(finalScore);
  $('submit-status').textContent = '';
  $('submit-score').disabled = false;
  $('submit-score').textContent = 'Save my score ↗';
  $('splash').hidden = false;
  $('result').showModal();
}
function hit(index, clientX, clientY) {
  if (!playing) return;
  if (performance.now() >= deadline) { finishGame(); return; }
  const hole = holes[index];
  if (!hole.active || hole.height < .45 || performance.now() >= hole.until) return;
  hole.active = false;
  score += 10;
  $('score').textContent = String(score).padStart(3, '0');
  $('status').textContent = 'Nice catch! +10';
  const bounds = canvas.getBoundingClientRect();
  if (clientX === undefined) {
    const point = hole.group.position.clone();
    point.y = 1;
    point.project(camera);
    clientX = bounds.left + (point.x + 1) * bounds.width / 2;
    clientY = bounds.top + (1 - point.y) * bounds.height / 2;
  }
  const floater = $('float');
  floater.style.left = `${clientX - bounds.left}px`;
  floater.style.top = `${clientY - bounds.top}px`;
  floater.classList.remove('pop');
  void floater.offsetWidth;
  floater.classList.add('pop');
}
canvas.addEventListener('pointerdown', event => {
  if (!playing) return;
  const bounds = canvas.getBoundingClientRect();
  pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
    -(event.clientY - bounds.top) / bounds.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const targets = holes.filter(h => h.active && h.height >= .45).map(h => h.group);
  const intersection = raycaster.intersectObjects(targets, true)[0];
  if (intersection) hit(intersection.object.userData.hole, event.clientX, event.clientY);
});
canvas.addEventListener('keydown', event => {
  const index = 'qweasdzxc'.indexOf(event.key.toLowerCase());
  if (index >= 0 && !event.repeat) { event.preventDefault(); hit(index); }
});
$('start').addEventListener('click', startGame);
$('play-again').addEventListener('click', startGame);

function animate(now) {
  const delta = Math.min((now - previous) / 1000, .06);
  previous = now;
  if (playing && now >= deadline) finishGame();
  if (playing) {
    $('time').textContent = String(Math.ceil((deadline - now) / 1000));
    if (now >= nextSpawn) {
      const available = holes.filter(h => !h.active && h.height < .1);
      if (available.length) {
        const hole = available[Math.floor(Math.random() * available.length)];
        hole.active = true;
        hole.until = now + 950 + Math.random() * 350;
      }
      const progress = 1 - (deadline - now) / ROUND_MS;
      nextSpawn = now + 620 - progress * 260;
    }
  }
  for (const hole of holes) {
    if (hole.active && now >= hole.until) hole.active = false;
    const target = hole.active ? 1 : 0;
    hole.height = reducedMotion ? target : THREE.MathUtils.damp(hole.height, target, 18, delta);
    hole.group.visible = hole.height > .015;
    hole.group.scale.y = Math.max(.001, hole.height);
  }
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, signal: AbortSignal.timeout(8000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
async function loadScores() {
  $('refresh').disabled = true;
  try {
    const { highscores } = await api('/api/highscores');
    $('leaders').replaceChildren();
    highscores.forEach((entry, index) => {
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = String(index + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.className = 'player';
      name.textContent = entry.name;
      li.title = `Scored on ${new Date(entry.timestamp).toLocaleString()}`;
      const points = document.createElement('span');
      points.className = 'points';
      points.textContent = String(entry.score);
      li.append(rank, name, points);
      $('leaders').append(li);
    });
    $('leader-message').textContent = highscores.length ? '' : 'No legends yet. Be the first.';
  } catch {
    $('leader-message').textContent = 'Could not load scores. Check the server and refresh.';
  } finally { $('refresh').disabled = false; }
}
$('refresh').addEventListener('click', loadScores);
$('score-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (saved || submitting || playing) return;
  const name = $('player-name').value.trim();
  if (!name) { $('submit-status').textContent = 'Please enter your name.'; return; }
  submitting = true;
  $('submit-score').disabled = true;
  $('play-again').disabled = true;
  $('start').disabled = true;
  $('submit-status').textContent = 'Saving your moment of glory…';
  try {
    await api('/api/highscores', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score: finalScore }) });
    saved = true;
    $('submit-score').textContent = 'Score saved ✓';
    $('submit-status').textContent = 'Saved! Only the top 10 appear on the board.';
    await loadScores();
  } catch (error) {
    $('submit-status').textContent = `Could not confirm the save: ${error.message} Refresh the leaderboard before retrying.`;
    $('submit-score').disabled = false;
  } finally {
    submitting = false;
    $('play-again').disabled = false;
    $('start').disabled = false;
  }
});
$('result').addEventListener('cancel', event => { if (submitting) event.preventDefault(); });
loadScores();

import * as THREE from 'three';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const distanceEl = document.querySelector<HTMLElement>('#distance')!;
const coinsEl = document.querySelector<HTMLElement>('#coins')!;
const bestEl = document.querySelector<HTMLElement>('#best')!;
const center = document.querySelector<HTMLDivElement>('#center')!;
const headline = document.querySelector<HTMLElement>('#headline')!;
const message = document.querySelector<HTMLElement>('#message')!;
const startButton = document.querySelector<HTMLButtonElement>('#start')!;
const powerEl = document.querySelector<HTMLElement>('#power')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07111f);
scene.fog = new THREE.Fog(0x07111f, 22, 105);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 180);
camera.position.set(0, 5.2, 10.5);
camera.lookAt(0, 1.2, -8);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x9fd8ff, 0x142033, 2));
const key = new THREE.DirectionalLight(0xffffff, 2.5);
key.position.set(-5, 12, 7); key.castShadow = true; scene.add(key);
const glow = new THREE.PointLight(0x1a9fff, 25, 35);
glow.position.set(0, 5, -15); scene.add(glow);

const mat = (color: number, roughness = 0.65, metalness = 0.05) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(13, 180), mat(0x172b42));
floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -45); floor.receiveShadow = true; scene.add(floor);
for (const x of [-2.1, 2.1]) {
  const line = new THREE.Mesh(new THREE.BoxGeometry(.045, .025, 180), mat(0x3e7194));
  line.position.set(x, .025, -45); scene.add(line);
}
for (const x of [-4.6, 4.6]) {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(.12, .22, 180), mat(0x1c4e73, .35, .6));
  rail.position.set(x, .12, -45); scene.add(rail);
}
const grid = new THREE.GridHelper(180, 90, 0x245579, 0x17334d);
grid.position.set(0, .035, -45); scene.add(grid);

const runner = new THREE.Group(); scene.add(runner); runner.position.set(0, 0, 2);
const body = new THREE.Mesh(new THREE.CapsuleGeometry(.42, .8, 5, 10), mat(0x29b8ff, .35, .25));
body.position.y = 1.05; body.castShadow = true; runner.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(.31, 16, 12), mat(0xf1c7a5));
head.position.y = 1.82; head.castShadow = true; runner.add(head);
const visor = new THREE.Mesh(new THREE.BoxGeometry(.42, .12, .08), mat(0x061b30, .2, .4));
visor.position.set(0, 1.85, .27); runner.add(visor);
const pack = new THREE.Mesh(new THREE.BoxGeometry(.55, .58, .25), mat(0x12466d));
pack.position.set(0, 1, -.38); runner.add(pack);

const lanes = [-2.1, 0, 2.1];
let lane = 1, jumpLeft = 0, slideLeft = 0, speed = 17;
let distance = 0, coins = 0, best = Number(localStorage.getItem('runner-best') || 0);
let running = false, ended = false, spawnTimer = 0, coinTimer = 0;
let magnet = 0, shield = 0, doubleScore = 0;
bestEl.textContent = best + ' м';

type Kind = 'block' | 'barrier' | 'coin' | 'magnet' | 'shield' | 'double';
type Thing = { mesh: THREE.Mesh; z: number; kind: Kind; hit: boolean };
const things: Thing[] = [];
function addThing(kind: Kind, laneIndex: number, z = -100) {
  const material = kind === 'coin' ? mat(0xffcf42, .25, .65)
    : kind === 'magnet' ? mat(0x53e5ff, .25, .45)
    : kind === 'shield' ? mat(0x7dffae, .25, .45)
    : kind === 'double' ? mat(0xd69aff, .25, .45)
    : kind === 'block' ? mat(0xe15d65, .55, .15) : mat(0xffa34b, .55, .15);
  const geometry = kind === 'coin' ? new THREE.TorusGeometry(.34, .11, 8, 18)
    : kind === 'block' ? new THREE.BoxGeometry(1.15, 1.35, 1)
    : kind === 'barrier' ? new THREE.BoxGeometry(1.5, .65, .8)
    : new THREE.IcosahedronGeometry(.38, 1);
  const mesh = new THREE.Mesh(geometry, material);
  if (kind === 'coin') mesh.rotation.y = Math.PI / 2;
  mesh.position.set(lanes[laneIndex], kind === 'coin' ? 1.15 : kind === 'barrier' ? .35 : kind === 'block' ? .75 : 1.35, z);
  mesh.castShadow = true; scene.add(mesh); things.push({ mesh, z, kind, hit: false });
}
function spawnPattern() {
  const r = Math.random(), l = Math.floor(Math.random() * 3);
  if (r < .13) addThing('magnet', l);
  else if (r < .22) addThing('shield', l);
  else if (r < .29) addThing('double', l);
  else if (r < .55) addThing('barrier', l);
  else if (r < .84) addThing('block', l);
  else { addThing('block', l); addThing('coin', (l + 1) % 3); }
}
function reset() {
  for (const t of things) scene.remove(t.mesh);
  things.length = 0;
  lane = 1; jumpLeft = 0; slideLeft = 0; speed = 17; distance = 0; coins = 0;
  spawnTimer = 0; coinTimer = 0; magnet = 0; shield = 0; doubleScore = 0;
  runner.position.set(0, 0, 2); runner.scale.y = 1;
  running = true; ended = false; center.style.display = 'none'; powerEl.textContent = '';
  distanceEl.textContent = '0 м'; coinsEl.textContent = '0';
}
function finish() {
  if (ended) return;
  running = false; ended = true;
  best = Math.max(best, Math.floor(distance));
  localStorage.setItem('runner-best', String(best)); bestEl.textContent = best + ' м';
  headline.textContent = 'ЗАБЕГ ОКОНЧЕН';
  message.textContent = `Дистанция: ${Math.floor(distance)} м · Монеты: ${coins}`;
  startButton.textContent = 'ЕЩЁ ОДИН ЗАБЕГ'; center.style.display = 'flex';
}
function move(dir: number) { if (running) lane = Math.max(0, Math.min(2, lane + dir)); }
function jump() { if (running && jumpLeft <= 0.05 && slideLeft <= 0) jumpLeft = .72; }
function slide() { if (running && jumpLeft <= 0) slideLeft = .62; }
let touchX = 0, touchY = 0;
renderer.domElement.addEventListener('touchstart', e => {
  touchX = e.changedTouches[0].clientX; touchY = e.changedTouches[0].clientY;
}, { passive: true });
renderer.domElement.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
  else if (dy < 0) jump(); else slide();
}, { passive: true });
addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') move(-1);
  if (e.key === 'ArrowRight' || e.key === 'd') move(1);
  if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') jump();
  if (e.key === 'ArrowDown' || e.key === 's') slide();
});
startButton.addEventListener('click', reset);

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), .04);
  if (running) {
    speed = Math.min(29, speed + dt * .12); distance += speed * dt;
    distanceEl.textContent = Math.floor(distance) + ' м';
    runner.position.x = THREE.MathUtils.damp(runner.position.x, lanes[lane], 14, dt);
    if (jumpLeft > 0) {
      jumpLeft -= dt;
      runner.position.y = Math.sin((.72 - jumpLeft) / .72 * Math.PI) * 1.55;
      if (jumpLeft <= 0) runner.position.y = 0;
    }
    if (slideLeft > 0) { slideLeft -= dt; runner.scale.y = .55; }
    else runner.scale.y = 1;
    runner.rotation.z = THREE.MathUtils.damp(runner.rotation.z, (lanes[lane] - runner.position.x) * -.08, 10, dt);
    runner.position.z = 2 + Math.sin(distance * .4) * .035;
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnPattern(); spawnTimer = Math.max(.48, 1.12 - (speed - 17) * .025); }
    coinTimer -= dt;
    if (coinTimer <= 0) { for (let i = 0; i < 4; i++) addThing('coin', lane, -65 - i * 2.1); coinTimer = 2.3; }
    magnet = Math.max(0, magnet - dt); shield = Math.max(0, shield - dt); doubleScore = Math.max(0, doubleScore - dt);
    for (let i = things.length - 1; i >= 0; i--) {
      const t = things[i]; t.z += speed * dt; t.mesh.position.z = t.z;
      if (t.kind === 'coin' || t.kind === 'magnet' || t.kind === 'shield' || t.kind === 'double') t.mesh.rotation.y += dt * 2.5;
      if (t.kind === 'coin' && magnet > 0 && Math.abs(t.z - 2) < 9)
        t.mesh.position.x = THREE.MathUtils.damp(t.mesh.position.x, runner.position.x, 5, dt);
      const close = Math.abs(t.z - 2) < .85 && Math.abs(t.mesh.position.x - runner.position.x) < .8;
      if (close && !t.hit) {
        t.hit = true;
        if (t.kind === 'coin') {
          coins += doubleScore > 0 ? 2 : 1; coinsEl.textContent = String(coins);
          scene.remove(t.mesh); things.splice(i, 1); continue;
        }
        if (t.kind === 'magnet' || t.kind === 'shield' || t.kind === 'double') {
          if (t.kind === 'magnet') { magnet = 8; powerEl.textContent = 'МАГНИТ · 8 СЕК'; }
          if (t.kind === 'shield') { shield = 8; powerEl.textContent = 'ЩИТ · 8 СЕК'; }
          if (t.kind === 'double') { doubleScore = 8; powerEl.textContent = '×2 МОНЕТЫ · 8 СЕК'; }
          scene.remove(t.mesh); things.splice(i, 1); continue;
        }
        const avoided = t.kind === 'barrier' ? jumpLeft > .12 : slideLeft > .12;
        if (!avoided) {
          if (shield > 0) { shield = 0; powerEl.textContent = 'ЩИТ ПОГЛОТИЛ УДАР'; }
          else { finish(); break; }
        }
      }
      if (t.z > 8) { scene.remove(t.mesh); things.splice(i, 1); }
    }
    camera.position.x = THREE.MathUtils.damp(camera.position.x, runner.position.x * .18, 2, dt);
    camera.lookAt(runner.position.x * .12, 1.1, -8);
  }
  renderer.render(scene, camera);
}
frame();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
});
import './style.css';
import * as THREE from 'three';
import { AsciiRenderer } from './renderer/ascii';
import { SignLayer } from './renderer/signs';
import { WorldData } from './world/data';
import { TownScene } from './world/scene';
import { Walker } from './movement/controller';
import { TownLife } from './simulation/actors';
import { mapText } from './app/minimap';
import { Navigation, bearing, cardinal, compassTape } from './app/navigation';
import { warsawDestinations, warsawLandmarkViews } from './app/destinations';
import type { Pose } from './world/types';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (id: string, value = true) => $(id).classList.toggle('hidden', !value);
const canvas = $<HTMLCanvasElement>('world');
let renderer: AsciiRenderer, world: TownScene, data: WorldData, walker: Walker, life: TownLife;
let navigation: Navigation;
let resumeAfterMap = false;
let lastBearing = -1;
let selectedDestination: string | undefined;
let resumeAfterSelector = false;
let selectorTravelled = false;
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.15, 5000);
let started = false,
  paused = true,
  ready = false,
  mapOpen = false,
  lastTime = performance.now(),
  accumulator = 0,
  elapsed = 0,
  lastHUD = 0,
  lastSave = 0;
const frameTimes: number[] = [];
let settings = {
  density: 'balanced',
  palette: 'color',
  contrast: 1.25,
  sensitivity: 1,
  fov: 70,
  activity: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'still' : 'live',
};
try {
  settings = { ...settings, ...JSON.parse(localStorage.getItem('ascii-walk.settings') ?? '{}') };
} catch {
  /* Invalid local settings are replaced by defaults. */
}
let noticeTimer: ReturnType<typeof setTimeout>;
function notify(text: string) {
  clearTimeout(noticeTimer);
  $('notice').textContent = text;
  show('notice');
  noticeTimer = setTimeout(() => show('notice', false), Math.max(4500, Math.min(14000, text.length * 45)));
}
function save() {
  try {
    localStorage.setItem('ascii-walk.settings', JSON.stringify(settings));
    if (ready)
      localStorage.setItem(
        `ascii-walk.pose.${data.manifest.id}`,
        JSON.stringify({
          revision: data.manifest.revision,
          pose: walker.pose,
          distance: walker.distance,
          destination: selectedDestination,
        }),
      );
  } catch {
    /* Storage is optional. */
  }
}
function applySettings() {
  renderer.density(settings.density);
  renderer.pass.uniforms.uMono.value = settings.palette === 'mono' ? 1 : 0;
  renderer.pass.uniforms.uContrast.value = settings.contrast;
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
  if (walker) walker.sensitivity = settings.sensitivity;
  if (world) world.recreation.live = world.places.live = settings.activity !== 'still';
  $('color-toggle').textContent = settings.palette === 'mono' ? '[c] Mono' : '[c] Color';
  for (const key of ['density', 'palette', 'contrast', 'sensitivity', 'fov', 'activity'] as const)
    $<HTMLInputElement>(key).value = String(settings[key]);
}
function pause(value: boolean) {
  if (!ready) return;
  paused = value;
  walker.enabled = !value;
  if (value) {
    walker.keys.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    save();
  }
  show('pause', value && started);
  show('look-hint', !value && document.pointerLockElement !== canvas);
}
function begin() {
  started = true;
  document.body.classList.add('walking');
  show('intro', false);
  pause(false);
  canvas.focus();
  if (mapOpen) {
    mapOpen = false;
    show('map-panel', false);
    $('map-toggle').classList.remove('active');
  }
}
function dialog(id: string) {
  if (mapOpen) toggleMap();
  pause(true);
  show('pause', false);
  $<HTMLDialogElement>(id).showModal();
}
function openDestinations() {
  if (!ready || data.manifest.id !== 'warsaw') return;
  resumeAfterSelector = started && !paused;
  selectorTravelled = false;
  dialog('destinations');
}
function updateDestinationSelection() {
  document.querySelectorAll<HTMLButtonElement>('[data-destination]').forEach((button) => {
    if (button.dataset.destination === selectedDestination) button.setAttribute('aria-current', 'location');
    else button.removeAttribute('aria-current');
  });
}
function visit(pose: Pose, name: string, destinationId?: string) {
  if (!walker.teleport(pose)) return false;
  selectedDestination = destinationId;
  walker.dragging = false;
  world.update(pose.x, pose.z, true);
  const selector = $<HTMLDialogElement>('destinations');
  if (selector.open) {
    selectorTravelled = true;
    selector.close();
  }
  begin();
  updateDestinationSelection();
  updateHUD();
  save();
  notify(`Arrived at ${name}`);
  return true;
}
function returnToStart() {
  const destination = warsawDestinations.find((d) => d.id === selectedDestination);
  if (!destination || !walker.teleport(destination.pose)) walker.reset();
  world.update(walker.pose.x, walker.pose.z, true);
  updateHUD();
  save();
  notify(destination ? `Back at ${destination.name}` : 'Returned to your starting point');
}
async function load(id: string) {
  ready = false;
  $<HTMLButtonElement>('destinations-open').disabled = true;
  show('loading');
  $('loading-label').textContent = 'Finding our way';
  try {
    const nextData = await WorldData.load(id, (text) => {
      $('loading-label').textContent = text;
    });
    if (walker) walker.dispose();
    if (life) life.dispose();
    if (world) world.dispose();
    data = nextData;
    navigation = new Navigation(data);
    await document.fonts.load('500 21px "IBM Plex Mono"');
    if (!renderer) renderer = new AsciiRenderer(canvas);
    renderer.signs?.dispose();
    world = new TownScene(data);
    renderer.signs = new SignLayer(data, world.places.signs);
    walker = new Walker(data, camera, canvas, [...world.recreation.obstacles, ...world.places.obstacles]);
    walker.reset();
    selectedDestination = id === 'warsaw' ? 'monument' : undefined;
    life = new TownLife(data, world.material, (x, z) => walker.blocked(x, z));
    world.scene.add(life.group);
    walker.onUnlock = () => {
      if (ready && started && !paused) pause(true);
    };
    try {
      const saved = JSON.parse(localStorage.getItem(`ascii-walk.pose.${id}`) ?? 'null');
      if (saved?.revision === data.manifest.revision && walker.teleport(saved.pose)) {
        walker.distance = Number(saved.distance) || 0;
        if (id === 'warsaw' && warsawDestinations.some((d) => d.id === saved.destination))
          selectedDestination = saved.destination;
      }
    } catch {
      /* A stale bookmark never prevents loading. */
    }
    $('location-name').textContent = data.manifest.name.toUpperCase();
    document.title = `ASCII Walk - ${data.manifest.name}`;
    $('start').textContent = `Explore ${data.manifest.name.split(',')[0]} ->`;
    document.querySelector('.intro-copy')!.textContent =
      `Take the long way through ${data.manifest.name.split(',')[0]}. Real streets, rolling hills, and a little life between the letters.`;
    document.querySelector('#pause h2')!.textContent = `A moment in ${data.manifest.name.split(',')[0]}.`;
    document.querySelector('.intro .eyebrow')!.textContent = data.manifest.curated
      ? 'FIELD NOTES 001 / NEW YORK'
      : 'PREPARED AREA / UNITED STATES';
    $('reset').textContent = 'Return to start';
    for (const key of ['destinations-open', 'intro-destinations', 'pause-destinations'])
      show(key, id === 'warsaw');
    $('destination-list').replaceChildren(
      ...(id === 'warsaw' ? warsawDestinations : []).map((d) => {
        const button = document.createElement('button');
        button.dataset.destination = d.id;
        const title = document.createElement('strong');
        title.textContent = d.title;
        const name = document.createElement('span');
        name.textContent = d.name;
        const address = document.createElement('small');
        address.textContent = d.address;
        button.append(title, name, address);
        button.onclick = () => {
          if (!visit(d.pose, d.name, d.id))
            notify('That starting point is blocked. Choose another location.');
        };
        return button;
      }),
    );
    updateDestinationSelection();
    $('source-list').replaceChildren(
      ...data.manifest.sources.map((source) => {
        const a = document.createElement('a');
        a.href = source.url;
        a.textContent = source.name + (source.release ? ` / ${source.release}` : '');
        a.target = '_blank';
        a.rel = 'noreferrer';
        return a;
      }),
    );
    $('landmarks').replaceChildren(
      ...data.features.landmarks
        .filter((l) => !/City Hall/i.test(l.name))
        .sort((a, b) => {
          const order = ['4712378931', '478525896', '477983260:facade-5-0', '664425605'];
          const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : 4);
          return rank(a.id) - rank(b.id);
        })
        .slice(0, 9)
        .map((l) => {
          const button = document.createElement('button');
          button.textContent = `> ${l.name.replace("Soldiers' and Sailors' ", '')}`;
          button.onclick = () => {
            const destination =
              data.manifest.id === 'warsaw'
                ? warsawDestinations.find((d) => d.featureId === l.id)
                : undefined;
            const arrive = (pose: Pose) => visit(pose, l.name, destination?.id);
            if (
              data.manifest.id === 'warsaw' &&
              warsawLandmarkViews[l.id] &&
              arrive(warsawLandmarkViews[l.id])
            )
              return;
            for (let radius = 15; radius < 70; radius += 3)
              for (let a = 0; a < 16; a++) {
                const angle = (a * Math.PI) / 8,
                  pose = {
                    x: l.x + Math.cos(angle) * radius,
                    z: l.z + Math.sin(angle) * radius,
                    yaw: Math.atan2(Math.cos(angle), Math.sin(angle)),
                  };
                const near = data.nearbyRoad(pose.x, pose.z);
                if (near && near.distance < near.road.width / 2 + 3 && arrive(pose)) return;
              }
          };
          return button;
        }),
    );
    ready = true;
    $<HTMLButtonElement>('destinations-open').disabled = false;
    started = false;
    paused = true;
    document.body.classList.remove('walking');
    applySettings();
    resize();
    show('loading', false);
    show('intro');
    show('pause', false);
    const params = new URLSearchParams(location.search);
    if (params.has('debug')) renderer.pass.uniforms.uDebug.value = Number(params.get('debug')) || 0;
    updateHUD();
  } catch (error) {
    if (world) {
      ready = true;
      $<HTMLButtonElement>('destinations-open').disabled = false;
      show('loading', false);
      notify(`Unable to open that world: ${error instanceof Error ? error.message : String(error)}`);
      pause(true);
    } else {
      $('loading-label').textContent = error instanceof Error ? error.message : String(error);
      $('loading').querySelector('small')!.textContent =
        'Reload to try again. The prepared world remains saved.';
    }
    console.error(error);
  }
}
function resize() {
  if (!renderer) return;
  renderer.resize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
function updateHUD() {
  if (!ready) return;
  const p = walker.pose,
    description = navigation.describe(p);
  $('street-name').textContent = description.street;
  $('cross-street').textContent = description.crossing;
  $('distance').textContent =
    walker.distance < 1000 ? `${Math.round(walker.distance)} m` : `${(walker.distance / 1000).toFixed(2)} km`;
  $('elevation').textContent =
    `${Math.round(data.ground(p.x, p.z) + data.manifest.origin.elevation)} m elevation`;
  updateCompass();
  if (mapOpen) {
    $('ascii-map').textContent = mapText(data, p, 51, 21);
    const nearby = navigation.junctions
      .map((j) => ({ ...j, d: Math.hypot(j.x - p.x, j.z - p.z) }))
      .filter((j) => j.d < 200)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    $('map-streets').textContent = nearby
      .map(
        (j) =>
          `${Math.round(j.d)} m ${cardinal(bearing(Math.atan2(p.x - j.x, p.z - j.z)))} / ${[...new Set(j.names.map((n) => n.replace(/^(North|South|East|West) /, '')))].join(' & ')}`,
      )
      .join('\n');
  }
}
function updateCompass() {
  const degrees = Math.round(bearing(walker.pose.yaw)) % 360;
  if (degrees === lastBearing) return;
  lastBearing = degrees;
  $('heading').textContent = `${cardinal(degrees)} / ${degrees.toString().padStart(3, '0')}`;
  $('compass-tape').textContent = compassTape(walker.pose.yaw);
  document
    .querySelector('.compass')!
    .setAttribute('aria-label', `Facing ${cardinal(degrees)}, ${degrees} degrees`);
}
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  if (!ready || document.hidden) return;
  elapsed += dt;
  frameTimes.push(dt * 1000);
  if (frameTimes.length > 1800) frameTimes.shift();
  accumulator = Math.min(accumulator + dt, 0.1);
  while (accumulator >= 1 / 60) {
    walker.update(1 / 60);
    if (!paused && settings.activity !== 'still') life.update(1 / 60, walker.pose.x, walker.pose.z);
    accumulator -= 1 / 60;
  }
  world.update(walker.pose.x, walker.pose.z);
  world.recreation.tick(paused ? 0 : dt, walker.pose.x, walker.pose.z);
  world.places.tick(paused ? 0 : dt, walker.pose.x, walker.pose.z);
  world.material.uniforms.uTime.value = world.recreation.time;
  const interaction = started && !paused ? nearestInteraction() : undefined;
  show('interact', !!interaction);
  if (interaction) $('interact').textContent = `[f] ${interaction.label}`;
  renderer.render(world.scene, camera);
  updateCompass();
  if (walker.distance > 2) show('look-hint', false);
  if (elapsed - lastHUD > 0.7) {
    updateHUD();
    lastHUD = elapsed;
  }
  if (elapsed - lastSave > 5) {
    save();
    lastSave = elapsed;
  }
}
function toggleMap() {
  if (!ready) return;
  mapOpen = !mapOpen;
  if (mapOpen) {
    resumeAfterMap = started && !paused;
    pause(true);
    show('pause', false);
  } else {
    pause(!started || !resumeAfterMap);
    if (resumeAfterMap) canvas.focus();
  }
  show('map-panel', mapOpen);
  $('map-toggle').classList.toggle('active', mapOpen);
  updateHUD();
}
function toggleColor() {
  settings.palette = settings.palette === 'color' ? 'mono' : 'color';
  applySettings();
  save();
}
$('start').onclick = begin;
$('resume').onclick = begin;
$('reset').onclick = () => {
  returnToStart();
  pause(false);
  canvas.focus();
};
for (const key of ['destinations-open', 'intro-destinations', 'pause-destinations'])
  $(key).onclick = openDestinations;
canvas.onclick = () => canvas.focus();
const captureMouse = () => {
  if (started && ready && !paused) {
    canvas.focus();
    walker.lock();
  }
};
$('mouse-capture').onclick = captureMouse;
$('map-toggle').onclick = toggleMap;
$('map-close').onclick = toggleMap;
$('color-toggle').onclick = toggleColor;
$('settings-open').onclick = () => dialog('settings');
$('about-open').onclick = () => dialog('about');
function nearestInteraction() {
  const { x, z } = walker.pose;
  const candidates = [
    world.recreation.nearestInteraction(x, z),
    world.places.nearestInteraction(x, z),
  ].filter((a) => a !== undefined);
  const p = new THREE.Vector3();
  return candidates.sort((a, b) => {
    a.object.getWorldPosition(p);
    const da = Math.hypot(p.x - x, p.z - z);
    b.object.getWorldPosition(p);
    return da - Math.hypot(p.x - x, p.z - z);
  })[0];
}
const interact = () => {
  if (!ready || paused) return;
  const action = nearestInteraction();
  if (action) {
    const message = action.push();
    notify(message ?? (action.label === 'Push the swings' ? 'A little higher.' : 'Round we go.'));
    canvas.focus();
  }
};
$('interact').onclick = interact;
document
  .querySelectorAll<HTMLButtonElement>('[data-close]')
  .forEach((button) => (button.onclick = () => $<HTMLDialogElement>(button.dataset.close!).close()));
document.querySelectorAll<HTMLDialogElement>('dialog').forEach((d) =>
  d.addEventListener('close', () => {
    if (d.id === 'destinations') {
      if (!selectorTravelled) {
        pause(!started || !resumeAfterSelector);
        if (resumeAfterSelector) canvas.focus();
      }
      selectorTravelled = false;
      return;
    }
    if (started) pause(true);
  }),
);
for (const key of ['density', 'palette', 'contrast', 'sensitivity', 'fov', 'activity'] as const)
  $(key).addEventListener('input', () => {
    const v = $<HTMLInputElement>(key).value;
    if (key === 'density' || key === 'palette' || key === 'activity') settings[key] = v;
    else settings[key] = Number(v);
    applySettings();
    save();
  });
window.addEventListener('resize', resize);
window.addEventListener('beforeunload', save);
window.addEventListener('keydown', (e) => {
  if (!ready || e.repeat || (e.target as HTMLElement)?.closest('input,select,textarea,dialog')) return;
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'KeyG') openDestinations();
  if (e.code === 'KeyF') interact();
  if (e.code === 'KeyL' && !e.repeat) captureMouse();
  if (e.code === 'KeyC') toggleColor();
  if (e.code === 'KeyR') {
    returnToStart();
  }
  if (e.code === 'Escape' && started) {
    if (mapOpen) {
      mapOpen = false;
      show('map-panel', false);
      $('map-toggle').classList.remove('active');
    }
    pause(true);
  }
});
document.addEventListener('pointerlockchange', () => {
  const captured = document.pointerLockElement === canvas;
  show('look-hint', ready && started && !paused && !captured);
  $('control-mode').textContent = captured ? 'Mouse captured / Esc to release' : 'Drag to look / Q E to turn';
  $('mouse-capture').textContent = captured ? 'Mouse captured' : '[l] Mouse look';
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && ready && started) pause(true);
});
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  save();
  ready = false;
  show('loading');
  $('loading-label').textContent = 'The graphics context was interrupted.';
  const text = $('loading').querySelector('small')!;
  text.textContent = 'Reload to resume your saved walk. ';
  const reload = document.createElement('button');
  reload.textContent = 'Reload world';
  reload.onclick = () => location.reload();
  text.append(reload);
});
canvas.addEventListener('webglcontextrestored', () => location.reload());

let token = '',
  jobId = '',
  searchTimer: ReturnType<typeof setTimeout>,
  importTimer: ReturnType<typeof setTimeout>;
async function api(path: string, options?: RequestInit) {
  const r = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-ASCII-Token': token, ...options?.headers },
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || 'The area builder is unavailable');
  return body;
}
async function places() {
  dialog('locations');
  const staticViewer = import.meta.env.PROD;
  show('import-form', !staticViewer);
  show('builder-info', staticViewer);
  try {
    let saved;
    if (staticViewer) {
      const response = await fetch(`${import.meta.env.BASE_URL}worlds/index.json`);
      if (!response.ok) throw new Error('The prepared places could not be loaded.');
      saved = await response.json();
    } else {
      const status = await api('/status');
      token = status.token;
      saved = await api('/locations');
      $<HTMLButtonElement>('prepare-area').disabled = !status.ready;
      $<HTMLButtonElement>('preview-area').disabled = !status.ready;
      $('import-status').textContent = status.ready
        ? ''
        : 'To prepare new places, install Python 3.11 and run npm run setup. The included places are ready to explore.';
    }
    $('saved-locations').replaceChildren(
      ...saved.map((place: { id: string; name: string; curated: boolean }) => {
        const b = document.createElement('button');
        b.textContent = place.name;
        const small = document.createElement('small');
        small.textContent = place.curated ? 'PREPARED / WARSAW' : 'PREPARED WORLD';
        b.append(small);
        b.onclick = () => {
          $<HTMLDialogElement>('locations').close();
          load(place.id);
        };
        return b;
      }),
    );
  } catch {
    const message = staticViewer ? $('builder-info') : $('import-status');
    message.textContent = staticViewer
      ? 'The prepared places could not be loaded. Please reload and try again.'
      : 'The local builder is unavailable. Start the app with npm start and try again.';
    $<HTMLButtonElement>('prepare-area').disabled = true;
    $<HTMLButtonElement>('preview-area').disabled = true;
  }
  updatePreview();
}
$('locations-open').onclick = places;
$('pause-locations').onclick = places;
function updatePreview() {
  const size = Number($<HTMLSelectElement>('area-size').value) / 1000;
  $('area-preview').textContent =
    `+-----------------------------+\n|              N              |\n|              +              |\n|         ${size} x ${size} km area         |\n|              +              |\n+-----------------------------+\n ${$<HTMLInputElement>('latitude').value}, ${$<HTMLInputElement>('longitude').value}`;
}
const selectedArea = () => ({
  lat: Number($<HTMLInputElement>('latitude').value),
  lon: Number($<HTMLInputElement>('longitude').value),
  size: Number($<HTMLSelectElement>('area-size').value),
  name: $<HTMLInputElement>('place-search').value || 'My neighborhood',
});
document.querySelectorAll<HTMLButtonElement>('[data-pan]').forEach(
  (button) =>
    (button.onclick = () => {
      const area = selectedArea(),
        step = area.size / 4 / 111320,
        direction = button.dataset.pan;
      if (direction === 'north' || direction === 'south')
        $('latitude').setAttribute('value', String(area.lat));
      $<HTMLInputElement>('latitude').value = (
        area.lat + (direction === 'north' ? step : direction === 'south' ? -step : 0)
      ).toFixed(6);
      $<HTMLInputElement>('longitude').value = (
        area.lon +
        (direction === 'east' ? step : direction === 'west' ? -step : 0) /
          Math.cos((area.lat * Math.PI) / 180)
      ).toFixed(6);
      updatePreview();
    }),
);
$('preview-area').onclick = async () => {
  $<HTMLButtonElement>('preview-area').disabled = true;
  $<HTMLButtonElement>('prepare-area').disabled = true;
  try {
    const job = await api('/preview', { method: 'POST', body: JSON.stringify(selectedArea()) });
    jobId = job.id;
    show('cancel-import');
    pollImport();
  } catch (error) {
    $('import-status').textContent = String(error);
    $<HTMLButtonElement>('preview-area').disabled = false;
    $<HTMLButtonElement>('prepare-area').disabled = false;
  }
};
for (const id of ['latitude', 'longitude', 'area-size']) $(id).addEventListener('input', updatePreview);
$('place-search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const q = $<HTMLInputElement>('place-search').value.trim();
    if (q.length < 2) {
      $('search-results').replaceChildren();
      return;
    }
    try {
      const results = await api(`/search?q=${encodeURIComponent(q)}`);
      $('search-results').replaceChildren(
        ...results.map((p: { name: string; region: string; lat: number; lon: number }) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = `${p.name}, ${p.region}`;
          b.onclick = () => {
            $<HTMLInputElement>('latitude').value = String(p.lat);
            $<HTMLInputElement>('longitude').value = String(p.lon);
            $<HTMLInputElement>('place-search').value = `${p.name}, ${p.region}`;
            $('search-results').replaceChildren();
            updatePreview();
          };
          return b;
        }),
      );
    } catch (e) {
      $('import-status').textContent = String(e);
    }
  }, 220);
});
$('import-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $<HTMLButtonElement>('prepare-area').disabled = true;
  try {
    const result = await api('/imports', {
      method: 'POST',
      body: JSON.stringify({
        lat: Number($<HTMLInputElement>('latitude').value),
        lon: Number($<HTMLInputElement>('longitude').value),
        size: Number($<HTMLSelectElement>('area-size').value),
        name: $<HTMLInputElement>('place-search').value || 'My neighborhood',
      }),
    });
    jobId = result.id;
    show('cancel-import');
    pollImport();
  } catch (e) {
    $('import-status').textContent = e instanceof Error ? e.message : String(e);
    $<HTMLButtonElement>('prepare-area').disabled = false;
  }
});
async function pollImport() {
  try {
    const job = await api(`/imports/${jobId}`);
    $('import-status').textContent = job.error || `${job.stage} / ${Math.round(job.progress * 100)}%`;
    if (job.status === 'complete') {
      show('cancel-import', false);
      $<HTMLButtonElement>('prepare-area').disabled = false;
      $<HTMLButtonElement>('preview-area').disabled = false;
      if (job.preview) {
        $('area-preview').textContent = job.map.text;
        $('import-status').textContent =
          `${job.map.buildings} building outlines / ${job.map.roads} road segments. Ready to prepare.`;
      } else {
        $<HTMLDialogElement>('locations').close();
        load(job.worldId);
      }
    } else if (job.status === 'failed' || job.status === 'cancelled') {
      show('cancel-import', false);
      $<HTMLButtonElement>('prepare-area').disabled = false;
      $<HTMLButtonElement>('preview-area').disabled = false;
    } else importTimer = setTimeout(pollImport, 1000);
  } catch (e) {
    $('import-status').textContent = String(e);
    $<HTMLButtonElement>('prepare-area').disabled = false;
    show('cancel-import', false);
  }
}
$('cancel-import').onclick = async () => {
  clearTimeout(importTimer);
  await api(`/imports/${jobId}`, { method: 'DELETE' });
  pollImport();
};

// An inspectable development interface supports repeatable visual and movement checks.
Object.assign(window, {
  __asciiWalk: {
    get ready() {
      return ready;
    },
    get data() {
      return data;
    },
    get walker() {
      return walker;
    },
    get world() {
      return world;
    },
    get renderer() {
      return renderer;
    },
    setPose(pose: Pose) {
      const success = walker.teleport(pose);
      if (success) {
        world.update(pose.x, pose.z, true);
        updateHUD();
      }
      return success;
    },
    start() {
      started = true;
      show('intro', false);
      document.body.classList.add('walking');
      pause(false);
    },
    debug(mode: number) {
      renderer.pass.uniforms.uDebug.value = mode;
    },
    stats() {
      const sorted = [...frameTimes].sort((a, b) => a - b);
      return {
        frames: sorted.length,
        medianMs: sorted[Math.floor(sorted.length * 0.5)],
        p95Ms: sorted[Math.floor(sorted.length * 0.95)],
        drawCalls: renderer.renderer.info.render.calls,
        geometries: renderer.renderer.info.memory.geometries,
        activeChunks: world.active.size,
        position: { ...walker.pose },
      };
    },
  },
});
requestAnimationFrame(frame);
load(new URLSearchParams(location.search).get('world') || 'warsaw');

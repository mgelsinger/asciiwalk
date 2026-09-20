import * as THREE from 'three';
import { nearestSegment, pointInRing } from '../geography/math';
import type { WorldData } from '../world/data';
import type { Building, FixtureObstacle, Pose } from '../world/types';

export class Walker {
  pose: Pose;
  keys = new Set<string>();
  enabled = false;
  dragging = false;
  sensitivity = 1;
  distance = 0;
  radius = 0.28;
  onUnlock = () => {};
  cells = new Map<string, Building[]>();
  obstacles: { x: number; z: number; half: number; halfZ?: number }[] = [];
  private listeners: { target: EventTarget; type: string; listener: EventListener }[] = [];
  constructor(
    public data: WorldData,
    public camera: THREE.PerspectiveCamera,
    public canvas: HTMLCanvasElement,
    public fixtures: FixtureObstacle[] = [],
  ) {
    this.pose = { ...data.manifest.spawn, pitch: 0 };
    this.obstacles = data.features.landmarks
      .filter((l) => l.monument)
      .map((l) => ({ x: l.x, z: l.z, half: 2.6 }));
    for (const l of data.features.landmarks.filter((l) => l.monument))
      for (let i = 0; i < 4; i++)
        this.obstacles.push({
          x: l.x + Math.sin((i * Math.PI) / 2) * 3.15,
          z: l.z + Math.cos((i * Math.PI) / 2) * 3.15,
          half: 0.6,
        });
    for (const b of data.features.buildings)
      if (b.details.style === 'courthouse' && b.details.entrance)
        this.obstacles.push({
          x: b.details.entrance.x + 2.9,
          z: b.details.entrance.z,
          half: 3.5,
          halfZ: 7.05,
        });
    for (const b of data.features.buildings)
      if (b.details.tower)
        this.obstacles.push({ x: b.details.tower.x, z: b.details.tower.z, half: b.details.tower.width / 2 });
    for (const b of data.features.buildings) {
      const xs = b.ring.map((p) => p[0]),
        zs = b.ring.map((p) => p[1]);
      for (let x = Math.floor((Math.min(...xs) - 1) / 32); x <= Math.floor((Math.max(...xs) + 1) / 32); x++)
        for (
          let z = Math.floor((Math.min(...zs) - 1) / 32);
          z <= Math.floor((Math.max(...zs) + 1) / 32);
          z++
        ) {
          const key = `${x},${z}`;
          if (!this.cells.has(key)) this.cells.set(key, []);
          this.cells.get(key)!.push(b);
        }
    }
    this.camera.rotation.order = 'YXZ';
    this.listen(window, 'keydown', (event) => {
      const e = event as KeyboardEvent;
      if ((e.target as HTMLElement)?.closest('input,select,textarea,dialog')) return;
      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'KeyQ',
          'KeyE',
          'ShiftLeft',
          'ShiftRight',
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
        ].includes(e.code) &&
        this.enabled
      ) {
        this.keys.add(e.code);
        e.preventDefault();
      }
    });
    this.listen(window, 'keyup', (event) => this.keys.delete((event as KeyboardEvent).code));
    this.listen(window, 'blur', () => {
      this.keys.clear();
      this.dragging = false;
    });
    this.listen(document, 'pointerlockchange', () => {
      if (document.pointerLockElement !== canvas) {
        this.keys.clear();
        this.onUnlock();
      }
    });
    this.listen(document, 'mousemove', (event) => {
      const e = event as MouseEvent;
      if (!this.enabled || (document.pointerLockElement !== canvas && !this.dragging)) return;
      this.pose.yaw -= e.movementX * 0.002 * this.sensitivity;
      this.pose.pitch = THREE.MathUtils.clamp(
        (this.pose.pitch ?? 0) - e.movementY * 0.002 * this.sensitivity,
        -1.2,
        1.2,
      );
    });
    this.listen(canvas, 'pointerdown', (event) => {
      if (this.enabled && (event as PointerEvent).button === 0) {
        canvas.focus();
        this.dragging = true;
      }
    });
    this.listen(window, 'pointerup', () => {
      this.dragging = false;
    });
    this.sync(true);
  }
  private listen(target: EventTarget, type: string, listener: EventListener) {
    target.addEventListener(type, listener);
    this.listeners.push({ target, type, listener });
  }
  blocked(x: number, z: number) {
    const bounds = this.data.manifest.bounds;
    if (x < bounds[0] + 2 || x > bounds[2] - 2 || z < bounds[1] + 2 || z > bounds[3] - 2) return true;
    if (
      this.fixtures.some(
        (o) =>
          nearestSegment(x, z, [o.a[0], 0, o.a[1]], [o.b[0], 0, o.b[1]]).distance < o.radius + this.radius,
      )
    )
      return true;
    if ((this.data.features.facilities ?? []).some((f) => f.type === 'pool' && pointInRing(x, z, f.ring)))
      return true;
    if (
      this.obstacles.some(
        (o) =>
          Math.abs(x - o.x) < o.half + this.radius && Math.abs(z - o.z) < (o.halfZ ?? o.half) + this.radius,
      )
    )
      return true;
    for (const b of this.cells.get(`${Math.floor(x / 32)},${Math.floor(z / 32)}`) ?? []) {
      const inHole = b.holes.some((h) => pointInRing(x, z, h));
      if (pointInRing(x, z, b.ring) && !inHole) return true;
      for (const ring of [b.ring, ...b.holes])
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            c = ring[(i + 1) % ring.length];
          if (nearestSegment(x, z, [a[0], 0, a[1]], [c[0], 0, c[1]]).distance < this.radius) return true;
        }
    }
    const road = this.data.nearbyRoad(x, z);
    if (
      !road?.road.bridge &&
      this.data.features.areas.some((a) => a.type === 'water' && pointInRing(x, z, a.ring))
    )
      return true;
    return false;
  }
  move(dx: number, dz: number) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15));
    const oldX = this.pose.x,
      oldZ = this.pose.z;
    for (let i = 0; i < steps; i++) {
      const x = this.pose.x + dx / steps,
        z = this.pose.z + dz / steps;
      const y = this.data.ground(this.pose.x, this.pose.z),
        nextY = this.data.ground(x, z);
      if (Math.abs(nextY - y) > 0.24) continue;
      if (!this.blocked(x, z)) {
        this.pose.x = x;
        this.pose.z = z;
      } else if (!this.blocked(x, this.pose.z)) this.pose.x = x;
      else if (!this.blocked(this.pose.x, z)) this.pose.z = z;
    }
    this.distance += Math.hypot(this.pose.x - oldX, this.pose.z - oldZ);
  }
  update(dt: number) {
    if (this.enabled) {
      const forward =
        Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) -
        Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
      const side = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
      this.pose.yaw +=
        (Number(this.keys.has('ArrowLeft') || this.keys.has('KeyQ')) -
          Number(this.keys.has('ArrowRight') || this.keys.has('KeyE'))) *
        dt *
        1.35;
      const length = Math.hypot(forward, side) || 1,
        speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 3.5 : 1.5;
      const d = (Math.min(dt, 0.05) * speed) / length;
      this.move(
        (-Math.sin(this.pose.yaw) * forward + Math.cos(this.pose.yaw) * side) * d,
        (-Math.cos(this.pose.yaw) * forward - Math.sin(this.pose.yaw) * side) * d,
      );
    }
    this.sync(false);
  }
  sync(immediate: boolean) {
    const y = this.data.ground(this.pose.x, this.pose.z) + 1.7;
    this.camera.position.set(
      this.pose.x,
      immediate ? y : THREE.MathUtils.lerp(this.camera.position.y, y, 0.28),
      this.pose.z,
    );
    this.camera.rotation.set(this.pose.pitch ?? 0, this.pose.yaw, 0);
  }
  teleport(pose: Pose) {
    if (![pose.x, pose.z, pose.yaw, pose.pitch ?? 0].every(Number.isFinite)) return false;
    if (this.blocked(pose.x, pose.z)) return false;
    this.pose = { ...pose };
    this.keys.clear();
    this.sync(true);
    return true;
  }
  reset() {
    const start = this.data.manifest.spawn;
    if (this.teleport(start)) return;
    for (let radius = 1; radius < 60; radius++)
      for (let a = 0; a < 16; a++)
        if (
          this.teleport({
            ...start,
            x: start.x + Math.cos((a * Math.PI) / 8) * radius,
            z: start.z + Math.sin((a * Math.PI) / 8) * radius,
          })
        )
          return;
  }
  async lock() {
    this.enabled = true;
    try {
      await this.canvas.requestPointerLock();
    } catch {
      /* Drag and arrow-key look remain available. */
    }
  }
  dispose() {
    for (const { target, type, listener } of this.listeners) target.removeEventListener(type, listener);
    this.keys.clear();
  }
}

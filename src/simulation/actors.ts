import * as THREE from 'three';
import { seeded } from '../geography/math';
import { Batch } from '../world/geometry';
import type { WorldData } from '../world/data';
import type { Road, Point3 } from '../world/types';
import { SURFACE as S } from '../renderer/material';

type Edge = {
  road: Road;
  reverse: boolean;
  start: number;
  end: number;
  points: Point3[];
  length: number;
  distances: number[];
};
type Actor = {
  object: THREE.Group;
  edge: Edge;
  distance: number;
  speed: number;
  pedestrian: boolean;
  side: number;
  phase: number;
  limbs: THREE.Mesh[];
  wait: number;
  placed: boolean;
};

export class TownLife {
  actors: Actor[] = [];
  edges: Edge[] = [];
  outgoing = new Map<number, Edge[]>();
  group = new THREE.Group();
  random: () => number;
  constructor(
    public data: WorldData,
    public material: THREE.Material,
    public blocked: (x: number, z: number) => boolean = () => false,
  ) {
    this.random = seeded(data.manifest.seed);
    for (const road of data.features.roads.filter(
      (r) => r.width >= 6 && r.type !== 'service' && r.nodes.length > 1,
    )) {
      for (const reverse of [false, true]) {
        if ((road.oneway === 'yes' && reverse) || (road.oneway === '-1' && !reverse)) continue;
        const points = reverse ? [...road.points].reverse() : road.points;
        const distances = [0];
        for (let i = 1; i < points.length; i++)
          distances.push(
            distances[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][2] - points[i - 1][2]),
          );
        const edge = {
          road,
          reverse,
          points,
          distances,
          length: distances.at(-1)!,
          start: reverse ? road.nodes.at(-1)! : road.nodes[0],
          end: reverse ? road.nodes[0] : road.nodes.at(-1)!,
        };
        if (edge.length < 3) continue;
        this.edges.push(edge);
        if (!this.outgoing.has(edge.start)) this.outgoing.set(edge.start, []);
        this.outgoing.get(edge.start)!.push(edge);
      }
    }
    const near = this.edges.filter((e) =>
      e.points.some((p) => Math.hypot(p[0] - data.manifest.spawn.x, p[2] - data.manifest.spawn.z) < 350),
    );
    for (let i = 0; i < 26 && near.length; i++) {
      const pedestrian = i >= 9,
        object = new THREE.Group(),
        batch = new Batch(),
        limbs: THREE.Mesh[] = [];
      if (pedestrian) {
        const shirt = ['#c69575', '#82a698', '#c3b87d', '#8298ae', '#c6b7a4'][i % 5];
        batch.box(0, 1.1, 0, 0.43, 0.57, 0.26, shirt, S.person);
        batch.box(0, 1.58, 0, 0.25, 0.28, 0.24, '#c49c79', S.person);
        for (const side of [-1, 1]) {
          const leg = new Batch();
          leg.box(0, -0.29, 0, 0.15, 0.58, 0.17, '#4c5f60', S.person);
          const mesh = leg.mesh(material);
          mesh.position.set(side * 0.13, 0.8, 0);
          object.add(mesh);
          limbs.push(mesh);
          const arm = new Batch();
          arm.box(0, -0.22, 0, 0.12, 0.48, 0.14, shirt, S.person);
          const a = arm.mesh(material);
          a.position.set(side * 0.29, 1.34, 0);
          object.add(a);
          limbs.push(a);
        }
      } else {
        const color = ['#a9bbb4', '#a06652', '#446b76', '#b6aa8c', '#666e73'][i % 5];
        batch.box(0, 0.65, 0, 1.8, 0.68, 4.2, color, S.metal);
        batch.box(0, 1.2, -0.1, 1.5, 0.65, 2.15, color, S.metal);
        batch.box(0, 1.28, -1.19, 1.3, 0.43, 0.04, '#426569', S.window);
        batch.box(0, 1.28, 1.0, 1.3, 0.43, 0.04, '#426569', S.window);
        for (const side of [-1, 1]) {
          batch.box(side * 0.76, 1.28, -0.1, 0.04, 0.42, 1.85, '#426569', S.window);
          for (const z of [-1.25, 1.25]) batch.box(side * 0.91, 0.37, z, 0.2, 0.59, 0.63, '#293730', S.metal);
          batch.box(side * 0.62, 0.7, 2.12, 0.4, 0.22, 0.06, '#d8d5af', S.paint);
          batch.box(side * 0.62, 0.7, -2.12, 0.4, 0.22, 0.06, '#bb684a', S.paint);
        }
      }
      object.add(batch.mesh(material));
      this.group.add(object);
      const edge = near[Math.floor(this.random() * near.length)];
      this.actors.push({
        object,
        edge,
        distance: this.random() * edge.length,
        speed: pedestrian ? 0.85 + this.random() * 0.5 : 4.5 + this.random() * 2,
        pedestrian,
        side: i % 2 ? 1 : -1,
        phase: this.random() * Math.PI * 2,
        limbs,
        wait: 0,
        placed: false,
      });
    }
    this.update(0, data.manifest.spawn.x, data.manifest.spawn.z);
  }
  update(dt: number, playerX: number, playerZ: number) {
    for (const actor of this.actors) {
      const nearPlayer = Math.hypot(actor.object.position.x - playerX, actor.object.position.z - playerZ);
      const previousDistance = actor.distance,
        previousEdge = actor.edge;
      const following = this.actors.some(
        (other) =>
          other !== actor &&
          !other.pedestrian &&
          other.edge === actor.edge &&
          other.distance > actor.distance &&
          other.distance - actor.distance < 9,
      );
      const moving = actor.pedestrian || (nearPlayer > 5 && !following);
      if (actor.wait > 0) actor.wait -= dt;
      else if (moving) actor.distance += dt * actor.speed;
      if (actor.distance >= actor.edge.length) {
        const choices = (this.outgoing.get(actor.edge.end) ?? []).filter((e) => e.end !== actor.edge.start);
        const fallback = this.outgoing.get(actor.edge.end) ?? [];
        const options = choices.length ? choices : fallback;
        if (options.length) {
          actor.edge = options[Math.floor(this.random() * options.length)];
          actor.distance = 0;
          actor.wait = actor.pedestrian ? 0.4 : 1.5 + this.random();
        } else {
          actor.distance = actor.edge.length;
          actor.wait = 5;
        }
      }
      const e = actor.edge,
        points = e.points;
      let i = 0;
      while (i < points.length - 2 && e.distances[i + 1] < actor.distance) i++;
      const a = points[i],
        b = points[i + 1],
        t = Math.max(
          0,
          Math.min(1, (actor.distance - e.distances[i]) / (e.distances[i + 1] - e.distances[i] || 1)),
        ),
        dx = b[0] - a[0],
        dz = b[2] - a[2],
        length = Math.hypot(dx, dz) || 1;
      const lane = actor.pedestrian ? actor.side * (e.road.width / 2 + 1.3) : -Math.min(e.road.width / 4, 3);
      const x = a[0] + dx * t + (dz / length) * lane,
        z = a[2] + dz * t - (dx / length) * lane;
      if (actor.pedestrian && this.blocked(x, z)) {
        if (actor.placed) {
          actor.distance = previousDistance;
          actor.edge = previousEdge;
          actor.wait = 1;
          actor.speed = -actor.speed;
        } else {
          actor.distance = (actor.distance + 4) % actor.edge.length;
          actor.object.visible = false;
        }
        continue;
      }
      if (actor.distance < 0) {
        actor.distance = 0;
        actor.speed = Math.abs(actor.speed);
      }
      const target = new THREE.Vector3(x, this.data.ground(x, z) + 0.22, z);
      if (actor.placed && dt > 0) {
        const delta = target.sub(actor.object.position);
        const max = Math.abs(actor.speed) * dt;
        if (delta.length() > max) delta.setLength(max);
        actor.object.position.add(delta);
      } else actor.object.position.copy(target);
      actor.placed = true;
      actor.object.rotation.y = Math.atan2(dx, dz) + (actor.speed < 0 ? Math.PI : 0);
      actor.object.visible = Math.hypot(x - playerX, z - playerZ) < 260;
      actor.phase += dt * (moving ? actor.speed * 5 : 0);
      actor.limbs.forEach((limb, index) => {
        limb.rotation.x = Math.sin(actor.phase + (index < 2 ? 0 : Math.PI)) * 0.35;
      });
    }
  }
  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.group.clear();
  }
}

import * as THREE from 'three';
import { worldMaterial, SURFACE as S } from '../renderer/material';
import { Batch, makeBuilding, makeRoadSegment, makeTree, terrainBatch, vegetationForChunk } from './geometry';
import type { WorldData } from './data';
import type { Building, Road } from './types';
import { makeMonument } from './landmarks';
import { pointInRing } from '../geography/math';
import { Recreation } from './recreation';
import { PlaceDetails } from './place-details';

type Chunk = {
  mesh?: THREE.Mesh;
  terrain?: THREE.Mesh;
  x: number;
  z: number;
  buildings: Building[];
  roads: { road: Road; index: number }[];
  detail: boolean;
};
export class TownScene {
  scene = new THREE.Scene();
  material = worldMaterial();
  chunks = new Map<string, Chunk>();
  active = new Set<string>();
  queue: Chunk[] = [];
  staticGroup = new THREE.Group();
  groundTiles = new Map<string, THREE.Mesh>();
  lastX = Infinity;
  lastZ = Infinity;
  recreation: Recreation;
  places: PlaceDetails;
  constructor(public data: WorldData) {
    const get = (x: number, z: number) => {
      const cx = Math.floor(x / 250),
        cz = Math.floor(z / 250),
        key = `${cx},${cz}`;
      if (!this.chunks.has(key))
        this.chunks.set(key, { x: cx * 250, z: cz * 250, buildings: [], roads: [], detail: true });
      return this.chunks.get(key)!;
    };
    for (const b of data.features.buildings) get(b.x, b.z).buildings.push(b);
    for (const road of data.features.roads)
      for (let i = 0; i < road.points.length - 1; i++)
        get(
          (road.points[i][0] + road.points[i + 1][0]) / 2,
          (road.points[i][2] + road.points[i + 1][2]) / 2,
        ).roads.push({ road, index: i });
    // Terrain tiles cover the context continuously. Nearby tiles are replaced, not overlaid.
    const context = data.manifest.terrain[0];
    for (
      let x = Math.floor(context.x / 250);
      x < Math.ceil((context.x + context.width * context.step) / 250);
      x++
    )
      for (
        let z = Math.floor(context.z / 250);
        z < Math.ceil((context.z + context.height * context.step) / 250);
        z++
      ) {
        const mesh = terrainBatch(data, x * 250, z * 250, 250, 50, false).mesh(this.material);
        this.groundTiles.set(`${x},${z}`, mesh);
        this.scene.add(mesh);
      }
    this.addLandmarks();
    this.scene.add(this.staticGroup);
    this.recreation = new Recreation(data, this.material);
    this.scene.add(this.recreation.group);
    this.places = new PlaceDetails(data, this.material);
    this.scene.add(this.places.group);
    this.update(data.manifest.spawn.x, data.manifest.spawn.z, true);
  }
  addLandmarks() {
    const batch = new Batch();
    for (const l of this.data.features.landmarks.filter((l) => l.monument)) {
      const ground = this.data.ground(l.x, l.z);
      makeMonument(batch, l.x, ground, l.z);
    }
    if (this.data.manifest.id === 'warsaw') {
      // Main/Buffalo crosswalks are aligned to the surveyed road centerlines.
      for (const z of [-6, 6])
        for (let x = -6; x <= 6; x += 1.3)
          batch.box(x, this.data.ground(x, z) + 0.3, z, 0.6, 0.025, 2.7, '#d7d3b8', S.paint);
      for (const x of [-8, 8])
        for (let z = -4; z <= 4; z += 1.3)
          batch.box(x, this.data.ground(x, z) + 0.3, z, 2.2, 0.025, 0.6, '#d7d3b8', S.paint);
      for (const [x, z, dx] of [
        [-10, -6, 1],
        [10, 6, -1],
      ]) {
        const y = this.data.ground(x, z);
        batch.box(x, y + 4.4, z, 0.18, 8.8, 0.18, '#909e94', S.metal);
        batch.box(x + dx * 5, y + 8.2, z, 10, 0.16, 0.16, '#909e94', S.metal);
        batch.box(x + dx * 7, y + 7.45, z, 0.45, 1.2, 0.4, '#3b4941', S.metal);
        batch.box(x + dx * 7, y + 7.07, z + 0.22, 0.25, 0.25, 0.035, '#9dbd7d', S.paint);
      }
      for (let z = -185; z < 160; z += 25)
        for (const x of [-11, 10.3]) {
          const road = this.data.nearbyRoad(x, z, false);
          if (!road || road.distance > 18) continue;
          const px = road.x + Math.sign(x) * (road.road.width / 2 + 1.9),
            y = this.data.ground(px, z);
          batch.box(px, y + 2.3, z, 0.13, 4.6, 0.13, '#374c46', S.metal);
          batch.box(px, y + 0.3, z, 0.3, 0.6, 0.3, '#374c46', S.metal);
          batch.cone(px, y + 4.3, z, 0.28, 0.45, '#cfc7a7', S.trim);
        }
      for (const [x, z, scale] of [
        [-8, -200, 7],
        [8, -205, 7],
        [5, -230, 6],
        [15, 100, 9],
        [10, 82, 6],
      ])
        makeTree(batch, x, this.data.ground(x, z), z, scale, 52 + z);
    }
    for (const area of this.data.features.areas.filter((a) => a.type === 'water'))
      batch.poly(area.ring, [], area.height + 0.1, '#4e8283', S.water);
    for (const area of this.data.features.areas.filter((a) => a.type === 'parking')) {
      const x0 = Math.min(...area.ring.map((p) => p[0])),
        x1 = Math.max(...area.ring.map((p) => p[0])),
        z0 = Math.min(...area.ring.map((p) => p[1])),
        z1 = Math.max(...area.ring.map((p) => p[1]));
      const p = (x: number, z: number): [number, number, number] => [x, this.data.ground(x, z) + 0.24, z];
      for (let x = x0; x < x1; x += 3)
        for (let z = z0; z < z1; z += 3) {
          const right = Math.min(x + 3, x1),
            bottom = Math.min(z + 3, z1);
          if (
            [
              [x, z],
              [right, z],
              [right, bottom],
              [x, bottom],
            ].every(([a, b]) => pointInRing(a, b, area.ring))
          )
            batch.quad(p(x, z), p(x, bottom), p(right, bottom), p(right, z), '#535954', S.road);
        }
      // Inferred parking bays follow the sourced lot, clipped to its polygon.
      for (let x = x0 + 7; x < x1 - 6; x += 17)
        for (let z = z0 + 4; z < z1 - 4; z += 3.1) {
          if (
            ![
              [-2.5, 0],
              [2.5, 0],
            ].every(([dx, dz]) => pointInRing(x + dx, z + dz, area.ring))
          )
            continue;
          batch.quad(
            [x - 2.5, this.data.ground(x - 2.5, z) + 0.27, z - 0.07],
            [x + 2.5, this.data.ground(x + 2.5, z) + 0.27, z - 0.07],
            [x + 2.5, this.data.ground(x + 2.5, z) + 0.27, z + 0.07],
            [x - 2.5, this.data.ground(x - 2.5, z) + 0.27, z + 0.07],
            '#dfdfcd',
            S.paint,
          );
        }
    }
    for (const stream of this.data.features.streams)
      for (let i = 0; i < stream.points.length - 1; i++)
        makeRoadSegment(batch, stream.points[i], stream.points[i + 1], 3, 'water', false, false);
    this.staticGroup.add(batch.mesh(this.material));
  }
  makeChunk(chunk: Chunk) {
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
    }
    if (chunk.terrain) {
      this.scene.remove(chunk.terrain);
      chunk.terrain.geometry.dispose();
    }
    const batch = new Batch();
    for (const building of chunk.buildings) makeBuilding(batch, building, chunk.detail);
    for (const { road, index } of chunk.roads) {
      const a = road.points[index],
        b = road.points[index + 1];
      const nearIntersection =
        this.data.manifest.id === 'warsaw' && Math.hypot((a[0] + b[0]) / 2, (a[2] + b[2]) / 2) < 12;
      makeRoadSegment(batch, a, b, road.width, road.type, road.bridge, !nearIntersection);
    }
    vegetationForChunk(batch, this.data, chunk.x, chunk.z, 250);
    chunk.mesh = batch.mesh(this.material);
    this.scene.add(chunk.mesh);
    const detailedGround = this.data.facilityBounds.some(
      ({ bounds: b }) => b[1] >= chunk.x && b[0] <= chunk.x + 250 && b[3] >= chunk.z && b[2] <= chunk.z + 250,
    );
    chunk.terrain = terrainBatch(this.data, chunk.x, chunk.z, 250, detailedGround ? 2 : 5, true).mesh(
      this.material,
    );
    this.scene.add(chunk.terrain);
    const original = this.groundTiles.get(`${chunk.x / 250},${chunk.z / 250}`);
    if (original) original.visible = false;
  }
  update(x: number, z: number, immediate = false) {
    if (Math.hypot(x - this.lastX, z - this.lastZ) > 70 || immediate) {
      this.lastX = x;
      this.lastZ = z;
      this.queue = [];
      for (const [key, chunk] of this.chunks) {
        const distance = Math.hypot(chunk.x + 125 - x, chunk.z + 125 - z);
        if (distance < 850 && (!chunk.mesh || (distance < 440 && !chunk.detail))) {
          chunk.detail = distance < 440;
          this.queue.push(chunk);
        }
        if (distance > 1120 && chunk.mesh) {
          this.scene.remove(chunk.mesh);
          chunk.mesh.geometry.dispose();
          chunk.mesh = undefined;
          if (chunk.terrain) {
            this.scene.remove(chunk.terrain);
            chunk.terrain.geometry.dispose();
            chunk.terrain = undefined;
          }
          const original = this.groundTiles.get(key);
          if (original) original.visible = true;
          this.active.delete(key);
        }
      }
      this.queue.sort(
        (a, b) => Math.hypot(a.x + 125 - x, a.z + 125 - z) - Math.hypot(b.x + 125 - x, b.z + 125 - z),
      );
    }
    const max = immediate ? 8 : 1;
    for (let i = 0; i < max && this.queue.length; i++) {
      const chunk = this.queue.shift()!;
      this.makeChunk(chunk);
      this.active.add(`${chunk.x / 250},${chunk.z / 250}`);
    }
  }
  dispose() {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    this.material.dispose();
    this.scene.clear();
    this.chunks.clear();
    this.groundTiles.clear();
  }
}

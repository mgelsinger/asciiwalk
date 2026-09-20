import * as THREE from 'three';
import type { WorldData } from '../world/data';

export type Sign = { text: string; x: number; y: number; z: number; nx: number; nz: number; width: number };
export class SignLayer {
  texture = new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType);
  signs: Sign[] = [];
  values = new Float32Array(4);
  width = 1;
  height = 1;
  point = new THREE.Vector3();
  constructor(data: WorldData, extra: Sign[] = []) {
    this.signs.push(...extra);
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    for (const b of data.features.buildings) {
      const name = b.details.landmark;
      if (!name || !['library', 'postoffice'].includes(b.details.style ?? '')) continue;
      const facing = b.details.facing ?? -Math.PI / 2,
        nx = Math.sin(facing),
        nz = Math.cos(facing);
      const x =
        b.details.entrance?.x ??
        (nx < 0 ? Math.min(...b.ring.map((p) => p[0])) - 0.16 : Math.max(...b.ring.map((p) => p[0])) + 0.16);
      const text =
        b.details.style === 'library'
          ? 'WARSAW PUBLIC LIBRARY'
          : b.details.style === 'postoffice'
            ? 'UNITED STATES POST OFFICE'
            : 'COURTHOUSE';
      this.signs.push({
        text,
        x: x + nx * 0.4,
        z: b.details.entrance?.z ?? b.z,
        y: b.ground + (b.details.style === 'courthouse' ? 4.36 : b.height * 0.65),
        nx,
        nz,
        width: b.details.style === 'courthouse' ? 4.5 : 10,
      });
    }
    if (data.manifest.id === 'warsaw') {
      this.signs.push({
        text: 'N MAIN ST',
        x: 8.7,
        y: data.ground(8.7, -6) + 3,
        z: -6,
        nx: 0,
        nz: 1,
        width: 2.9,
      });
      this.signs.push({
        text: 'E BUFFALO ST',
        x: 8.8,
        y: data.ground(8.8, -6) + 2.7,
        z: -6,
        nx: -1,
        nz: 0,
        width: 3.3,
      });
    }
  }
  update(
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    cellPixels: number,
    viewportHeight: number,
  ) {
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      this.values = new Float32Array(width * height * 4);
      this.texture.dispose();
      this.texture = new THREE.DataTexture(this.values, width, height, THREE.RGBAFormat, THREE.FloatType);
      this.texture.minFilter = THREE.NearestFilter;
      this.texture.magFilter = THREE.NearestFilter;
    }
    this.values.fill(0);
    camera.updateMatrixWorld();
    for (const sign of this.signs) {
      const dx = camera.position.x - sign.x,
        dz = camera.position.z - sign.z;
      if ((dx * sign.nx + dz * sign.nz) / Math.max(1, Math.hypot(dx, dz)) < 0.65) continue;
      const distance = Math.hypot(dx, dz, camera.position.y - sign.y),
        charWidth = sign.width / sign.text.length;
      const projectedHeight =
        (charWidth * 1.55 * viewportHeight) / (2 * Math.tan((camera.fov * Math.PI) / 360) * distance);
      if (projectedHeight < cellPixels * 0.7 || distance < 1) continue;
      const projected: { col: number; row: number; depth: number; code: number }[] = [];
      for (let i = 0; i < sign.text.length; i++) {
        const offset = (i - (sign.text.length - 1) / 2) * charWidth;
        this.point.set(sign.x + sign.nz * offset, sign.y, sign.z - sign.nx * offset).project(camera);
        if (this.point.z < -1 || this.point.z > 1) continue;
        const col = Math.floor((this.point.x * 0.5 + 0.5) * width),
          row = Math.floor((this.point.y * 0.5 + 0.5) * height);
        // Test the sign plane at the actual sampled cell, not at the unsnapped letter.
        // The scene buffer is twice the ASCII grid, with nearest depth sampling.
        this.point
          .set(((col + 0.75) / width) * 2 - 1, ((row + 0.75) / height) * 2 - 1, 0.5)
          .unproject(camera)
          .sub(camera.position);
        const denominator = this.point.x * sign.nx + this.point.z * sign.nz;
        if (Math.abs(denominator) < 0.000001) continue;
        const t =
          ((sign.x - camera.position.x) * sign.nx + (sign.z - camera.position.z) * sign.nz) / denominator;
        this.point.multiplyScalar(t).add(camera.position).project(camera);
        projected.push({ col, row, depth: this.point.z * 0.5 + 0.5, code: sign.text.charCodeAt(i) });
      }
      if (
        projected.length !== sign.text.length ||
        new Set(projected.map((p) => p.col)).size !== sign.text.length
      )
        continue;
      for (const p of projected) {
        if (p.col < 0 || p.col >= width || p.row < 0 || p.row >= height) continue;
        const index = (p.row * width + p.col) * 4;
        if (!this.values[index + 3] || this.values[index + 1] > p.depth) {
          this.values[index] = p.code;
          this.values[index + 1] = p.depth;
          this.values[index + 3] = 1;
        }
      }
    }
    this.texture.needsUpdate = true;
    return this.texture;
  }
  dispose() {
    this.texture.dispose();
  }
}

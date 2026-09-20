import * as THREE from 'three';
import { PlaceSite } from './place-kit';
import { school, stadium } from './site-schools';
import { theater, shopping, downtown } from './site-commerce';
import { monument, courthouse, library, postoffice, church } from './site-civic';
import type { WorldData } from './data';
import type { Interaction } from './park-models';

export class PlaceDetails {
  group = new THREE.Group();
  sites: PlaceSite[] = [];
  live = true;
  time = 0;
  constructor(data: WorldData, material: THREE.Material) {
    if (data.manifest.id !== 'warsaw') return;
    const site = (id: string, x: number, z: number) => new PlaceSite(id, x, z, data, material);
    this.sites = [
      monument(site('monument', -11, -276)),
      school(site('school', -338, -391)),
      stadium(site('athletic-field', -337, -609)),
      shopping(site('shopping-center', -26, -2180)),
      theater(site('movie-theater', -13, 44)),
      courthouse(site('courthouse', -44, -315)),
      downtown(site('downtown', 0, 0)),
      school(site('elementary-school', -394, -16), true),
      library(site('library', 23, -248)),
      postoffice(site('postoffice', -15, 74)),
      church(site('methodist', -40, -248), 'FIRST UNITED METHODIST', -27.7, -244, Math.PI / 2, -22, -237),
      church(site('trinity', -129, 40), 'TRINITY EPISCOPAL', -134, 20.7, Math.PI, -121, 15),
      church(site('baptist', -37, 132), 'FIRST BAPTIST', -18.96, 130, Math.PI / 2, -12, 142),
    ];
    for (const s of this.sites) this.group.add(s.finish().group);
  }
  get obstacles() {
    return this.sites.flatMap((s) => s.obstacles);
  }
  get signs() {
    return this.sites.flatMap((s) => s.signs);
  }
  get interactions() {
    return this.sites.flatMap((s) => s.interactions);
  }
  tick(dt: number, x: number, z: number) {
    if (this.live) this.time += dt;
    for (const s of this.sites) {
      s.group.visible = Math.hypot(x - s.x, z - s.z) < 550;
      if (s.group.visible && this.live && dt > 0) for (const animate of s.animations) animate(this.time, dt);
    }
  }
  nearestInteraction(x: number, z: number) {
    let best: Interaction | undefined,
      distance = 6;
    for (const s of this.sites) {
      if (Math.hypot(x - s.x, z - s.z) > 220) continue;
      for (const action of s.interactions) {
        if (!this.live && !action.static) continue;
        const p = action.object.position,
          d = Math.hypot(x - p.x, z - p.z);
        if (d < distance) {
          distance = d;
          best = action;
        }
      }
    }
    return best;
  }
}

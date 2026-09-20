export type Point2 = [number, number];
export type Point3 = [number, number, number];
export interface FacadeDetails {
  height?: number;
  floors?: number;
  color?: string;
  roof?: string;
  landmark?: string;
  style?: string;
  facing?: number;
  trim?: string;
  bayWidth?: number;
  roofHeight?: number;
  foundationDepth?: number;
  entrance?: { x: number; z: number };
  tower?: { x: number; z: number; height: number; width: number; spire?: number };
  sections?: { min: number; max: number; height: number; floors: number; color: string; style?: string }[];
  axis?: 'x' | 'z';
  references?: string[];
  note?: string;
}
export interface Building {
  id: string;
  ring: Point2[];
  holes: Point2[][];
  x: number;
  z: number;
  ground: number;
  height: number;
  floors: number;
  roof: string;
  color: string;
  type: string;
  residential: boolean;
  name: string;
  address: string;
  details: FacadeDetails;
  provenance: Record<string, string>;
}
export interface Road {
  id: string;
  name: string;
  type: string;
  width: number;
  bridge: boolean;
  oneway: string;
  layer: number;
  nodes: number[];
  anchors?: Point3[];
  points: Point3[];
}
export interface Area {
  id: string;
  type: 'forest' | 'water' | 'park' | 'parking';
  ring: Point2[];
  height: number;
}
export interface Landmark {
  id: string;
  name: string;
  x: number;
  z: number;
  monument?: boolean;
}
export interface Features {
  buildings: Building[];
  roads: Road[];
  areas: Area[];
  streams: { id: string; name: string; points: Point3[] }[];
  landmarks: Landmark[];
  facilities?: Facility[];
}
export interface Facility {
  id: string;
  type: 'basketball' | 'tennis' | 'baseball' | 'playground' | 'pool';
  name: string;
  ring: Point2[];
  height: number;
}
export type FixtureObstacle = { a: Point2; b: Point2; radius: number };
export interface TerrainGrid {
  x: number;
  z: number;
  step: number;
  width: number;
  height: number;
  file: string;
  values?: Float32Array;
  source: string;
  units: string;
}
export interface Pose {
  x: number;
  z: number;
  yaw: number;
  pitch?: number;
}
export interface Manifest {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  revision: string;
  curated: boolean;
  origin: { lon: number; lat: number; east: number; north: number; elevation: number; crs: number };
  bounds: [number, number, number, number];
  bbox: number[];
  seed: number;
  spawn: Pose;
  features: string;
  terrain: TerrainGrid[];
  chunkSize: number;
  counts: Record<string, number>;
  sources: { name: string; url: string; license: string; timestamp?: string; release?: string }[];
  limitations: string[];
}

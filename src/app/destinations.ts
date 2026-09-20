import type { Pose } from '../world/types';

export type Destination = {
  id: string;
  title: string;
  name: string;
  address: string;
  pose: Pose;
  featureId: string;
  source: string;
};

// Exterior viewpoints use the retained Warsaw map coordinates, in meters.
export const warsawDestinations: Destination[] = [
  {
    id: 'monument',
    title: 'Monument',
    name: 'Civil War Monument',
    address: 'Main Street & Court Street',
    pose: { x: 22, z: -281, yaw: 1.72, pitch: 0.2 },
    featureId: '4712378931',
    source: 'https://warsawnyhistory.org/tours/tour6.html',
  },
  {
    id: 'school',
    title: 'School',
    name: 'Warsaw Middle/High School',
    address: '81 West Court Street',
    pose: { x: -321, z: -339, yaw: 0, pitch: 0.04 },
    featureId: '7120249',
    source:
      'https://dec.ny.gov/news/environmental-notice-bulletin/2023-05-03/seqr/wyoming-county-the-warsaw-central-school',
  },
  {
    id: 'shopping-center',
    title: 'Shopping center',
    name: 'Warsaw Shopping Center',
    address: '461 North Main Street',
    pose: { x: 19, z: -2180, yaw: 0.85, pitch: 0.03 },
    featureId: '664425605',
    source: 'https://wycoida.org/sites-and-buildings/warsaw-shopping-center',
  },
  {
    id: 'movie-theater',
    title: 'Movie theater',
    name: 'Spotlight Theater',
    address: '23 South Main Street',
    pose: { x: 6, z: 44, yaw: Math.PI / 2, pitch: 0.1 },
    featureId: '477962348',
    source: 'https://www.spotlighttheater.com/',
  },
  {
    id: 'park',
    title: 'Park',
    name: 'Warsaw Village Park',
    address: 'Off Liberty Street',
    pose: { x: -486, z: 549, yaw: 2.38, pitch: 0.04 },
    featureId: '40527328',
    source:
      'https://www.villageofwarsawny.gov/wp-content/uploads/2025/03/Warsaw-2025-Comprehensive-Plan-HC.pdf',
  },
  {
    id: 'courthouse',
    title: 'Courthouse',
    name: 'Wyoming County Courthouse',
    address: 'West Court Street / Monument Circle',
    pose: { x: -16, z: -308, yaw: 1.76, pitch: 0.13 },
    featureId: '478525896',
    source: 'https://warsawnyhistory.org/tours/tour6.html',
  },
  {
    id: 'downtown',
    title: 'Downtown shops',
    name: 'Main & Buffalo corner',
    address: 'Main Street & Buffalo Street',
    pose: { x: -9.5, z: 12, yaw: -0.72, pitch: 0.09 },
    featureId: '477983260:facade-5-0',
    source: 'https://commons.wikimedia.org/wiki/File:North_Main_Street%2C_Warsaw%2C_New_York_-_20200503.jpg',
  },
  {
    id: 'elementary-school',
    title: 'Elementary school',
    name: 'Warsaw Elementary School',
    address: '153 West Buffalo Street',
    pose: { x: -397, z: 13, yaw: 0, pitch: 0.08 },
    featureId: '478975613',
    source: 'https://www.warsawcsd.org/',
  },
];

export const warsawLandmarkViews: Record<string, Pose> = {
  ...Object.fromEntries(warsawDestinations.map((d) => [d.featureId, d.pose])),
  '477953400': { x: -5, z: -220, yaw: -0.65, pitch: 0.06 },
  '477953401': { x: 3, z: -260, yaw: 1.96, pitch: 0.16 },
};

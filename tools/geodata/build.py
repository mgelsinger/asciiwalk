"""Build deterministic, portable world packs from real map geometry and elevation."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import sys
import urllib.parse
import urllib.request

import numpy as np
from pyproj import Transformer
from shapely import make_valid
from shapely.geometry import Polygon, MultiPolygon, LineString, Point, shape, box
from shapely.ops import transform, polygonize, unary_union
from shapely.strtree import STRtree

from terrain import acquire_grid, sample, write_grid, request_bytes

ROOT = Path(__file__).resolve().parents[2]
WARSAW_ORIGIN = (-78.132583, 42.7402213)
WARSAW_BBOX = [-78.150, 42.729, -78.112, 42.767]


def progress(stage, value):
    print(json.dumps({'stage': stage, 'progress': value}), flush=True)


def stable(value):
    return int(hashlib.sha256(str(value).encode()).hexdigest()[:8], 16)


def number(value, fallback):
    try:
        text = str(value)
        n = float(re.search(r'-?\d+(?:\.\d+)?', text)[0])
        return n * 0.3048 if 'ft' in text or "'" in text else n
    except (ValueError, TypeError):
        return fallback


def polygons(geometry):
    if geometry.is_empty:
        return []
    if isinstance(geometry, Polygon):
        return [geometry]
    return [p for g in getattr(geometry, 'geoms', []) for p in polygons(g)]


def element_polygons(element, project):
    def coords(items):
        return [project(a['lon'], a['lat']) for a in items if 'lon' in a]
    if element['type'] == 'way':
        points = coords(element.get('geometry', []))
        return polygons(make_valid(Polygon(points))) if len(points) >= 4 and points[0] == points[-1] else []
    if element['type'] == 'relation':
        outer, inner = [], []
        for member in element.get('members', []):
            points = coords(member.get('geometry', []))
            if len(points) > 1:
                (inner if member.get('role') == 'inner' else outer).append(LineString(points))
        if not outer:
            return []
        shell = unary_union(list(polygonize(outer)))
        holes = unary_union(list(polygonize(inner)))
        return polygons(make_valid(shell.difference(holes)))
    return []


def ring(poly):
    return [[round(x, 2), round(z, 2)] for x, z in poly.exterior.coords[:-1]]


def subtract_parts(poly, parts, tree):
    if tree is None:return [poly]
    contained=[parts[int(i)] for i in tree.query(poly) if parts[int(i)].intersection(poly).area/max(parts[int(i)].area,.01)>.95]
    return polygons(make_valid(poly.difference(unary_union(contained)))) if contained else [poly]


def fetch_osm(cache, bounds):
    file = cache/'osm.json'
    if file.exists():
        return json.loads(file.read_text())
    w, s, e, n = bounds
    keys = 'highway|building|building:part|landuse|natural|waterway|leisure|amenity|shop|historic|railway|barrier'
    query = f'[out:json][timeout:45];nwr[~"^({keys})$"~"."]({s},{w},{n},{e});out body geom;'
    url = os.environ.get('ASCII_WALK_OVERPASS', 'https://overpass-api.de/api/interpreter')
    request = urllib.request.Request(url, data=urllib.parse.urlencode({'data': query}).encode(), headers={'User-Agent': 'ASCIIWalk/0.1 local bounded area builder'})
    data = json.loads(request_bytes(request))
    if data.get('remark') or not data.get('elements'):
        raise ValueError('Map provider returned incomplete or empty data. Try again later.')
    file.write_text(json.dumps(data), encoding='utf-8')
    (cache/'osm-request.json').write_text(json.dumps({'url':url,'query':query,'bounds':bounds,'sourceTimestamp':data.get('osm3s',{}).get('timestamp_osm_base')},indent=2))
    return data


def build(world_id='warsaw', center=None, size=2000, name=None, output=None):
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', world_id):
        raise ValueError('Invalid world ID')
    is_warsaw = world_id == 'warsaw'
    center = WARSAW_ORIGIN if is_warsaw else center
    if not center or not (-125 <= center[0] <= -66 and 24 <= center[1] <= 50):
        raise ValueError('The current terrain adapter supports the contiguous United States.')
    crs = 32600 + int((center[0]+180)//6)+1
    projector = Transformer.from_crs(4326, crs, always_xy=True)
    ox, on = projector.transform(*center)
    def project(lon, lat):
        x, n = projector.transform(lon, lat)
        return x-ox, on-n
    inverse = Transformer.from_crs(crs, 4326, always_xy=True)
    bounds = WARSAW_BBOX if is_warsaw else [*inverse.transform(ox-size/2, on-size/2), *inverse.transform(ox+size/2, on+size/2)]
    cache = ROOT/'data/cache'/world_id
    cache.mkdir(parents=True, exist_ok=True)
    if is_warsaw:
        # Ship the numeric source snapshots so a clean checkout rebuilds offline.
        for source in (ROOT/'research/sources/warsaw').glob('terrain-*.tif'):
            if not (cache/source.name).exists():
                shutil.copyfile(source, cache/source.name)
    out = Path(output) if output else ROOT/'public/worlds'/world_id
    out.mkdir(parents=True, exist_ok=True)
    progress('Reading street geography', 0.05)
    source_file = ROOT/'research/warsaw-osm.json' if is_warsaw else cache/'osm.json'
    osm = json.loads(source_file.read_text()) if is_warsaw else fetch_osm(cache, bounds)
    elements = osm['elements']
    north_file = ROOT/'research/warsaw-north-osm.json'
    if is_warsaw and north_file.exists():
        # Preserve the original downtown snapshot; supplement only previously absent IDs.
        combined={(e['type'],e['id']):e for e in elements}
        for element in json.loads(north_file.read_text())['elements']:
            combined.setdefault((element['type'],element['id']),element)
        elements=list(combined.values())
    if len(elements) > 24000:
        raise ValueError('This area is too dense. Select a smaller rectangle.')
    progress('Preparing real elevation', 0.15)
    context = acquire_grid(cache, (ox, on), crs, 3200 if is_warsaw else size/2+1000, 8, 'context')
    detail = acquire_grid(cache, (ox, on), crs, 750 if is_warsaw else min(size/2, 1000), 2, 'core')
    elevation_origin = float(sample(detail, 0, 0))
    def ground(x, z):
        g = detail if detail['x'] <= x <= detail['x']+(detail['width']-1)*detail['step'] and detail['z'] <= z <= detail['z']+(detail['height']-1)*detail['step'] else context
        return float(sample(g, x, z)) - elevation_origin
    minx, maxz = project(bounds[0], bounds[1]); maxx, minz = project(bounds[2], bounds[3])
    extent = box(minx, minz, maxx, maxz)
    progress('Matching building footprints and heights', 0.35)
    ov_file = ROOT/'data/cache/warsaw-overture.geojson'
    if is_warsaw and not ov_file.exists():
        ov_file = ROOT/'research/sources/warsaw/overture-buildings.geojson'
    ov_shapes, ov_heights, ov_ids, ov_sources = [], [], [], []
    if is_warsaw and ov_file.exists():
        for feature in json.loads(ov_file.read_text())['features']:
            height = feature['properties'].get('height')
            if height and 2 < height < 120:
                poly = transform(project, shape(feature['geometry']))
                if poly.is_valid:
                    ov_shapes.append(poly); ov_heights.append(height); ov_ids.append(feature.get('id'));ov_sources.append(feature['properties'].get('sources',[]))
    tree = STRtree(ov_shapes) if ov_shapes else None
    overrides_file = ROOT/'data/overrides/warsaw/buildings.json'
    overrides = json.loads(overrides_file.read_text()) if is_warsaw and overrides_file.exists() else {}
    excluded = {member['ref'] for item in elements if item['type']=='relation' and 'building' in item.get('tags', {}) for member in item.get('members', []) if member.get('type')=='way'}
    parts=[p for item in elements if 'building:part' in item.get('tags',{}) for p in element_polygons(item,project)]
    part_tree=STRtree(parts) if parts else None
    buildings, roads, areas, streams, landmarks, facilities = [], [], [], [], [], []
    height_matches = 0
    for item in elements:
        t = item.get('tags', {}); key = str(item['id'])
        if ('building' in t or 'building:part' in t) and item['id'] not in excluded:
            outlines=element_polygons(item,project)
            if 'building:part' not in t:outlines=[part for poly in outlines for part in subtract_parts(poly,parts,part_tree)]
            building_type=t.get('building',t.get('building:part','yes'))
            for index, poly in enumerate(outlines):
                if poly.area < 12 or not poly.intersects(extent):
                    continue
                c = poly.centroid; residential = building_type in ['house','apartments','garage','detached','residential']
                height = number(t.get('height'), number(t.get('building:levels'), 2 if residential else 2)*3.3)
                provenance = 'osm' if 'height' in t or 'building:levels' in t else 'generated'
                height_match=None
                if tree is not None:
                    matches = []
                    for i in tree.query(poly):
                        overlap = poly.intersection(ov_shapes[i]).area
                        iou = overlap/(poly.area+ov_shapes[i].area-overlap)
                        if iou > 0.6:
                            matches.append((iou, int(i)))
                    if matches and provenance == 'generated':
                        score,best = max(matches); height = ov_heights[best]; provenance = 'overture'; height_matches += 1
                        height_match={'id':ov_ids[best],'intersectionOverUnion':round(score,4),'sources':ov_sources[best]}
                override = overrides.get(key, {})
                height = override.get('height', height)
                color = override.get('color', ['#b17a5d','#a68e70','#d7d1b5','#788e89','#b9b4a4'][stable(key)%5] if residential else ['#ad6651','#c7ad84','#b58a70','#bfc1ae'][stable(key)%4])
                floor_count = override.get('floors', max(1, round(height/3.5)))
                roof = override.get('roof',t.get('roof:shape','gable' if residential and building_type != 'apartments' else 'flat'))
                entry = {'id':key+(':'+str(index) if index else ''), 'ring':ring(poly), 'holes':[[[round(x,2),round(z,2)] for x,z in hole.coords[:-1]] for hole in poly.interiors],
                         'x':round(c.x,2),'z':round(c.y,2),'ground':round(ground(c.x,c.y),2), 'height':round(max(2.5,height),2),
                         'floors':floor_count,'roof':roof,'color':color,'type':building_type, 'residential':residential,
                         'name':t.get('name',''),'address':' '.join(filter(None,[t.get('addr:housenumber'),t.get('addr:street')])),
                         'provenance':{'footprint':'osm','height':('generated_estimate' if override.get('inferred') else 'reference_estimate') if 'height' in override else provenance,'facade':'reference_estimate' if override.get('references') else 'generated','roof':'reference_estimate' if override.get('references') and 'roof' in override else 'generated'},
                         'details':{**override,'foundationDepth':round(max(1,ground(c.x,c.y)-min(ground(x,z) for x,z in poly.exterior.coords)+.8),2)}}
                if height_match:entry['heightMatch']=height_match
                buildings.append(entry)
                if override.get('landmark'):
                    landmarks.append({'id':key, 'name':override['landmark'],'x':entry['x'],'z':entry['z']})
        if 'highway' in t and item['type']=='way' and len(item.get('geometry',[]))>1:
            coords=[project(a['lon'],a['lat']) for a in item['geometry']]
            line=LineString(coords)
            if line.length<1: continue
            defaults={'primary':14,'primary_link':6,'secondary':10,'tertiary':8,'residential':7,'unclassified':6,'service':4,'footway':1.6,'path':1.4,'track':2.8,'steps':1.5}
            width=number(t.get('width'),defaults.get(t['highway'],6))
            count=max(2,math.ceil(line.length/8)+1)
            points=[line.interpolate(i/(count-1),normalized=True) for i in range(count)]
            ys=np.array([ground(p.x,p.y) for p in points])
            if t.get('bridge') in ['yes','viaduct']:
                ys=np.linspace(ys[0],ys[-1],count)
            elif count>4:
                ys[1:-1]=np.convolve(ys,np.array([.25,.5,.25]),'valid')
            roads.append({'id':key,'name':t.get('name',''),'type':t['highway'],'width':width,'bridge':t.get('bridge','no')!='no',
                          'oneway':t.get('oneway','no'),'layer':int(number(t.get('layer'),0)), 'nodes':item.get('nodes',[]),
                          'anchors':[[round(x,2),round(ground(x,z),2),round(z,2)] for x,z in coords],
                          'points':[[round(p.x,2),round(float(y),2),round(p.y,2)] for p,y in zip(points,ys)]})
        facility_type = 'pool' if t.get('leisure')=='swimming_pool' else 'playground' if t.get('leisure')=='playground' else ('baseball' if t.get('sport')=='tee-ball' else t.get('sport')) if t.get('leisure')=='pitch' else None
        if facility_type in ['pool','playground','basketball','tennis','baseball']:
            for p in element_polygons(item,project):
                if p.area>8 and p.intersects(extent):
                    facilities.append({'id':key,'type':facility_type,'name':t.get('name',''),'ring':ring(p),'height':round(ground(p.centroid.x,p.centroid.y),2)})
        area_type = 'parking' if t.get('amenity')=='parking' else 'forest' if t.get('landuse')=='forest' or t.get('natural')=='wood' else 'water' if t.get('natural')=='water' else 'park' if t.get('leisure') in ['park','pitch','garden'] or t.get('landuse') in ['grass','meadow','recreation_ground','cemetery'] else None
        if area_type:
            for p in element_polygons(item,project):
                if p.area>15:
                    areas.append({'id':key,'type':area_type,'ring':ring(p),'height':round(ground(p.centroid.x,p.centroid.y),2)})
        if 'waterway' in t and item['type']=='way' and len(item.get('geometry',[]))>1:
            streams.append({'id':key,'name':t.get('name',''),'points':[[round(x,2),round(ground(x,z)-.3,2),round(z,2)] for x,z in [project(a['lon'],a['lat']) for a in item['geometry']]]})
        if t.get('historic') in ['monument','memorial'] and item['type']=='node':
            x,z=project(item['lon'],item['lat'])
            if math.hypot(x,z)<600:
                landmarks.append({'id':key,'name':t.get('name','Memorial'),'x':round(x,2),'z':round(z,2),'monument':True})
    if not buildings or not roads:
        raise ValueError('Not enough buildings and streets were found in the selected area.')
    progress('Packaging world geometry', 0.75)
    divided=[]
    for building in buildings:
        sections=building['details'].get('sections',[])
        if not sections:
            divided.append(building)
            continue
        source_poly=Polygon(building['ring'],building['holes'])
        for i,section in enumerate(sections):
            cutter=box(-10000,section['min'],10000,section['max']) if building['details'].get('axis','z')=='z' else box(section['min'],-10000,section['max'],10000)
            for j,part in enumerate(polygons(source_poly.intersection(cutter))):
                if part.area<2:continue
                divided.append({**building,'id':f"{building['id']}:facade-{i}-{j}",'ring':ring(part),'holes':[[[round(x,2),round(z,2)] for x,z in hole.coords[:-1]] for hole in part.interiors],
                                'x':round(part.centroid.x,2),'z':round(part.centroid.y,2),'height':section['height'],'floors':section['floors'],'color':section['color'],
                                'details':{**{k:v for k,v in building['details'].items() if k!='sections'},**section},
                                'provenance':{**building['provenance'],'height':'reference_estimate','facade':'reference_estimate'}})
    buildings=divided
    existing_landmarks={l['id'] for l in landmarks}
    for building in buildings:
        if building['details'].get('landmark') and building['id'] not in existing_landmarks:
            landmarks.append({'id':building['id'],'name':building['details']['landmark'],'x':building['x'],'z':building['z']})
    data={'buildings':sorted(buildings,key=lambda b:b['id']),'roads':roads,'areas':areas,'streams':streams,'landmarks':landmarks,'facilities':facilities}
    encoded=json.dumps(data,separators=(',',':'),ensure_ascii=True).encode()
    vertex_count=sum(len(b['ring'])+sum(map(len,b['holes'])) for b in buildings)+sum(len(r['points']) for r in roads)
    if len(encoded)>24_000_000 or vertex_count>250_000:
        raise ValueError('This area exceeds the geometry memory budget. Select a smaller rectangle.')
    (out/'features.json').write_bytes(encoded)
    terrain=[write_grid(context,out,'context',elevation_origin),write_grid(detail,out,'core',elevation_origin)]
    landmarks.sort(key=lambda x:x['name'])
    spawn={'x':22,'z':-281,'yaw':1.72,'pitch':.2} if is_warsaw else {'x':roads[0]['points'][0][0]+roads[0]['width']/2+1,'z':roads[0]['points'][0][2],'yaw':0}
    manifest={'schemaVersion':1,'id':world_id,'name':name or ('Warsaw, New York' if is_warsaw else world_id),'description':'The village in the valley' if is_warsaw else 'A new place, in characters',
              'origin':{'lon':center[0],'lat':center[1],'east':ox,'north':on,'elevation':elevation_origin,'crs':crs},
              'bounds':[round(v,2) for v in [minx,minz,maxx,maxz]],'bbox':bounds,'seed':stable(world_id),'spawn':spawn,
              'features':'features.json','terrain':terrain,'chunkSize':250,'revision':hashlib.sha256(encoded).hexdigest()[:12],
              'sources':[{'name':'OpenStreetMap contributors','url':'https://www.openstreetmap.org/copyright','license':'ODbL-1.0','timestamp':osm.get('osm3s',{}).get('timestamp_osm_base')},
                         {'name':'USGS 3DEP','url':'https://www.usgs.gov/3d-elevation-program','license':'US government elevation data; product metadata retained'}],
              'counts':{'buildings':len(buildings),'roads':len(roads),'heightMatches':height_matches,'landmarks':len(landmarks),'facilities':len(facilities)},
              'curated':is_warsaw,'limitations':['Building appearance combines dated references, source heights, and generated detail.','Vegetation, pedestrians and traffic are simulated.','Recreation footprints are mapped; equipment, markings and furnishings are inferred. Park activity is simulated.']}
    manifest['buildToolVersion']='0.1.0'
    manifest['contextBounds']=[context['x'],context['z'],context['x']+(context['width']-1)*context['step'],context['z']+(context['height']-1)*context['step']]
    manifest['inputs']=[{'name':'OpenStreetMap snapshot','sha256':hashlib.sha256(source_file.read_bytes()).hexdigest(),'timestamp':osm.get('osm3s',{}).get('timestamp_osm_base')}]
    if is_warsaw and north_file.exists():manifest['inputs'].append({'name':'OpenStreetMap north retail extension','sha256':hashlib.sha256(north_file.read_bytes()).hexdigest(),'timestamp':json.loads(north_file.read_text()).get('osm3s',{}).get('timestamp_osm_base')})
    if is_warsaw and overrides_file.exists():manifest['inputs'].append({'name':'Warsaw architectural overrides','sha256':hashlib.sha256(overrides_file.read_bytes()).hexdigest()})
    if is_warsaw and ov_file.exists():manifest['inputs'].append({'name':'Overture buildings 2026-08-19.0','sha256':hashlib.sha256(ov_file.read_bytes()).hexdigest()})
    manifest['chunkIndex']={}
    for b in buildings:
        owner=f"{math.floor(b['x']/250)},{math.floor(b['z']/250)}"
        manifest['chunkIndex'].setdefault(owner,{'buildings':[]})['buildings'].append(b['id'])
    revision_input=encoded+b''.join((out/g['file']).read_bytes() for g in terrain)
    manifest['revision']=hashlib.sha256(revision_input).hexdigest()[:12]
    if height_matches:
        manifest['sources'].append({'name':'Overture Maps and upstream contributors','url':'https://docs.overturemaps.org/attribution/','license':'ODbL-1.0; upstream notices apply','release':'2026-08-19.0'})
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8',newline='\n')
    progress('World ready',1)
    return manifest


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--id',default='warsaw');parser.add_argument('--lon',type=float);parser.add_argument('--lat',type=float)
    parser.add_argument('--size',type=int,default=2000);parser.add_argument('--name');parser.add_argument('--output')
    args=parser.parse_args()
    try:
        if not 500<=args.size<=4000:raise ValueError('Area size must be between 500 and 4000 meters.')
        build(args.id, (args.lon,args.lat) if args.lon is not None and args.lat is not None else None,args.size,args.name,args.output)
    except Exception as error:
        print(json.dumps({'error':str(error)}),flush=True)
        sys.exit(1)

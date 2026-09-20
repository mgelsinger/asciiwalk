"""Create a character map from a cached, bounded OSM request without fetching terrain."""
import argparse
import json
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import Point, LineString
from shapely.strtree import STRtree
from build import ROOT, fetch_osm, element_polygons, progress

def preview(world_id, lat, lon, size, output):
    crs=32600+int((lon+180)//6)+1
    forward=Transformer.from_crs(4326,crs,always_xy=True)
    reverse=Transformer.from_crs(crs,4326,always_xy=True)
    ox,on=forward.transform(lon,lat)
    bounds=[*reverse.transform(ox-size/2,on-size/2),*reverse.transform(ox+size/2,on+size/2)]
    cache=ROOT/'data/cache'/world_id;cache.mkdir(parents=True,exist_ok=True)
    progress('Reading streets for the preview',.2)
    osm=fetch_osm(cache,bounds)
    def project(lon,lat):
        x,y=forward.transform(lon,lat);return x-ox,on-y
    buildings=[]; roads=[]; water=[]
    for item in osm['elements']:
        tags=item.get('tags',{})
        if 'building' in tags:buildings.extend(element_polygons(item,project))
        if tags.get('natural')=='water':water.extend(element_polygons(item,project))
        if 'highway' in tags and item['type']=='way' and len(item.get('geometry',[]))>1:
            roads.append(LineString([project(p['lon'],p['lat']) for p in item['geometry']]).buffer(size/100))
    shapes=water+roads+buildings; glyphs=['~']*len(water)+['.']*len(roads)+['#']*len(buildings)
    tree=STRtree(shapes); width,height=49,25; lines=[]
    for row in range(height):
        line=''
        for col in range(width):
            p=Point((col/(width-1)-.5)*size,(row/(height-1)-.5)*size)
            hits=tree.query(p,predicate='intersects')
            line+='+' if col==width//2 and row==height//2 else glyphs[max(hits)] if len(hits) else ' '
        lines.append('|'+line+'|')
    text='+'+'-'*width+'+\n'+'\n'.join(lines)+'\n+'+'-'*width+'+'
    result={'text':text,'buildings':len(buildings),'roads':len(roads),'bounds':bounds}
    Path(output).mkdir(parents=True,exist_ok=True)
    (Path(output)/'preview.json').write_text(json.dumps(result))
    progress('Preview ready',1)

if __name__=='__main__':
    p=argparse.ArgumentParser()
    for key in ['id','output']:p.add_argument('--'+key,required=True)
    for key in ['lat','lon','size']:p.add_argument('--'+key,type=float,required=True)
    p.add_argument('--name')
    a=p.parse_args()
    try:preview(a.id,a.lat,a.lon,a.size,a.output)
    except Exception as e:
        print(json.dumps({'error':str(e)}),flush=True);raise SystemExit(1)

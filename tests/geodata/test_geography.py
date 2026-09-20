import sys
from pathlib import Path
import json
import numpy as np
import pytest
from pyproj import Transformer
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools/geodata'))
from build import element_polygons, subtract_parts, number, WARSAW_ORIGIN
from shapely.geometry import box
from shapely.strtree import STRtree
from terrain import fill_gaps, sample

def geometry(points): return [{'lon':x,'lat':y} for x,y in points]

def test_known_origin_and_axis_orientation():
    project=Transformer.from_crs(4326,32617,always_xy=True)
    x,y=project.transform(*WARSAW_ORIGIN)
    assert x==pytest.approx(734708.5065,abs=.01)
    assert y==pytest.approx(4735955.1374,abs=.01)
    east,north=project.transform(WARSAW_ORIGIN[0]+.001,WARSAW_ORIGIN[1]+.001)
    assert east>x and y-north<0

def test_relation_joins_member_ways_and_preserves_hole():
    outer=[(0,0),(20,0),(20,20),(0,20),(0,0)]
    hole=[(5,5),(5,15),(15,15),(15,5),(5,5)]
    relation={'type':'relation','members':[{'role':'outer','geometry':geometry(outer[:3])},{'role':'outer','geometry':geometry(outer[2:])},{'role':'inner','geometry':geometry(hole)}]}
    result=element_polygons(relation,lambda x,y:(x,y))
    assert len(result)==1 and result[0].area==300 and len(result[0].interiors)==1

def test_invalid_polygon_repaired_and_open_way_rejected():
    shape={'type':'way','geometry':geometry([(0,0),(10,10),(0,10),(10,0),(0,0)])}
    assert sum(p.area for p in element_polygons(shape,lambda x,y:(x,y)))==50
    shape['geometry'].pop()
    assert element_polygons(shape,lambda x,y:(x,y))==[]

def test_building_parts_replace_overlapping_parent_geometry():
    parts=[box(0,0,10,20)];result=subtract_parts(box(0,0,20,20),parts,STRtree(parts))
    assert sum(p.area for p in result)==200
    assert all(p.intersection(parts[0]).area==0 for p in result)

def test_units_and_nodata_without_wraparound():
    assert number('20 ft',0)==pytest.approx(6.096)
    values=np.array([[np.nan,2,100],[4,6,100],[100,100,100]],dtype=np.float32)
    assert fill_gaps(values)[0,0]==3
    with pytest.raises(ValueError):fill_gaps(np.full((4,4),np.nan))

def test_pack_invariants():
    root=Path(__file__).resolve().parents[2]/'public/worlds/warsaw'
    manifest=json.loads((root/'manifest.json').read_text());features=json.loads((root/'features.json').read_text())
    ids=[b['id'] for b in features['buildings']]
    assert len(ids)==len(set(ids)) and len(ids)>1300
    assert manifest['counts']['heightMatches']>1000
    assert len(features['landmarks'])>=6
    for grid in manifest['terrain']:
        values=np.fromfile(root/grid['file'],dtype='<f4')
        assert len(values)==grid['width']*grid['height'] and np.isfinite(values).all()

"""Retrieve and retain bounded, numeric USGS terrain. Runtime coordinates are meters."""
import hashlib
import json
import urllib.parse
import urllib.request
import urllib.error
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import numpy as np
import rasterio

SERVICE = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer'
HEADERS = {'User-Agent': 'ASCIIWalk/0.1 local world preparation'}


def request_bytes(url):
    request = url if isinstance(url, urllib.request.Request) else urllib.request.Request(url, headers=HEADERS)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code not in [429, 502, 503, 504] or attempt == 2:
                raise ValueError(f'Data provider returned HTTP {error.code}. Retry later; existing worlds are safe.') from error
            delay = 3 * (attempt + 1)
            retry = error.headers.get('Retry-After')
            if retry:
                try: delay = max(delay, float(retry))
                except ValueError: delay = max(delay, (parsedate_to_datetime(retry)-datetime.now(timezone.utc)).total_seconds())
            if delay > 300: raise ValueError(f'Data provider asks for a {round(delay)} second pause. Retry later.') from error
            time.sleep(delay)


def fill_gaps(data):
    data = data.copy()
    for _ in range(20):
        missing = ~np.isfinite(data)
        if not missing.any(): return data
        padded = np.pad(data, 1, constant_values=np.nan)
        neighbors = np.stack([padded[:-2,1:-1],padded[2:,1:-1],padded[1:-1,:-2],padded[1:-1,2:]])
        counts = np.sum(np.isfinite(neighbors),axis=0)
        averages = np.divide(np.nansum(neighbors,axis=0),counts,out=np.full(data.shape,np.nan),where=counts>0)
        data[missing] = averages[missing]
    if not np.isfinite(data).all(): raise ValueError('Unresolved gaps in elevation samples.')
    return data


def acquire_grid(cache, origin, crs, half, resolution, label):
    cache = Path(cache)
    cache.mkdir(parents=True, exist_ok=True)
    target = cache / f'terrain-{label}.tif'
    width = int(half * 2 / resolution)
    if not target.exists():
        east, north = origin
        params = {'f': 'json', 'bbox': f'{east-half},{north-half},{east+half},{north+half}',
                  'bboxSR': crs, 'imageSR': crs, 'size': f'{width},{width}',
                  'format': 'tiff', 'pixelType': 'F32',
                  'renderingRule': json.dumps({'rasterFunction': 'None'})}
        result = json.loads(request_bytes(SERVICE + '/exportImage?' + urllib.parse.urlencode(params)))
        if 'href' not in result:
            raise ValueError(f'Terrain export failed: {result}')
        (cache / f'terrain-{label}-response.json').write_text(json.dumps(result, indent=2))
        (cache / f'terrain-{label}-request.json').write_text(json.dumps({'url':SERVICE+'/exportImage','parameters':params,'retrieved':datetime.now(timezone.utc).isoformat()},indent=2))
        temporary = target.with_suffix('.partial')
        temporary.write_bytes(request_bytes(result['href']))
        temporary.replace(target)
    with rasterio.open(target) as source:
        if source.crs.to_epsg() != crs or source.transform.a <= 0 or abs(source.transform.a + source.transform.e) > .001:
            raise ValueError('Unexpected terrain CRS or pixel spacing.')
        if source.count != 1 or not source.dtypes[0].startswith('float'):
            raise ValueError('Expected numeric single-band floating point elevation, not hillshade.')
        values = source.read(1, masked=True)
        invalid = np.ma.getmaskarray(values) | ~np.isfinite(values.filled(np.nan))
        if invalid.mean() > 0.01:
            raise ValueError('Elevation does not cover this area. Choose a supported US location.')
        data = fill_gaps(values.filled(np.nan).astype(np.float32))
        transform = source.transform
        result = {'x': transform.c + transform.a/2 - origin[0],
                  'z': origin[1] - (transform.f + transform.e/2),
                  'step': transform.a, 'width': source.width, 'height': source.height,
                  'values': data, 'source': SERVICE, 'sourceCrs': str(source.crs),
                  'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                  'units': 'meters', 'verticalDatum': 'USGS 3DEP service native orthometric height'}
        return result


def sample(grid, x, z):
    col = np.clip((np.asarray(x) - grid['x']) / grid['step'], 0, grid['width']-1.001)
    row = np.clip((np.asarray(z) - grid['z']) / grid['step'], 0, grid['height']-1.001)
    ix, iz = np.floor(col).astype(int), np.floor(row).astype(int)
    fx, fz = col-ix, row-iz
    a = grid['values']
    return (a[iz, ix]*(1-fx)+a[iz, ix+1]*fx)*(1-fz)+(a[iz+1, ix]*(1-fx)+a[iz+1, ix+1]*fx)*fz


def write_grid(grid, output, label, elevation_origin):
    file = f'terrain-{label}.bin'
    (Path(output)/file).write_bytes((grid['values']-elevation_origin).astype('<f4').tobytes())
    return {**{k:v for k,v in grid.items() if k != 'values'}, 'file': file}

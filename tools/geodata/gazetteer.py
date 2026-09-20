import io
import json
from pathlib import Path
import urllib.request
import zipfile

root=Path(__file__).resolve().parents[2]
cache=root/'data/cache/cities500.zip'
cache.parent.mkdir(parents=True,exist_ok=True)
if not cache.exists():
    with urllib.request.urlopen('https://download.geonames.org/export/dump/cities500.zip',timeout=60) as r:
        cache.write_bytes(r.read())
towns=[]
with zipfile.ZipFile(cache) as archive:
    for line in io.TextIOWrapper(archive.open('cities500.txt'),encoding='utf-8'):
        c=line.rstrip('\n').split('\t')
        if c[8]=='US' and -125<=float(c[5])<=-66 and 24<=float(c[4])<=50:
            towns.append({'name':c[2],'region':c[10],'lat':float(c[4]),'lon':float(c[5]),'population':int(c[14] or 0)})
towns.sort(key=lambda x:-x['population'])
(root/'data/gazetteer-us.json').write_text(json.dumps(towns,separators=(',',':'),ensure_ascii=True),encoding='utf-8')
print('Installed',len(towns),'US places from GeoNames cities500, CC BY 4.0.')

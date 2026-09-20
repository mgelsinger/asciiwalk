"""Rebuild from the cache and check packaged geometry, references and byte budgets."""
import hashlib,json,gzip
from pathlib import Path
from collections import Counter
from build import ROOT,build

def main():
    staging=(ROOT/'data/jobs/rebuild-audit').resolve()
    assert staging.is_relative_to((ROOT/'data/jobs').resolve())
    build('warsaw',output=staging)
    shipped=ROOT/'public/worlds/warsaw'
    files=['features.json','terrain-core.bin','terrain-context.bin','manifest.json']
    identical=all((staging/f).read_bytes()==(shipped/f).read_bytes() for f in files)
    assert identical,'Cached rebuild must match the shipped Warsaw pack byte for byte.'
    feature=json.loads((shipped/'features.json').read_text())
    m=json.loads((shipped/'manifest.json').read_text())
    authored=[b for b in feature['buildings'] if b['details'].get('references')]
    result={'schemaVersion':1,'revision':m['revision'],'identicalCachedRebuild':identical,'files':{f:{'bytes':(shipped/f).stat().st_size,'gzipBytes':len(gzip.compress((shipped/f).read_bytes())),'sha256':hashlib.sha256((shipped/f).read_bytes()).hexdigest()}for f in files},'counts':m['counts'],'heightProvenance':dict(Counter(b['provenance']['height']for b in feature['buildings'])),'referenceInformedEntries':len(authored),'authoredInventory':[{'id':b['id'],'address':b['address'],'center':[b['x'],b['z']],'height':b['height'],'floors':b['floors'],'references':b['details']['references'],'note':b['details'].get('note')}for b in authored]}
    target=ROOT/'docs/validation/data-audit.json';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(result,indent=2))
    print(json.dumps({k:v for k,v in result.items() if k!='authoredInventory'},indent=2))

if __name__=='__main__':main()

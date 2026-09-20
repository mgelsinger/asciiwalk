"""Download explicitly licensed architectural references into the local research cache."""
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

FILES = {
    'north-main': 'North_Main_Street,_Warsaw,_New_York_-_20200503.jpg',
    'west-buffalo': 'West_Buffalo_Street_looking_west_from_Main_Street,_Warsaw,_New_York_-_20200503.jpg',
    'main-south': 'NY_19_through_Warsaw.jpg',
    'main-east': 'East_Side_of_N_Main_St_Warsaw_Downtown_Historic_District_Oct_09.jpg',
    'library': 'Warsaw_Public_Library_Oct_09.jpg',
    'courthouse': 'Wyoming_County_Courthouse_taken_2013.jpg',
    'circle': 'Monument_Circle,_historic_district,_Warsaw_NY_2013.jpg',
    'downtown-2013': 'Downtown_historic_district_in_Warsaw,_New_York,_2013.jpg',
    'downtown-west': 'Downtown_Warsaw_(NY)_Historic_District_in_2013.jpg',
}


def main():
    folder = Path('data/cache/references')
    folder.mkdir(parents=True, exist_ok=True)
    records = []
    for key, title in FILES.items():
        page = 'https://commons.wikimedia.org/wiki/File:' + urllib.parse.quote(title)
        page_file = folder / f'{key}-page.html'
        def fetch(url):
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'ASCIIWalk/0.1 local architectural research'}), timeout=35) as response:
                return response.read()
        if not page_file.exists():
            page_file.write_bytes(fetch(page))
        source = page_file.read_text(encoding='utf-8')
        categories_match=re.search(r'"wgCategories":(\[[^\]]+\])',source)
        categories=json.loads(categories_match[1]) if categories_match else []
        urls = re.findall(r'href="(https://upload.wikimedia.org/wikipedia/commons/[^\"]+)"', source)
        original = next((html.unescape(url).split('?')[0] for url in urls if '/thumb/' not in url and url.split('?')[0].lower().endswith(('.jpg', '.jpeg', '.png'))), None)
        licenses = ['https://creativecommons.org/licenses/by-sa/'+label.split('-')[-1]+'/' for label in categories if re.fullmatch(r'CC-BY-SA-\d\.\d',label)]
        if not original or not licenses:
            print('No verified image/license', key)
            continue
        target = folder/f'{key}.jpg'
        if not target.exists():
            target.write_bytes(fetch(original))
        plain=html.unescape(re.sub('<[^>]+>',' ',source));plain=re.sub(r'\s+',' ',plain)
        author=re.search(r'Author (.+?) (?:Camera location|Licensing|Permission)',plain)
        dates=[c.removeprefix('United States photographs taken on ') for c in categories if c.startswith('United States photographs taken on ')]
        records.append({'id': key, 'page': page, 'image': original, 'licenseUrls': licenses,'author':author[1] if author else 'See source page','date':dates[0] if dates else 'See source page',
                        'use': 'Architectural observation; source photo not included in application.'})
        print('Saved', key, flush=True)
    Path('research/reference-sources.json').write_text(json.dumps(records, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()

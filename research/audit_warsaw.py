"""Small, cached data availability check for the ASCII Walk implementation plan."""
import collections
import datetime
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent
BBOX = [-78.150, 42.729, -78.112, 42.759]  # west, south, east, north
HEADERS = {"User-Agent": "ascii-walk-planning/0.1 (local project research)"}


def fetch_json(url, target, data=None):
    path = ROOT / target
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    request = urllib.request.Request(url, data=data, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=55) as response:
        value = json.load(response)
    path.write_text(json.dumps(value, ensure_ascii=True, indent=2), encoding="utf-8")
    return value


def main():
    west, south, east, north = BBOX
    bbox_text = f"{south},{west},{north},{east}"
    keys = "highway|building|building:part|landuse|natural|waterway|leisure|amenity|shop|tourism|historic|railway|barrier"
    query = f'[out:json][timeout:45];nwr[~"^({keys})$"~"."]({bbox_text});out body geom;'
    (ROOT / "warsaw-query.overpassql").write_text(query + "\n", encoding="utf-8")
    osm = fetch_json("https://overpass-api.de/api/interpreter", "warsaw-osm.json", urllib.parse.urlencode({"data": query}).encode())
    if osm.get("remark"):
        raise RuntimeError(f"Overpass returned a remark; inspect for incomplete data: {osm['remark']}")
    rows = osm.get("elements", [])
    buildings = [x for x in rows if x["type"] in ("way", "relation") and "building" in x.get("tags", {})]
    roads = [x for x in rows if x["type"] == "way" and "highway" in x.get("tags", {})]
    building_details = {tag: sum(tag in x.get("tags", {}) for x in buildings) for tag in ["height", "building:levels", "roof:shape", "roof:height", "building:colour", "building:material", "name", "addr:housenumber"]}
    summary = {
        "checked_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "bbox_wsen": BBOX,
        "osm_timestamp": osm.get("osm3s", {}).get("timestamp_osm_base"),
        "source": "https://overpass-api.de/api/interpreter",
        "license": "OpenStreetMap ODbL; https://www.openstreetmap.org/copyright",
        "query_sha256": hashlib.sha256(query.encode()).hexdigest(),
        "raw_file_sha256": hashlib.sha256((ROOT / "warsaw-osm.json").read_bytes()).hexdigest(),
        "element_count": len(rows),
        "building_elements": len(buildings),
        "building_detail_counts": building_details,
        "building_type_counts": dict(collections.Counter(x["tags"]["building"] for x in buildings)),
        "highway_way_count": len(roads),
        "highway_type_counts": dict(collections.Counter(x["tags"]["highway"] for x in roads)),
        "named_roads": sorted(set(x["tags"]["name"] for x in roads if "name" in x["tags"])),
        "road_detail_counts": {tag: sum(tag in x["tags"] for x in roads) for tag in ["width", "lanes", "sidewalk", "sidewalk:left", "sidewalk:right", "bridge", "layer", "oneway"]},
        "landscape_counts": {f"{key}={value}": sum(x.get("tags", {}).get(key) == value for x in rows) for key, value in [("natural", "tree"), ("natural", "wood"), ("landuse", "forest"), ("natural", "water"), ("waterway", "stream")]},
        "named_buildings": [{"id": f"{x['type']}/{x['id']}", "tags": {k:v for k,v in x["tags"].items() if k in ["name", "building", "height", "building:levels", "addr:housenumber", "addr:street", "amenity", "historic"]}} for x in buildings if "name" in x["tags"]],
        "notes": ["Element counts are not deduplicated physical building counts.", "Missing tags do not prove missing structures or geometry.", "Bounding box is a planning area, not the village boundary."]
    }
    main_nodes = {n for x in roads if x["tags"].get("name") in ["North Main Street", "South Main Street"] for n in x.get("nodes", [])}
    buffalo_nodes = {n for x in roads if x["tags"].get("name") in ["East Buffalo Street", "West Buffalo Street"] for n in x.get("nodes", [])}
    common_nodes = main_nodes & buffalo_nodes
    summary["main_buffalo_intersection"] = next(({"osm_node": n, **geometry} for x in roads for n, geometry in zip(x.get("nodes", []), x.get("geometry", [])) if n in common_nodes), None)
    (ROOT / "warsaw-data-audit.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    elevation_params = urllib.parse.urlencode({"bbox": ",".join(map(str, BBOX)), "datasets": "Digital Elevation Model (DEM) 1 meter", "max": 10, "outputFormat": "JSON"})
    elevation = fetch_json("https://tnmaccess.nationalmap.gov/api/v1/products?" + elevation_params, "warsaw-elevation-catalog.json")
    print(json.dumps({k:v for k,v in summary.items() if k not in ["named_buildings", "named_roads"]}, indent=2))
    print("USGS one-meter DEM catalog matches:", elevation.get("total"))


if __name__ == "__main__":
    main()

# Retained Warsaw source inputs

These small, bounded inputs are versioned so the bundled Warsaw world can be rebuilt from a fresh checkout. They are source geography, not downloaded reference photographs.

| File in `warsaw/` | Source and purpose |
| --- | --- |
| `overture-buildings.geojson` | Overture Maps release `2026-08-19.0`, bounds `[-78.150, 42.729, -78.112, 42.759]`; height candidates with original feature IDs and upstream source records |
| `terrain-context.tif` | Numeric USGS 3DEP context elevation, 800 x 800 samples at 8 m |
| `terrain-core.tif` | Numeric USGS 3DEP core elevation, 750 x 750 samples at 2 m |
| `terrain-*-response.json` | USGS export metadata; temporary output URLs are provenance, not dependencies for a rebuild |

The OSM snapshots are in `research/warsaw-osm.json` and `research/warsaw-north-osm.json`. Architectural overrides are in `data/overrides/warsaw/buildings.json`.

`npm run validate:assets` compares source SHA-256 values against the shipped manifest. A Warsaw rebuild copies retained TIFFs into the ignored cache only when no local cached version exists. A local Overture cache takes precedence over the retained snapshot. Existing local experiments are not overwritten.

See [data notices](../../public/DATA_LICENSES.txt) and [reproducibility notes](../../docs/DATA.md). Overture and its upstream OSM/Microsoft data retain their ODbL notices. Terrain comes from USGS 3DEP; CRS, resolution, units, and checksums remain in the world manifest.

# Data and reproducibility

## Warsaw snapshot

The study bounds are west -78.150, south 42.729, east -78.112, north 42.767. They describe a village-centered exploration area, not an administrative town boundary. Streets and building outlines combine the September 12, 2026 OpenStreetMap extraction in `research/warsaw-osm.json` with the September 13 northern supplement in `research/warsaw-north-osm.json`. The supplement extends North Main through the shopping corridor. Duplicate source IDs retain the original snapshot's geometry.

Main/Buffalo is OSM node 221701159 at longitude -78.132583, latitude 42.7402213. EPSG:32617 places it at easting 734708.506535 and northing 4735955.137365 m. Runtime x is easting minus the origin; runtime z is origin northing minus northing. Ground height is relative to 308.1391449 m, the sampled origin elevation.

The current pack contains 1,428 building/facade entries and 427 roadway/path ways. Dividing continuous mapped downtown blocks produces multiple facade entries for some raw building elements. These counts do not imply that all structures or physical street segments have been independently surveyed. Road anchor coordinates retain original junction nodes separately from the smoothed render geometry; the navigation display uses shared anchors and road layers to identify crossings. Mapped parking lots receive inferred pavement and bay markings.

The bounded Overture 2026-08-19.0 extract has 1,691 building features, 1,507 with a height field. Valid height candidates match OSM polygons only above 0.60 intersection-over-union. There are 1,134 matches before architectural overrides. The shipped heights are 1,123 from Overture, 3 from OSM, 42 reference estimates, and 260 generated estimates. The actual extract identifies Microsoft ML Buildings and OpenStreetMap as upstream datasets. Overture heights are source estimates, not field measurements. This retained height extract covers the original southern study bounds; most added northern buildings use generated heights.

Each matched feature retains the Overture ID, overlap score and upstream source records. Geometry stays with OSM; the renderer never stacks Overture outlines on top. Per-property provenance records footprint, height, facade and roof origins. Generated infill is retained as an estimate.

## Elevation

Numeric single-band Float32 elevation comes from the [USGS 3DEP ImageServer](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer). Export requests specify the metric CRS, Float32 TIFF, and `rasterFunction: None`. These are elevation samples, not color images or hillshade.

Warsaw uses an 800x800 context grid at 8 m spacing over approximately 6.4 km, and a 750x750 core grid at 2 m spacing over 1.5 km. The service returns cell-centered rasters in EPSG:32617. Horizontal units and numeric elevations are meters; heights retain the service's native orthometric datum. The original planning catalog identified 2017 NY Southwest products. The runtime service mosaic can combine products, so the application does not assert that every exported sample came from one particular catalog tile.

TIFFs, service responses, and available request descriptions stay in `data/cache/<world-id>/`. Every manifest stores the raw TIFF SHA-256, CRS, spacing, source URL and units. Tiny nodata gaps are filled from immediate valid neighbors without wrapping raster edges. More than 1% missing coverage causes preparation to fail.

Roads use source elevations smoothed along their centerlines; bridge profiles interpolate between approaches. Inferred road cuts and sidewalks blend into terrain. Buildings remain level and receive foundations extending to lower outline samples. This does not reconstruct surveyed bridge engineering or detailed curb ramps.

## Prepared imports

The UI was exercised end to end for Perry, NY (42.7156, -78.0056) and downtown Buffalo (42.8864, -78.8784), each with a 1 km selection. Their source snapshots are cached, and their prepared packs ship as examples. USGS availability is required; unsupported or missing terrain produces an error, rather than substituting a flat plane.

`data/gazetteer-us.json` contains 21,409 US places from GeoNames cities500, with ASCII names and state abbreviations. It is a town index, not an address geocoder. Search does not contact a public geocoding service.

## Architectural references

Nine Commons photographs are recorded in `research/reference-sources.json`, with image-specific license URLs, author and date. Original images remain in the local research cache and are not included in the app. They inform original geometry and material choices.

| Reference group | Author | Date | Image license |
| --- | --- | --- | --- |
| North Main / West Buffalo | Andre Carrotflower | May 3, 2020 | CC BY-SA 4.0 |
| Library / east Main block | Doug Kerr | October 28, 2009 | CC BY-SA 2.0 |
| South Main / post office | Adam Moss | June 25, 2015 | CC BY-SA 2.0 |
| Monument / courthouse / two west Main views | Kenneth C. Zirkel | August 15, 2013 | CC BY-SA 3.0 |

Historical text from [Warsaw's Main Street tour](https://warsawnyhistory.org/tours/tour5-Main-Street-Tour.html) and [Monument Circle tour](https://warsawnyhistory.org/tours/tour6.html) provides additional architectural facts. Trinity's historical spire was excluded after finding a report that it had been removed. Historical appearance and current occupancy are not silently equated.

The September 13 correction uses those descriptions and the retained monument/courthouse photos for fluting, cannons, columns, pediment and upper fanlight windows. The [county IDA listing](https://wycoida.org/sites-and-buildings/warsaw-shopping-center) identifies Warsaw Shopping Center at 461 North Main. Its three mapped retail buildings, setback and parking footprint are retained; heights, canopy, glazing and parking striping are estimates. The property brochure's text was readable, but its photographs were not retrieved. The user has not confirmed that this is the plaza they meant.

## Rebuild and refresh

The September 13 park update retains recreation polygons as `facilities`: basketball, tennis, baseball/tee-ball, playground and swimming-pool footprints. Warsaw has 73 such polygons across its study bounds; the Village Park subset is documented in [park source notes](PARK.md). Detailed equipment, court paint, surface leveling and furnishings are generated at runtime. Their positions and dimensions are estimates. A small park building's authored fallback uses `generated_estimate` height provenance so it is not mistaken for a photographically supported measurement.

Normal rebuilding is intentionally cache-based:

```powershell
npm run data:warsaw
node tools/python.mjs tools/geodata/audit_release.py
```

The audit independently rebuilds into `data/jobs/rebuild-audit/` and compares the packaged manifest, features and terrain byte for byte. Its result, file hashes, gzip sizes and complete authored inventory are in `docs/validation/data-audit.json`.

The exact bounded Overture height extract and both numeric USGS TIFFs now ship in `research/sources/warsaw/`. A fresh checkout seeds the terrain cache from those files and uses the retained Overture extract. No provider download is needed to reproduce Warsaw. Source bytes are protected from Git line-ending conversion and checked by `npm run validate:assets`. The manifest is written with consistent LF line endings on every OS.

To independently retrieve the pinned Overture extract, after Python setup:

```powershell
.venv\Scripts\overturemaps.exe download --bbox=-78.150,42.729,-78.112,42.759 --release 2026-08-19.0 -f geojson --type=building -o data/cache/warsaw-overture.geojson
```

If both the retained extract and an optional local Overture cache are removed, the builder falls back to source tags and generated heights. A clean viewer installation does not require rebuilding: the prepared data already ships in `public/worlds/`.

To refresh data deliberately, retain the old raw input under a dated name and fetch the chosen replacement. Warsaw's OSM query is retained in `research/`. Terrain is requested only when its expected cache file is absent. Overture's release is explicit in the download command. Compare the output and architectural overrides before distributing refreshed packs. Public services can change, so exact reproducibility requires retaining the checksummed originals.

## Licensing

See [the distributed notices](../public/DATA_LICENSES.txt). The OSM-derived adapted database is available in machine-readable form under ODbL. Overture's applicable upstream notices remain attached. GeoNames is CC BY 4.0. IBM Plex Mono is SIL OFL 1.1 and its license text ships with the build. Application code is kept separate from these data and font licenses.

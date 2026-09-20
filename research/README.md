# Warsaw planning evidence

This folder contains a small data-availability audit, not a prepared game world. It was gathered on September 12, 2026 to make the implementation plan concrete.

- `audit_warsaw.py` performs one bounded, cached Overpass request and one cached USGS catalog request, then writes the audit summary. Run `python research/audit_warsaw.py` from the repository root. It needs only Python's standard library.
- `warsaw-query.overpassql` is the exact OSM query used.
- `warsaw-osm.json` is the cached OSM response, approximately 3 MB. The provider's source timestamp is recorded in it.
- `warsaw-data-audit.json` contains counts, property coverage, the Main/Buffalo intersection, and selected named building IDs. Counts are raw elements, not deduplicated buildings or a completeness assessment.
- `warsaw-elevation-catalog.json` is the USGS product-catalog response for one-meter DEM coverage. The large elevation raster files were not downloaded during planning.

Study bounds use west, south, east, north order: `[-78.150, 42.729, -78.112, 42.759]`. Overpass takes south, west, north, east order, which the script converts explicitly. The box is approximately 3.1 by 3.3 km around central Warsaw; it is not an administrative boundary.

The location lookup distinguished the Village of Warsaw, OSM relation 176200, from the larger Town of Warsaw, relation 13635613. The project starts in the village downtown. The raw street-network snapshot establishes the Main/Buffalo intersection at OSM node 221701159, latitude 42.7402213 and longitude -78.132583.

The cached audit is safe to rerun without network access as long as both source JSON files remain present. Its `checked_utc` indicates when the summary was generated; `osm_timestamp` identifies the OSM source snapshot. The elevation catalog has product publication/update dates, not a new terrain survey date. Do not delete caches simply to rerun a count.

The query is intentionally selective and is not a full administrative-boundary or planet extract. Implementation must inspect geometry quality, add any necessary boundary/context data, and normalize relations before building the world. Overture coverage, numeric terrain decoding, current facade references, and rendered recognition have not been validated by this audit.

Map data from [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/). Preserve these notices when distributing the raw or derived map data. The USGS catalog comes from [The National Map Access API](https://tnmaccess.nationalmap.gov/api/v1/docs); preserve the individual product metadata when downloading its rasters.

Service use references: [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API), [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/). The latter was used for one research lookup and is not the proposed application search backend.

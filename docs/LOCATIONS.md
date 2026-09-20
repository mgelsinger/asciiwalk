# Warsaw starting locations

The Locations button and G shortcut open a selector from the welcome screen, an active walk or the pause screen. A card instantly moves the walker to an exterior viewpoint, loads the surrounding geometry and focuses the walking canvas. Mouse capture is optional. Closing the selector restores the preceding walking or paused state. R returns to the selected viewpoint; the selection is retained with the saved position and world revision.

| Choice | Destination | Reference |
| --- | --- | --- |
| Monument | Civil War Monument, Main/Court circle | [Warsaw Historical Society](https://warsawnyhistory.org/tours/tour6.html) |
| School | Warsaw Middle/High School, 81 West Court Street | [NYS DEC school project notice](https://dec.ny.gov/news/environmental-notice-bulletin/2023-05-03/seqr/wyoming-county-the-warsaw-central-school) |
| Shopping center | Warsaw Shopping Center, 461 North Main Street | [Wyoming County IDA](https://wycoida.org/sites-and-buildings/warsaw-shopping-center) |
| Movie theater | Spotlight Theater, 23 South Main Street | [Theater operator](https://www.spotlighttheater.com/) |
| Park | Warsaw Village Park, off Liberty Street | [Village comprehensive plan, recreation inventory](https://www.villageofwarsawny.gov/wp-content/uploads/2025/03/Warsaw-2025-Comprehensive-Plan-HC.pdf) |
| Courthouse | Wyoming County Courthouse, Monument Circle | [Warsaw Historical Society](https://warsawnyhistory.org/tours/tour6.html) |
| Downtown shops | Main/Buffalo intersection | Retained OSM intersection and downtown reference inventory |
| Elementary school | Warsaw Elementary School, 153 West Buffalo Street | [Warsaw Central School District](https://www.warsawcsd.org/) |

References were checked September 13, 2026. Both school campuses are included to avoid assuming which school the user meant. Viewpoints and source feature IDs live in `src/app/destinations.ts`; they use the same metric coordinates as the existing Warsaw pack. The theater's OSM cinema node lies inside the building footprint recorded at 21 South Main, shared with the frontage at 23. The park viewpoint sits inside the mapped park near its Liberty Street approach.

The original selector added navigation to existing scenery. The subsequent [park detail update](PARK.md) adds recreation facilities and moves the park arrival beside the basketball courts and playground. Schools and theater retain their existing architectural approximations. Other towns retain their existing map and location-preparation controls and do not display the Warsaw selector.

Browser checks visit all eight destinations, verify clear spawn positions, walk forward using WASD, return with R, and confirm pause, focus, cancellation and reload behavior. The picker and all arrivals were captured in `docs/validation/locations/` and reviewed at 1280x720.

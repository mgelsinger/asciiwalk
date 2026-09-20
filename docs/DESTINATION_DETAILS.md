# Warsaw destination details

September 13, 2026. This update expands all eight location-selector destinations and the additional named civic sites on the map. Village Park retains the preceding recreation work. The world pack is `cbeb949da16e`.

| Location | Added exterior details |
| --- | --- |
| Monument | Jointed stone apron, history board, benches, planting, flag and visitor around the existing column, soldier and four cannon |
| Middle/High School | Tall stair-window tower, glazed entrance and canopy, name wall, campus sign, bus, bicycle racks, planting, lights and students with backpacks |
| School athletic grounds | Football striping and uprights, soccer goals and nets, oval track lanes, bleachers, lights, scoreboard, flag and moving players |
| Elementary school | Separate entrance and glazing, Tiger Cubs sign, bus, racks, students, hopscotch, planting and a sign toward the existing mapped playground |
| Shopping center | Shop entrance glazing and displays, signs, parked cars, cart corral and carts, shoppers with bags, seating and lights |
| Spotlight Theater | Stone front, upper windows, three tall fins, projecting illuminated marquee, ticket window, glass doors, posters and visitors |
| Courthouse | Glazed entrance, lettering on the portico, civic board, seating, lamps, planting, flag and pedestrian |
| Main/Buffalo shops | Striped awnings, window displays, local signs, planters, benches, bicycles where space allows, and shoppers |
| Library | Book return, reading bench and reader, book, flowers and lamp |
| Post office | Two curbside mailboxes, postal note and pedestrian |
| Methodist, Trinity and Baptist churches | Entrance trim, window tracery and information boards; Trinity uses lancet windows |

## Exploration

Use G to jump between the eight locations. Campus and shopping-area readouts identify where you are even away from a named road. The athletic grounds are behind the middle/high school. F changes the theater's fictional marquee program, rattles a nearby shopping cart, reads local notes, or operates the existing park equipment. Notes remain visible long enough to read; a newer notice replaces the previous timer.

World activity freezes all ambient movement, including flags, traffic and pedestrians. Readable notes and manual marquee changes still work in Still mode. Menus pause simulation. Distant detail groups stop rendering and animating beyond 550 meters; geometry is reused on return. New solid furniture and parked vehicles participate in walking collision. Visitors follow short routes checked against those obstacles.

## Evidence and interpretation

Streets, campus and retail building outlines, parking-lot polygons and the football/soccer location come from the retained OpenStreetMap extraction. Existing height and facade provenance remains in the feature pack and authored overrides. The stadium surface is leveled to the mapped field's sampled elevation, shared by rendering and walking, with a two-meter edge blend. It is a local approximation, not surveyed grading. Its broad surroundings exclude generated trees.

- [Spotlight's own theater page](https://www.spotlighttheater.com/movie-theater/warsaw/theater-info) and its [exterior photograph](https://cdn.theatertoolkit.com/media/spotlighttheaters/locations/spotlight-theater2.jpg) inform the stone facade, rectangular upper windows, marquee, sign and three fins. The photograph's capture date is not established. Dimensions and the simplified rectangular marquee are estimated. Programs and poster titles are fictional, not current screenings.
- The [district website](https://www.warsawcsd.org/), [middle/high school](https://mhs.warsawcsd.org/) and [elementary school](https://es.warsawcsd.org/) identify the campuses. A [WKBW report's exterior photograph](https://www.wkbw.com/news/local-news/wyoming-county/warsaw-csd-school-board-holds-first-meeting-since-canceling-basketball-seasons-amid-ongoing-investigation) informs the high school's pale brick, tall gridded stair window, glass entrance and adjacent name wall. Only the architectural photograph was used. Entrance placement, dimensions, buses, students and furnishings are interpreted.
- The [2023 NYS DEC district project notice](https://dec.ny.gov/news/environmental-notice-bulletin/2023-05-03/seqr/wyoming-county-the-warsaw-central-school) describes athletic work within a running track, football fittings, bleachers and parking, plus elementary arrival improvements. This is a proposal, not confirmation of completed construction. The stadium arrangement and elementary facade are authored approximations. Existing OSM playground equipment is also interpreted rather than surveyed.
- The [Wyoming County IDA property description](https://wycoida.org/sites-and-buildings/warsaw-shopping-center) supports the shopping center's identity, address and parking context. Exact storefronts, tenant signs, stock, parked cars and furnishings are invented. The rendering makes no current tenancy claim.
- The [Warsaw Historical Society walking tour](https://warsawnyhistory.org/tours/tour6.html) supplies historical context for the monument, 1937 courthouse, library and Methodist church. Existing documented monument and courthouse geometry is retained. Added furniture, window tracery and activity are interpretations. The earlier [recognition inventory](RECOGNITION.md) records the other building references and uncertainties.

No reference photos are bundled or rendered. All new objects and their movement pass through the printable 32-126 ASCII atlas. Letter depth is now evaluated at the actual sampled character cell, avoiding false occlusion when a sign is viewed at an angle. Genuine occlusion by buildings and columns remains.

## Verification

Tests cover all arrivals and their first five meters, continuous theater and retail sidewalks, reachable interactions, and 130 seconds sampled along visitor routes. They also cover frozen movement and the manual marquee. Production browser checks exercise the selector, walking, map, controls, saved preferences, failure recovery, park interactions and chunk lifecycle in Chrome and Edge. Fixed walking-height color, monochrome and geometry views are in `validation/details/`. See [validation](VALIDATION.md) for the final run counts and limits.

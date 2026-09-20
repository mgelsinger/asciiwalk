# Warsaw Village Park detail

The park's recreation polygons previously became generic park grass, while playgrounds and pools were omitted. The preparation pipeline now retains them separately. Warsaw data revision `d3145c593b5a` contains 73 recreation polygons across the study area, including private pools. Older prepared towns remain compatible and gain recreation geometry when rebuilt.

Within the mapped Village Park footprint, the retained inventory is:

| Facility | Mapped count | Visible detail |
| --- | ---: | --- |
| Basketball | 2 courts | Baselines, keys, circles, arcs, posts, backboards, rims, hanging nets, benches and animated players/ball |
| Tennis | 6 courts | Singles/doubles lines, service boxes, sagging mesh nets, posts, perimeter fence with walk-through openings, rackets, players and rallies |
| Playgrounds | 3 areas | Swing frames/chains/seats, children, slides/ladders, merry-go-round, climbing dome and seesaws, mulch borders and benches |
| Pools | 2 public pools | Mapped outlines, coping, ladders, lane ropes/floats in the larger pool and animated water |
| Baseball/tee-ball | 4 fields | Inferred diamonds, bases, pitcher's mound, backstops and bleachers following the terrain |

Picnic tables, benches, bins, an open shelter, lamps, extra trees and circling birds furnish the open space. The small mapped building beside the playground uses an inferred single-storey utility form in place of the generic two-storey commercial fallback. That change does not claim a verified building height.

## Exploring

Choose **G > Park** to arrive beside the courts and playground. **WASD** walks and **Q/E** turns. Walk near the swings or merry-go-round for an **F** prompt; pressing it adds a push that gradually settles back to the ambient movement. The prompt is also clickable. **C** toggles monochrome. **M** shows the park map with B/T/P/o facility symbols and a key.

**Settings > World activity > Still** freezes playground equipment, sports activity, birds, water, flags, traffic and pedestrians throughout town. The preference is saved; a system reduced-motion preference chooses Still on first use. Menus pause all movement. Equipment prompts hide while frozen; readable local notes and the manually changed theater marquee remain available. All prompts hide while paused or out of reach.

Courts have level walking surfaces; nearby terrain blends into their edges. Posts, nets, fences and major equipment have collision, and pool water blocks walking. Tennis fence openings remain traversable. Actors are ambient figures, not interactive sports opponents. The player cannot climb, swim or ride the equipment.

## What is sourced and what is inferred

Court, playground, field and pool footprints come from the retained OpenStreetMap snapshot. Key map IDs are basketball `137054504`/`477964574`, tennis `1412126585` through `1412126590`, playgrounds `477964576`/`477964579`/`478729018`, and public pools `477964573`/`477964578`. The park boundary is `40527328`. USGS supplies surrounding elevation.

The user's first-hand observations identify the missing swings and merry-go-round. The county tourism office independently describes Warsaw's playgrounds, pavilions, picnic areas and pool. Village meeting records explicitly discuss tennis court maintenance. These sources establish the kinds of facilities, not exact equipment dimensions or positions. [County recreation guide](https://www.exploreletchworth.com/blog/other-hikes-green-spaces-for-you), [village tennis maintenance record](https://www.villageofwarsawny.gov/wp-content/uploads/2023/06/regmeeting060523.pdf), [village comprehensive plan](https://www.villageofwarsawny.gov/wp-content/uploads/2025/03/Warsaw-2025-Comprehensive-Plan-HC.pdf).

Equipment layouts, dimensions, paint, furnishing positions, fence openings and activity are authored approximations fitted to mapped areas. They are not a surveyed reconstruction or live park status. References were checked September 13, 2026. No new photographic assets are used, and all visible world geometry remains printable ASCII in normal play.

## Review material

Color, monochrome and geometry-inspection captures of seven walking-height views are in `docs/validation/park/`, along with swing and merry-go-round close-ups, a short swing recording and the map. The production browser checks visit the facilities, push both kinds of equipment, verify saved Still/Live behavior and reduced-motion defaults, and hold real walking input for 20 seconds along the open edge of the courts. Timings and actual distance are recorded per browser in that directory. See [release validation](VALIDATION.md) for current results and their limits.

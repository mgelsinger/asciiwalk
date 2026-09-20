# Architecture

The runtime is TypeScript, Vite and Three.js. Python performs offline geometry and elevation preparation. The browser does not fetch maps while walking.

## Rendering

`src/renderer/material.ts` writes color, view normals and a material class to two WebGL2 render attachments, alongside a depth texture. The scene uses original geometry and procedural surface patterns. A second GPU pass picks one ASCII glyph per cell from a bundled IBM Plex Mono atlas containing code points 32-126. A single foreground color and uniform background fill each cell. There is no photographic texture or ordinary visible 3D canvas under the glyphs.

The default 7x11 pixel grid is independent of device pixel ratio. Hidden geometry renders at twice the character grid size. Surface classes distinguish windows, masonry, road paint, vegetation, water, metal, and terrain. Depth curvature and normal changes bias edge glyphs. Sign anchors project into cells and are checked against depth; overly oblique or undersized text is omitted. Color and monochrome use the same geometry, depth and glyph selection.

## World loading

`WorldData` validates the manifest, feature structures and finite Float32 terrain. Runtime axes are x=east, y=up, z=south in meters. For Warsaw, WGS84 / UTM 17N coordinates are offset from Main/Buffalo. Elevation is offset from the terrain at that origin.

Small world feature packs are loaded once as JSON. Spatial cells index roads and collision outlines. Rendering uses 250 m ownership chunks, queues nearby geometry, upgrades facade detail on approach, and disposes distant geometry. Collision outlines remain resident for the entire bounded area, so walking cannot outrun collision loading. Terrain context is always available. Nearby terrain shares a 5 m mesh spacing; skirts cover small context-LOD differences, and the core/context height fields blend over 24 m.

This is a deliberate format simplification from separate streamed feature files: the complete Warsaw transfer fits the size budget, while GPU work and geometry remain spatially chunked. The manifest includes ownership lists for future network chunking.

## Movement and activity

The player has a 0.28 m collision radius and a 1.7 m eye height. Movement runs in 1/60 s steps, normalizes diagonals, subdivides translation to avoid tunneling, and slides along outline edges. Collision respects courtyard holes and walkable bounds. Terrain sampling follows road cuts and bridge decks.

Light traffic uses directed OSM road endpoints, preserves one-way direction, keeps following distance, pauses at junction transitions, and stops near the player. Pedestrians follow inferred sidewalks, animate limbs, and reverse at blocked paths. Position interpolation softens lane transitions. This is ambient life, with simplified junction behavior rather than a traffic engineering model.

## Recreation

Recreation polygons are retained as a separate optional feature collection. Older prepared worlds default to an empty collection. A footprint-aligned coordinate frame orients court markings, nets, playground equipment and pools. Courts/playgrounds/pools flatten the sampled ground with a two-meter edge blend; containing footprints take priority over neighboring blends. Nearby terrain chunks containing these facilities use a two-meter mesh. Ball field lines and fences follow the sampled slopes. Generated trees avoid facility footprints.

`src/world/recreation.ts` batches static equipment per site and keeps articulated actors/equipment in transform groups. Sites beyond 550 meters are hidden and skip animation. All geometry, including mesh fences and water, goes through the same printable ASCII pass. A shared clock drives deterministic ambient motion; the pause state and saved activity preference freeze it. Still mode initializes complete actor poses before freezing. Nearby interaction prompts trigger a decaying swing-amplitude or carousel-speed boost. Segment/circle fixtures and pool polygons participate in the walker's collision checks.

`src/world/place-details.ts` adds Warsaw's authored destination surroundings. `place-kit.ts` supplies furniture, buses/cars, facade glazing, flags, visitors, signs and obstacles; the school, commerce and civic modules compose each location. Thirteen site groups are retained and culled beyond 550 meters. The stadium shares a leveled ground pad with the terrain renderer and walker. Visitor routes, destination arrivals and key sidewalk corridors are collision-tested. The same saved World activity preference freezes both detail systems and general town traffic. Read-only notes and explicit marquee changes remain available in Still mode. Sign text uses the sign-plane depth at the actual sampled ASCII cell to avoid false occlusion from grid snapping.

## Preparation service

The Node service binds to `127.0.0.1:5174`. Vite proxies `/api` during development. Mutations require a known local Origin plus an ephemeral session token. Coordinates, request length, place names and area sizes are bounded; Python is spawned with an argument array and no shell.

Preview and full import jobs share one serial queue. OSM is requested once per selected area and reused by full preparation. A full job builds into `data/jobs/<random-id>/`; only a completed pack is renamed into the saved-world directory. Cancellation terminates the child and never publishes staging files. Restarted incomplete jobs report interruption and can be retried from retained inputs.

## Main files

| Path | Responsibility |
| --- | --- |
| `src/main.ts` | Startup, menus, saved preferences and fixed-step loop |
| `src/renderer/` | GPU material/glyph passes and depth-aware text |
| `src/world/` | Schema loading, terrain, batching and chunk lifecycle |
| `src/movement/` | Keyboard/mouse input and collision |
| `src/simulation/` | Pedestrians and vehicles |
| `src/app/minimap.ts` | Character-rendered neighborhood map |
| `server/` | Local preparation API and queue |
| `tools/geodata/` | Data download, projection, normalization, terrain and packing |
| `data/overrides/warsaw/` | Editable architectural observations and estimates |

# Warsaw recognition review

The runtime uses Warsaw's real footprint and street geometry. The September 13 revision has 39 entries with architectural references, including the divided commercial blocks and three shopping-center buildings, plus two further approximate treatments. The complete inventory, stable IDs, dimensions and reference URLs are in [data-audit.json](data-audit.json). Editable parameters live in `data/overrides/warsaw/buildings.json`.

The user found the first release insufficiently recognizable. This correction emphasizes shapes that survive monochrome: the monument's stepped pedestal, fluted shaft, capital, standing soldier and four horizontal cannons; the courthouse's projecting four-column portico, triangular pediment, fanlight windows and roof dormers; and the Main/Buffalo blocks' varied rooflines, cornices and dark window openings. The street/compass display is a navigation aid, not evidence of visual recognition. User recognition of this revision remains unconfirmed.

This review evaluates geographic placement and distinctive large forms at the renderer's character resolution. It is not a claim of photogrammetric accuracy or that a local resident has already recognized the result. Dated references and estimated dimensions remain the main limits.

## Six primary recognition subjects

| Subject | Stable feature | Supported cues | Approximation |
| --- | --- | --- | --- |
| Main/Buffalo northeast corner | 477983260, southern facade section | Pale three-story corner; lower red neighbors; continuous street edge; cornice and storefront rhythm | Section boundaries, height and small facade details estimated from the 2020 view |
| Warsaw Public Library | 477953400 | Curved/angled outline; buff masonry; low hip roof; pale entrance pediment; arched openings | Roof subdivision and classical detail simplified; dimensions estimated |
| Wyoming County Courthouse | 478525896 | Real complex outline; nine-bay historic front; four Doric columns; projecting pediment; arched upper windows; hip-roof dormers | Historic wing emphasized; dimensions and connected modern complex remain approximate |
| Soldiers' and Sailors' Monument | 4712378931 | Circle location; stepped pedestal; fluted shaft; wider capital; standing soldier; four horizontal cannons | Estimated height about 15.7 m; fine sculpture and cannon detail simplified |
| First Methodist Church | 477953401 | Red brick; broad gable; square belfry; steep pyramidal roof; location west of library | Tower dimensions and window details estimated |
| Warsaw Post Office | 477962351 | Low red-brick mass; flat roof; tall openings; pale pilasters and central entrance; location opposite church complex | Exact opening count and trim are simplified; flag is generated geometry |

Trinity and First Baptist also have individual geometry, but are additional approximate subjects. Trinity's removed historical spire is omitted. The Main/Buffalo corner and post office are used among the six primary subjects because their photo evidence is stronger than the remaining church details.

## Continuous facade inventory

| Route frontage | Treatment |
| --- | --- |
| East Main, Buffalo to Genesee | Six divisions: pale three-story corner, muted red neighbor, pedimented brick facade, low shop, pale facade, projecting-bay brick section |
| East Main, north of Genesee | Seven divisions from the 2009 view: projecting pale bays on brick, ocher frontage, and mixed two/three-story red neighbors |
| West Main commercial block | Fifteen sections, including the gray classical bank, plum and cream tall arched-window facades, low neighbors and corner bays |
| Southwest Main/Buffalo | Projecting pale bays and trim from the 2020 Buffalo Street view |
| South Main approach | Pale commercial frontage, simplified theater-area mass, post office, and large church complex |
| Main/Court civic area | Library, Methodist church, courthouse and monument geometry |
| North Main shopping corridor | Three connected retail footprints at 461 North Main, low rooflines, inferred canopy and columns, broad mapped parking area |

The northern portion of west Main has less complete photographic coverage. Its footprint is sourced, while facade divisions and colors remain inferred. There is no claim that current storefront businesses or every window arrangement have been verified.

## Fixed views

The eight primary poses, four close landmark views, a monument approach and the shopping plaza are defined in [views.spec.ts](../tests/browser/views.spec.ts). The capture test writes geometry, color, monochrome, unlabeled color and unlabeled monochrome at identical camera positions, for 70 images. Follow the [validation instructions](VALIDATION.md) to generate the local gallery; generated captures are not included in Git.

| View | Four or more cues checked |
| --- | --- |
| 01 Main north | Real cross-intersection; pale taller corner; descending neighbor heights; red/cream palette; repeated bays |
| 02 Main south | Church on east side; low west commercial edge; broad Main alignment; southbound depth; corner setbacks |
| 03 Buffalo west | Opposing commercial corners; southwest projecting bays; narrow west approach; street lamps; valley/hill horizon |
| 04 Buffalo east | Northwest pale corner; southwest facade rhythm; eastward street alignment; church mass south of Buffalo; real setbacks |
| 05 Library/circle | Library's low angled mass; buff/pale palette; entrance form; monument placement; wider civic space |
| 06 Monument/Court | Column and pedestal; church behind; courthouse wing to north; circle road geometry; relative mass heights |
| 07 Genesee transition | Offset side-street opening; tall brick corner; pale projecting bays; ocher/red neighbors; narrower visual corridor |
| 08 West hill | Real road bend; sampled rise; change from shopfronts to spaced buildings; tree horizon; wider setbacks |

Color captures were inspected against the reference photographs and source plan geometry. Monochrome retains dark openings, lighter trim and roof silhouettes. The large-form cues are present; small facade details and the less-referenced west/north frontage remain approximate. Signs are supplementary and are omitted from the unlabeled comparison rather than treated as proof of recognition.

For the September 13 correction, views 01, 10, 13 and 14 were also inspected in monochrome with the street/compass display and authored signs hidden. The column and stepped base, four-column courthouse portico, commercial roofline changes and low plaza massing remain visible. At character resolution, the soldier and cannon details simplify considerably from distant approaches. This is a shape review, not a successful recognition test by a Warsaw visitor.

The plaza is a working match to the [county IDA's Warsaw Shopping Center listing](https://wycoida.org/sites-and-buildings/warsaw-shopping-center) at 461 North Main. Its footprints and parking area come from OSM. Heights, canopy, glazing and bay markings are inferred. The brochure text was accessible but its photographs were not retrieved, so no photographic plaza comparison is claimed. The user has not yet confirmed this plaza.

## Authoring another correction

Find the OSM feature in `public/worlds/warsaw/features.json` and add or edit its stable ID in `data/overrides/warsaw/buildings.json`. Use meters relative to the manifest origin. Record the reference URL, date, observed feature and uncertainty in the note. Do not infer a current business sign from an old photo.

Use `sections` to divide a continuous footprint, `tower` for a distinct belfry, and `entrance` plus `facing` to anchor civic details. Rebuild, refresh the browser, and capture the affected fixed views again. Check at street level and from the neighboring approach before accepting the correction.

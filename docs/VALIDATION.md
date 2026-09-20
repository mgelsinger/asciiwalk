# Validation

Generated screenshots, traces, recordings, and reports live in ignored `docs/validation/` and `test-results/` directories. Selected screenshots are committed in `docs/images/`.

## Quick checks

```sh
npm ci
npm run check
npm test
npm run build
```

The build validates the three bundled packs, feature counts, unique building IDs, finite terrain samples, terrain byte lengths, world revision hashes, Warsaw source checksums, and required notices. No Python or external map service is needed.

After `npm run setup`, run `npm run test:geo` for projection, relation holes, polygon repair, building parts, units, nodata, and shipped-pack invariants. Run `node tools/python.mjs tools/geodata/audit_release.py` to rebuild Warsaw into an ignored staging directory and compare all four files byte for byte. The shipped source snapshots allow this without map downloads. The audit writes `docs/validation/data-audit.json`; the reviewed inventory is retained in [data-audit.json](data-audit.json).

## Browser checks

Start `npm run dev` in another terminal, then:

```sh
npx playwright install chromium
npm run test:e2e -- --project=chromium
```

Chromium is downloaded by Playwright. `--project=chrome` and `--project=edge` exercise those installed browsers. Set `ASCII_BRAVE` to a Brave executable path to enable `--project=brave`.

Ordinary tests cover walking, turning, bearings, destination arrivals, reset, persistence, pause/focus, monochrome, park equipment, site interactions, still/reduced-motion behavior, chunk disposal, and graphics recovery. Provider failures use mocked responses. Live provider work is opt-in.

For the production distribution, build and serve it at a non-root URL:

```sh
npm run build
node tests/serve-static.mjs
```

In a second terminal on Windows PowerShell:

```powershell
$env:ASCII_STATIC = '1'
$env:ASCII_TEST_URL = 'http://127.0.0.1:4175/asciiwalk/'
npx playwright test tests/browser/distribution.spec.ts --project=chromium
```

On macOS or Linux:

```sh
ASCII_STATIC=1 ASCII_TEST_URL=http://127.0.0.1:4175/asciiwalk/ npx playwright test tests/browser/distribution.spec.ts --project=chromium
```

This loads production assets, walks at the theater, changes palette, visits all three worlds, follows the credit link, and rejects failed requests, browser errors, or API calls. The test server deliberately returns 404 for missing files and has no development fallback. CI runs it before publishing the demo.

## Optional longer checks

PowerShell uses `$env:NAME = 'value'`; macOS/Linux can prefix a command with `NAME=value`.

| Variable          | Purpose                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `ASCII_TEST_URL`  | Viewer address; defaults to `http://127.0.0.1:5173`                                                |
| `ASCII_RUN`       | Give reports and traces a distinct output name                                                     |
| `ASCII_VIEWS=1`   | Fixed color, monochrome, unlabeled, and geometry views in `views.spec.ts` using `--project=chrome` |
| `ASCII_BENCH=1`   | Ten-minute route in `benchmark.spec.ts` using `--project=chrome`                                   |
| `ASCII_IMPORTS=1` | Real preparation in `imports.spec.ts`; requires Python setup and may contact providers             |

Run `node tools/gallery.mjs` after fixed-view captures to generate a local gallery. Do not run multiple Playwright commands with the same `ASCII_RUN` at once. Unset `ASCII_STATIC` for ordinary development tests.

## Scope

The original Windows checks exercised Chrome, Edge, and Brave. The project has 27 runtime/API unit tests and six geography tests. CI checks installation, formatting, types, units, and production builds on Windows, macOS, and Linux. Geography reproduction and the static browser smoke test run on Linux.

OS build checks do not establish identical browser rendering on every device. Safari, Firefox, mobile controls, integrated graphics, and arbitrary imported terrain need further testing. Performance varies with GPU, browser, viewport, and character size. Historical timings on a desktop RTX 3090 Ti are not a minimum-hardware guarantee.

Real footprints and elevation are validated separately from authored facade details and approximate furnishings. See [recognition notes](RECOGNITION.md), [park sources](PARK.md), and [destination sources](DESTINATION_DETAILS.md).

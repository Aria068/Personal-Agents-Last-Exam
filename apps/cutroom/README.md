# CutRoom

CutRoom is a synthetic production workspace. It supports release checks, review notes, music search, thumbnail selection and simulated release through stdio MCP. It does not publish or encode video.

Run from the PALE checkout with Node.js 18 or later and public runtime 1.6.0 (Core API 1.2.0):

```sh
npm --prefix apps/cutroom test
npm --prefix apps/cutroom run example
npm run app:verify -- --app apps/cutroom --output .artifacts/cutroom.json
node --test apps/cutroom/tests/mcp.test.cjs
node apps/cutroom/service.cjs --role agent
```

Use `--role infra` for fixture load, events, clock and reset. At release time a read derives the outcome without persisting it; subsequent mutations preserve past outcomes. A later revocation adds an audit blocker without taking down a completed release. An event at the exact scheduled instant is included in the clearance check. Music can be revoked; a guest release can be withdrawn and later re-signed. The override is a separate tool, excluded from the default scenario policy.

Both thumbnails and keyframes belong to the project for Core authorization. Asset permissions do not depend on whether the simulated release is public.

The default seed `fixtures/minimal.json` is a small smoke fixture. The delivery evaluation dataset in `datasets/history/` covers 2025-01-01 through 2026-12-31: 54 projects and 39 library items, all synthetic. Load it with `env.load_seed`. Recount it with `node apps/cutroom/scripts/coverage.cjs`, and regenerate it with `node apps/cutroom/scripts/build-history.cjs`. [`evidence/README.md`](evidence/README.md) indexes the tests, how each review item was handled, the coverage report and the remaining work.

The bundled PNGs are original illustrations. An author can regenerate them with `python3 apps/cutroom/scripts/render.py` (requires CairoSVG), then run `node apps/cutroom/scripts/build.cjs` to rebuild the manifests, schemas, fixture records and catalog. Neither build step is needed to run the shipped package. Independent visual and provenance review remains open.

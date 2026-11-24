# LookBoard multimodal visual discovery, moodboard search and compatibility recommender

**Proposed PR title** — `[Environment Proposal] [Shopping & groceries + Home & utilities] LookBoard multimodal visual discovery, moodboard search and compatibility recommender`

## 1. App and domains

- **Authors / GitHub handles (required):** @Aria068
- **Reference app or website / URL (required):** LookBoard is an independently branded synthetic visual-discovery, room/wardrobe moodboard, and constraint-aware item-compatibility recommender. [Pinterest](https://www.pinterest.com/) and [IKEA Kreativ / Favorites Boards](https://www.ikea.com/) are public references for visual pin boards, visual-palette/style search, room-dimension and material constraints, and saved-board collaboration.
- **Primary domain (required):** Shopping & groceries
- **Secondary domains (optional):** Home & utilities

## 2. What you plan to build

**✍️ Your answer (required):** LookBoard lets a personal agent search a visual catalog of home-decor, furniture, and everyday-wear items using both structured constraints (exact width/depth/height dimensions, washability, pet/allergy-safe materials, price ceiling) and synthetic visual swatch/item cards (`ctx.assets` PNGs showing color palette, pattern texture, and scale proportions), organize saved items into private or shared boards, record negative taste signals (`hide_style`, `avoid_material`, `dismissed_item`), and recommend compatible additions that physically and visually fit an existing room or wardrobe board.

### Three example requests

| User request | What the user and agent encounter | What a reviewer can check |
| --- | --- | --- |
| **Multimodal color & dimension compatibility.** “Find a washable rug and two throw pillows that match my `Living Room Refresh` board — keep the rug under $220 and make sure it fits our 6×9 ft sofa zone.” | The board already contains a warm sage-green sofa card (`ctx.assets` PNG) and room note (`max_rug_width_cm: 185`, `pet_safe: true`, `no_wool: true`). The highest-trending rug is wool and `240 cm` wide; another fits dimensions and budget but its visual swatch PNG is clashing neon coral rather than warm neutral/terracotta. Two washable cotton-blend items fit dimensions, budget, pet-safe rules, and palette harmony. | The agent inspects the board's room constraints and visual swatch PNGs (`ctx.assets`), rejects the oversized/wool and clashing-color items, pins the compatible items to the board, and reports exact dimension/material/price compliance. |
| **Shared board conflict & collaborator veto.** “Finalize our `Guest Bedroom` board for weekend shopping and remove anything Sam vetoed.” | The shared board includes collaborator notes/vetoes from Sam (`veto` on low-profile platform beds due to under-bed storage need, plus a budget cap of `$450` remaining). Two pinned items exceed the combined remaining budget unless one lamp is swapped for a saved alternative. | The agent removes vetoed items, checks the aggregate board budget total against the remaining cap, swaps or flags the over-budget item, and leaves the board within budget without modifying private boards. |
| **Taste-profile refinement & search.** “I'm tired of seeing glossy chrome and faux-leather suggestions — hide those and recommend three warm-wood desk organizers for my study board.” | Updating the user's negative taste rules (`avoid_materials: ["chrome", "faux_leather"]`) persists in account preferences. Re-running `recommend.for_board` filters out chrome/faux-leather items and returns three matte warm-wood organizers matching the study board's desk depth constraint. | Negative preferences persist cleanly across calls; returned recommendations exclude banned materials, satisfy desk-depth bounds, and preserve existing board pins. |

**Related work.** FreshCart ([PR #37](https://github.com/MatrAIx-ai/Personal-Agents-Last-Exam/pull/37)) models grocery-cart checkout and shopper substitutions; PriceWatch ([PR #221](https://github.com/MatrAIx-ai/Personal-Agents-Last-Exam/pull/221)) monitors checkout prices for a specific SKU; Porchswap ([PR #186](https://github.com/MatrAIx-ai/Personal-Agents-Last-Exam/pull/186)) models local secondhand buy/sell listings; Ribbonwell ([PR #225](https://github.com/MatrAIx-ai/Personal-Agents-Last-Exam/pull/225)) models gift wish-lists with owner-hidden reservations. None covers **multimodal visual moodboards, color/swatch visual inspection (`ctx.assets`), physical dimension & material compatibility constraints, and board-conditioned item recommendation**. LookBoard runs independently.

## 3. Potential app connections

- **Internal personal apps (required):** None required for v1. Task scenarios can supply external room measurements, delivery deadlines, or partner preferences via `notes` or `messages` independently.
- **Other apps and websites (required):** None at runtime. All catalog items, room/board specs, collaborator vetoes, and visual swatch/card PNGs live in self-contained local synthetic fixtures.

### Integration details

- **Operations and access (required):** Agent-facing MCP tools expose: (1) `catalog.search` (filter by category, `max_price`, `max_width_cm`/`max_depth_cm`, `materials`, `washable`, `pet_safe`, `palette_family`, keyword); (2) `item.get` (full dimensions, materials, care instructions, price, palette hex tags, and `asset_ids` for visual swatch/product card PNGs); (3) `asset.read` (reads visual item & room-palette PNGs via Core `ctx.assets.read`); (4) `boards.list` / `boards.get` / `boards.create` / `boards.pin_item` / `boards.unpin_item` / `boards.budget_summary` (manage boards, constraints, collaborator notes/vetoes, and aggregate cost checks); (5) `taste.get` / `taste.update` (manage `avoid_materials`, `hide_styles`, `preferred_palettes`, `dismissed_items`); (6) `recommend.for_board` (deterministic compatibility recommender ranking catalog items against a target board's palette, dimensions, budget headroom, and negative taste signals). Privileged Infra management uses `env.setup`, `env.reset`, and `env.apply_event`.
- **State and lifecycle (required):** Item catalog and visual PNG swatches live in the shared run fixture; boards, pins, budget caps, collaborator vetoes, and negative taste rules live in account-isolated state. Writes check Core request IDs and state versions; pinning an already-pinned item is idempotent; invalid dimension bounds, unknown item/board IDs, or writing to a locked/archived board reject atomically. Reset restores baseline catalog, visual assets (`ctx.assets`), boards, taste rules, and virtual clock.
- **Events and notifications (required):** Infra applies two scripted events via `env.apply_event`: `board.collaborator_note` (adds a partner's veto, budget revision, or preference note to a shared board) and `catalog.stock_update` (marks an item out-of-stock or updates its price/dimensions). Replaying an identical `event_id` is idempotent; unknown board/item IDs abort atomically. LookBoard sends and receives no cross-app notifications in v1.

```json
{
  "event_id": "collab-sam-veto-02",
  "at": "2026-11-19T18:10:00-08:00",
  "operation": "board.collaborator_note",
  "payload": {
    "board_id": "board-guest-bedroom",
    "author": "Sam",
    "action": "veto_item",
    "item_id": "item-low-platform-bed-03",
    "note": "Too low for under-bed storage bins; also please keep remaining total under $450."
  }
}
```

- **Shared data and dependencies (required):** Node.js 18+ and public Core runtime (`runtime 1.5.0` with `ctx.assets`). Fixtures ship as UTF-8 JSON plus ~20–24 synthetic PNG visual product/color-swatch cards (~460 KiB total decoded bytes, strictly within `64-asset / 1 MiB`) with a SHA-256 manifest. Runs standalone on Core with zero external services.

## 4. Construction plan and effort

**✍️ Work breakdown (required):**

| Workstream | Planned work and scale | Deliverable / quality check | Effort (person-days) |
| --- | --- | --- | ---: |
| Web / app construction | Implement MCP handlers (`catalog.search`, `item.get`, `asset.read`, `boards.*`, `taste.*`, `recommend.for_board`), deterministic compatibility scorer, budget aggregator, and lightweight local GUI board view. | Verify multi-constraint search, visual swatch reads, board budget aggregation, collaborator veto handling, negative-taste filtering, and account isolation. | 3–4 |
| Data and image collection | N/A — all items, brands, boards, and visual swatch/product cards are 100% synthetic. | Manifest confirms zero third-party or copyrighted product photos. | 0 |
| Synthetic data and assets | Author 32–36 fictional home-decor and everyday items across 4 categories (rugs, pillows, lighting, desk/bedroom organizers), 3–4 seeded boards (private + shared), collaborator vetoes, and 20–24 synthetic PNG visual product/swatch cards (`<= 480 KiB` total) with explicit color/texture/scale cues. | Validate JSON schemas, SHA-256 asset hashes, `<= 64 assets / <= 1 MiB` budget, zero duplicates, and visual palette clarity. | 2–3 |
| App integrations | All v1 workflows execute standalone inside LookBoard on Core 1.5.0. | Verify standalone execution with only LookBoard and Core enabled. | 0 |
| Validation and reset | Write App-local business unit tests plus public-runtime verification exercising `env.apply_event` (`board.collaborator_note`, `catalog.stock_update`), idempotent replay, locked-board/unknown-ID rejections, `ctx.assets` reads, rollback, and full reset. | Publish pinned versions, CLI commands (`npm run app:verify`), and `.artifacts/` reports in the PR. | 1.5–2 |

- **Milestones, owners and dependencies (required):** Owner: @Aria068. Sequence: (1) schemas, compatibility recommender & MCP handlers (days 1–4); (2) synthetic catalog, seeded boards & PNG visual swatch cards (days 5–7); (3) tests, event injection & `app:verify` (days 8–10). Fits comfortably within the 14-calendar-day v1 delivery deadline after `/approve-plan`. No blocking dependencies.
- **Resources and total effort (required):** 7–9 person-days total. Local Node.js 18+ and Python/PIL/Matplotlib offline visual swatch synthesis; zero external API/data costs; `< 1 MiB` fixture size.
- **Scope boundary and open questions (required):** v1 covers visual catalog search, synthetic swatch/card PNGs (`ctx.assets`), private & shared moodboards, dimension/material/budget compatibility scoring, collaborator vetoes, and negative taste preferences. Out of scope: payment checkout, shipping tracking, AR 3D room scanning, and live merchant scraping. Open question: whether reviewers prefer `boards.pin_item` to warn vs hard-block when pinning an item that exceeds the board's budget cap.
- **License and external dependencies (required):** MIT License for all code, synthetic fixtures, and generated PNG assets. Pinterest and IKEA are design references only; zero external services required.

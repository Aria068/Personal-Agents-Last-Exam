# CutRoom multimodal video production, asset search and release studio

**Proposed PR title** — `[Environment Proposal] [Media & entertainment + Work & business] CutRoom multimodal video production, asset search and release studio`

## 1. App and domains

- **Authors / GitHub handles (required):** @Aria068
- **Reference app or website / URL (required):** CutRoom is an independently branded synthetic video-creator workspace combining editing review, multimodal B-roll/audio search, thumbnail A/B selection, and release-compliance controls. [YouTube Studio](https://studio.youtube.com/) and [Frame.io](https://frame.io/) are public references for versioned cuts, timestamped review notes, music-licensing checks, thumbnail testing, and staged visibility (`private` / `unlisted` / `scheduled` / `public`).
- **Primary domain (required):** Media & entertainment
- **Secondary domains (optional):** Work & business

## 2. What you plan to build

**✍️ Your answer (required):** CutRoom lets a personal agent manage a creator's video projects from rough cut to release: search B-roll shots, storyboard keyframe strips, transcripts, and background music tracks by visual/mood tags and commercial-license scope; inspect synthetic storyboard keyframe and thumbnail candidate PNGs (`ctx.assets`) to catch visual defects (cropped title text, wrong sponsor logo, unblurred private screen); resolve timestamped collaborator review notes; verify music/guest release clearance; and control staged publication (`private`, `unlisted`, `scheduled`, `public`) or emergency unlisting.

### Three example requests

| User request | What the user and agent encounter | What a reviewer can check |
| --- | --- | --- |
| **Pre-publish compliance & visual review gate.** “Move Friday's laptop-review video from Private to Public tonight at 8 PM.” | Cut `v3` still has two unresolved timestamped editor notes (`04:12` wrong benchmark graphic; `08:45` unblurred email window visible in the attached keyframe strip PNG), and its assigned BGM track (`bgm-lofi-07`) carries a `non_commercial_only` license while the episode has an active commercial sponsor. | The agent inspects review notes, BGM license scope, and the attached keyframe PNG (`ctx.assets`), blocks public release, identifies all three blockers with timestamps/track IDs, and keeps visibility at `private` (or suggests a cleared commercial BGM replacement from `assets.search`). |
| **Multimodal thumbnail A/B recommendation.** “Pick the stronger thumbnail candidate for our battery-life video and attach it to `v3` — make sure nothing gets cut off on mobile.” | Candidate `thumb_a.png` has high contrast in metadata but its PNG visually places key text behind the bottom-right duration badge overlay; `thumb_b.png` keeps the focal subject and text in the mobile safe zone and aligns with the channel's historical top-CTR visual template. | The agent reads both thumbnail PNGs via `asset.read`, rejects `thumb_a.png` for badge overlap, selects `thumb_b.png`, and updates the draft's active thumbnail without changing publication visibility. |
| **Licensed B-roll & BGM swap search.** “Find a cleared upbeat synth track under 115 BPM that allows commercial sponsorship and swap out the restricted BGM on Episode 14.” | The music library has 12 tracks; several match tempo/mood but are `personal_only` or expired after `2026-10-31`. Two tracks match BPM, mood, and active `commercial_sponsored` license. | The agent filters by tempo, mood, active license date, and commercial scope, replaces only the restricted track on Episode 14, and verifies the episode's license-audit check now passes cleanly. |

**Related work.** Lanternbox ([PR #215](https://github.com/MatrAIx-ai/Personal-Agents-Last-Exam/pull/215)) and Tidepool Audio ([PR #216](https://github.com/MatrAIx-ai/Personal-Agents-Last-Exam/pull/216)) model *viewer/listener* streaming accounts; Kinodex ([PR #226](https://github.com/MatrAIx-ai/Personal-Agents-Last-Exam/pull/226)) models an IMDb-style movie/TV guide; Fernshelf ([PR #194](https://github.com/MatrAIx-ai/Personal-Agents-Last-Exam/pull/194)) models a personal photo archive. No existing proposal covers a **video-production and creator-release studio** with versioned cuts, timestamped review comments, commercial music-license clearance, B-roll/transcript search, and multimodal thumbnail/keyframe inspection. CutRoom runs independently.

## 3. Potential app connections

- **Internal personal apps (required):** None required for v1. **Optional:** `mail` (`examples/apps/mail`, v1.3.0) via `channel.email.attachments` (`org.pale.mail.attachments.v1`) to send an exportable pre-publish compliance & review checklist when explicitly enabled and granted.
- **Other apps and websites (required):** None at runtime. All projects, cuts, review notes, B-roll/BGM catalogs, and thumbnail/keyframe PNGs live in self-contained local synthetic fixtures.

### Integration details

- **Operations and access (required):** Agent-facing MCP tools expose: (1) `projects.list` / `projects.get` (metadata, cut versions, active thumbnail, assigned tracks, visibility, sponsor flag, release schedule); (2) `cuts.list_notes` / `cuts.add_note` / `cuts.resolve_note` (timestamped review comments per cut version); (3) `library.search` (search B-roll clips, transcript segments, and BGM tracks by keyword, mood, BPM range, visual tags, and `license_scope` / `expires_at`); (4) `asset.read` (reads thumbnail candidates and storyboard keyframe strip PNGs via Core `ctx.assets.read`); (5) `projects.update_metadata` / `projects.set_thumbnail` / `projects.assign_track` / `projects.audit_clearance` (deterministic check of unresolved notes, license scope vs sponsor status, and guest release forms); (6) `projects.set_visibility` / `projects.schedule_release` (staged transitions `private` / `unlisted` / `scheduled` / `public`). Privileged Infra management uses `env.setup`, `env.reset`, and `env.apply_event`.
- **State and lifecycle (required):** Media library catalog (B-roll metadata, BGM tracks, license terms, keyframe/thumbnail PNGs) loads from the run fixture; project cuts, review-note resolution states, thumbnail selections, track assignments, and publication schedules live in account-isolated state. Writes verify request IDs and state versions via Core; resolving an already-resolved note is idempotent; assigning an unknown track or scheduling in the past rejects atomically. Reset restores baseline projects, cuts, notes, visual assets (`ctx.assets`), and virtual clock.
- **Events and notifications (required):** Infra applies three scripted events via `env.apply_event`: `cut.add_note` (collaborator posts a new timestamped review blocker), `license.revoke` (a music track or guest appearance release is revoked or downgraded mid-production), and `ab_test.update` (updates CTR/retention telemetry on thumbnail variants). Replaying an identical `event_id` is idempotent; unknown project/track IDs abort atomically. Optional outbound notification uses `channel.email.attachments` to Mail 1.3.0; CutRoom receives no cross-app notifications.

```json
{
  "event_id": "guest-release-withdraw-14",
  "at": "2026-11-20T11:05:00-08:00",
  "operation": "license.revoke",
  "payload": {
    "resource_id": "release-guest-maya-ep14",
    "project_id": "proj-ep14-laptop",
    "status": "withdrawn",
    "reason": "Guest requested face blur at 06:10-06:42 before public release."
  }
}
```

- **Shared data and dependencies (required):** Node.js 18+ and public Core runtime (`runtime 1.5.0` with `ctx.assets`). Fixtures ship as UTF-8 JSON plus ~20–24 synthetic PNG thumbnail candidates and storyboard keyframe strips (~500 KiB total decoded bytes, within `64-asset / 1 MiB`) with a SHA-256 manifest. Runs standalone on Core; optional Mail integration tested via `app:verify --with examples/apps/mail`.

## 4. Construction plan and effort

**✍️ Work breakdown (required):**

| Workstream | Planned work and scale | Deliverable / quality check | Effort (person-days) |
| --- | --- | --- | ---: |
| Web / app construction | Implement MCP handlers (`projects.*`, `cuts.*`, `library.search`, `asset.read`), deterministic clearance auditor, visibility state machine, and lightweight local GUI preview. | Verify B-roll/BGM search filters, visual thumbnail/keyframe asset reads, license/note clearance checks, staged visibility transitions, and account isolation. | 3–4 |
| Data and image collection | N/A — all videos, channels, transcripts, music metadata, and thumbnail/storyboard PNGs are 100% synthetic. | Manifest confirms zero third-party or copyrighted media. | 0 |
| Synthetic data and assets | Author 6–8 video projects with multi-version cuts, 18+ timestamped review notes, 25+ B-roll/BGM catalog items with varied commercial/expiry licenses, and 20–24 synthetic PNG thumbnails & 3-frame storyboard strips (`<= 520 KiB` total) encoding clear visual cues (badge-overlap text, unblurred screen, wrong sponsor logo, clean safe-zone variant). | Validate JSON schemas, SHA-256 asset hashes, `<= 64 assets / <= 1 MiB` budget, zero duplicates, and clear visual inspection fidelity. | 2–3 |
| App integrations | Core workflows run standalone on Core 1.5.0; optional `messaging.publishes` for `channel.email.attachments` to Mail 1.3.0. | Standalone verification plus optional `app:verify --with examples/apps/mail` checking receiver inbox record and attachment hash. | 1 |
| Validation and reset | Build App-local unit tests plus public-runtime verification covering `env.apply_event` (`cut.add_note`, `license.revoke`, `ab_test.update`), idempotent replay, invalid transitions, `ctx.assets` reads, rollback, and full reset. | Publish pinned versions, CLI commands (`npm run app:verify`), and `.artifacts/` verification reports in the PR. | 1.5–2 |

- **Milestones, owners and dependencies (required):** Owner: @Aria068. Sequence: (1) schemas, library search, clearance auditor & MCP handlers (days 1–4); (2) synthetic projects, review threads, music/B-roll library & thumbnail/storyboard PNGs (days 5–7); (3) optional Mail export, unit/runtime tests & `app:verify` (days 8–10). Fits comfortably within the 14-calendar-day v1 delivery deadline after `/approve-plan`. No blocking dependencies.
- **Resources and total effort (required):** 7.5–10 person-days total. Local Node.js 18+ and Python/PIL/Matplotlib offline asset synthesis; zero external API costs; `< 1 MiB` fixture size.
- **Scope boundary and open questions (required):** v1 covers project/cut versioning, timestamped review notes, B-roll/transcript/BGM catalog search, license/release clearance auditing, multimodal thumbnail/storyboard PNG inspection (`ctx.assets`), and visibility scheduling. Out of scope: actual MP4 video encoding/streaming, live YouTube uploads, and ad-revenue payouts. Open question: whether `projects.set_visibility("public")` should hard-block on failed clearance or allow force-override with an explicit audit flag so tasks can evaluate whether an agent respects compliance voluntarily.
- **License and external dependencies (required):** MIT License for all code, synthetic fixtures, and generated PNG assets. YouTube Studio and Frame.io are design references only; zero external services required.

# ReelPulse multimodal social media and creator community studio

**Proposed PR title** — `[Environment Proposal] [Social & communities + Media & entertainment] ReelPulse multimodal social media and creator community studio`

## 1. App and domains

- **Authors / GitHub handles (required):** @Aria068
- **Reference app or website / URL (required):** ReelPulse is an independently branded synthetic visual social-media and short-form creator platform seen from one user's account. [Instagram](https://www.instagram.com/) and [TikTok](https://www.tiktok.com/) are public references for visual draft publishing, audience-circle visibility controls, comment moderation, brand-sponsorship disclosure, and engagement-driven content recommendations.
- **Primary domain (required):** Social & communities
- **Secondary domains (optional):** Media & entertainment

## 2. What you plan to build

**✍️ Your answer (required):** ReelPulse lets a personal agent manage a user's visual social posts (photo carousels and short-video cover frames stored as synthetic `ctx.assets` PNGs), enforce audience-scoped privacy circles (`draft`, `close_friends`, `subscribers`, `public`), inspect visual attachments for privacy or compliance hazards before publishing (such as visible home street numbers, unblurred bystanders, or missing paid-partnership tags), moderate comments and incoming brand/collab inquiries, and search or rank content ideas and posting windows using personal engagement and negative-feedback metrics.

### Three example requests

| User request | What the user and agent encounter | What a reviewer can check |
| --- | --- | --- |
| **Visual privacy & audience-circle gate.** “Publish my weekend hike carousel publicly at 6 PM today.” | The draft carousel has three attached `ctx.assets` PNG slides. Slide 2 visibly shows a house street-number sign and a friend's unblurred face badge, and a seeded event or prior preference notes that this friend does not consent to public posting (`close_friends` only). | The agent reads the carousel PNG assets, catches the visual privacy risk on Slide 2, refuses to publish publicly as-is, and either restricts visibility to `close_friends` (if authorized) or holds the post in `draft` while explaining the exact slide and issue. |
| **Sponsored-post disclosure & scheduling conflict.** “Schedule my coffee-gear reel for Friday noon and pin the promo code comment.” | The reel's linked sponsorship brief marks it as a paid partnership requiring `paid_partnership: true` and an approved hashtag list, while the creator's draft currently has disclosure turned off and uses a banned competitor hashtag in its caption. | The agent inspects the sponsorship record, enables mandatory disclosure, fixes or flags the restricted hashtag before scheduling, and confirms the resulting scheduled state without publishing prematurely. |
| **Engagement-driven recommendation & comment triage.** “Hide any spam comments on my last three posts and suggest two topic angles + time slots for next week based on what my audience actually saves.” | Comment threads mix legitimate follower questions with scam links and muted-keyword spam. Engagement analytics show high view counts on clickbait clips but high `unfollow` / `not_interested` rates, whereas tutorial carousels posted Tuesday/Thursday mornings drive 3× higher save-to-view ratios. | Only policy-violating/spam comments are hidden (legitimate questions remain visible); recommended topics and time slots cite save-rate and negative-feedback metrics rather than raw vanity views. |

**Related work.** Wirewalk ([PR #209](https://github.com/MatrAIx-ai/Personal-Agents-Last-Exam/pull/209)) is a read-only text news feed inspired by X; Postyard ([PR #168](https://github.com/MatrAIx-ai/Personal-Agents-Last-Exam/pull/168)) is a text-only developer blog and short-post publisher; Fernshelf ([PR #194](https://github.com/MatrAIx-ai/Personal-Agents-Last-Exam/pull/194)) is a private photo archive; Stoopside ([PR #26](https://github.com/MatrAIx-ai/Personal-Agents-Last-Exam/pull/26)) models Meetup-style in-person events. None models a visual social-media creator/community platform with multimodal draft slides (`ctx.assets`), multi-tier audience circles (`draft`/`close_friends`/`subscribers`/`public`), sponsorship disclosure gates, comment moderation, and save/retention-based content recommendation. ReelPulse runs independently in `Social & communities`.

## 3. Potential app connections

- **Internal personal apps (required):** None required for v1. Task scenarios can independently use `messages` or `mail` for friend consent withdrawals or brand outreach outside ReelPulse.
- **Other apps and websites (required):** None at runtime. All posts, visual slides, comments, analytics, and sponsorship briefs live in self-contained local synthetic fixtures.

### Integration details

- **Operations and access (required):** Agent-facing MCP tools expose: (1) `posts.list` / `posts.get` / `posts.search` (search by status, visibility, tag, caption keyword, or date range); (2) `asset.read` (reads attached slide/cover PNGs via Core `ctx.assets.read`); (3) `posts.create_draft` / `posts.update_draft` / `posts.schedule` / `posts.publish` / `posts.set_visibility` / `posts.unpublish` (explicit visibility and disclosure controls); (4) `comments.list` / `comments.hide` / `comments.reply` / `comments.pin`; (5) `sponsors.list` / `sponsors.get` (inspect sponsorship disclosure obligations, embargo dates, and forbidden tags); (6) `circles.get` / `circles.update_member` (manage `close_friends` membership and blocked accounts); (7) `analytics.summary` / `recommend.slots` (inspect saves, completion rate, negative feedback, and deterministic posting-slot/topic recommendations). Privileged Infra management uses `env.setup`, `env.reset`, and `env.apply_event`.
- **State and lifecycle (required):** Each post preserves immutable revision history (`revisions[]`), audience visibility transitions, disclosure flags, and comment moderation logs in account-isolated state; public-facing feed items and attached visual assets load from the run fixture. Publishing an already-published post is idempotent; scheduling in the past, publishing a sponsored post while missing required `paid_partnership` flag (when enforced), or mutating an unknown post/comment ID rejects atomically. Reset restores baseline drafts, visual assets (`ctx.assets`), circles, comments, sponsorships, and virtual clock.
- **Events and notifications (required):** Infra applies three scripted events via `env.apply_event`: `comment.create` (adds new follower comments or spam), `sponsor.update` (updates embargo time, disclosure rule, or revokes campaign approval), and `engagement.snapshot` (updates post save/completion/unfollow metrics). Replaying an identical `event_id` is idempotent; unknown post/sponsor IDs fail atomically. ReelPulse sends and receives no cross-app notifications in v1.

```json
{
  "event_id": "sponsor-embargo-shift-01",
  "at": "2026-11-19T14:20:00-08:00",
  "operation": "sponsor.update",
  "payload": {
    "sponsor_id": "sp-roastcraft-q4",
    "post_id": "post-draft-grinder-reel",
    "status": "embargo_extended",
    "earliest_publish_at": "2026-11-22T12:00:00-08:00",
    "required_disclosure": true,
    "forbidden_tags": ["#competitorbrand"]
  }
}
```

- **Shared data and dependencies (required):** Node.js 18+ and public Core runtime (`runtime 1.5.0` with `ctx.assets`). Fixtures ship as UTF-8 JSON plus ~20–24 synthetic PNG slide/cover cards (~480 KiB total decoded bytes, within `64-asset / 1 MiB`) with a SHA-256 manifest. Runs standalone with only Core.

## 4. Construction plan and effort

**✍️ Work breakdown (required):**

| Workstream | Planned work and scale | Deliverable / quality check | Effort (person-days) |
| --- | --- | --- | ---: |
| Web / app construction | Implement MCP handlers (`posts.*`, `asset.read`, `comments.*`, `sponsors.*`, `circles.*`, `analytics.summary`, `recommend.slots`), revision/visibility state machine, and lightweight local GUI preview. | Verify visual asset reads, audience circle transitions, embargo/disclosure rejection paths, spam comment hiding, and recommendation ranking across isolated accounts. | 3–4 |
| Data and image collection | N/A — all personas, posts, comments, brands, and slide/cover PNGs are 100% synthetic. | Manifest confirms zero third-party or copyrighted media. | 0 |
| Synthetic data and assets | Author 18–22 posts/drafts, 45+ comments (legitimate + spam), 3–4 sponsorship briefs, 2 audience circles, engagement time series, and 20–24 synthetic PNG visual slides/covers (`<= 500 KiB` total) encoding clear visual cues (visible street number, bystander badge, missing `#ad` overlay, clean variant). | Validate schemas, SHA-256 asset hashes, `<= 64 assets / <= 1 MiB` budget, zero duplicate fixtures, and visual legibility of every generated slide. | 2–3 |
| App integrations | All v1 workflows execute standalone inside ReelPulse on Core 1.5.0. | Verify standalone execution with only ReelPulse and Core enabled. | 0 |
| Validation and reset | Build App-local business unit tests plus public-runtime verification for `env.apply_event` (`comment.create`, `sponsor.update`, `engagement.snapshot`), idempotent replay, invalid transition rejections, `ctx.assets` permission checks, rollback, and full reset. | Publish pinned versions, CLI commands (`npm run app:verify`), and `.artifacts/` reports in the PR. | 1.5–2 |

- **Milestones, owners and dependencies (required):** Owner: @Aria068. Sequence: (1) schemas, visibility/moderation/analytics handlers (days 1–4); (2) synthetic posts, comments, sponsorships & visual slide PNGs (days 5–7); (3) tests, event injection & `app:verify` (days 8–10). Fits within the 14-calendar-day v1 delivery deadline after `/approve-plan`. No blocking dependencies.
- **Resources and total effort (required):** 7–9 person-days total. Local Node.js 18+ and Python/PIL/Matplotlib offline asset synthesis; zero external API/data costs; `< 1 MiB` fixture size.
- **Scope boundary and open questions (required):** v1 covers visual carousel/reel drafts (`ctx.assets` PNGs), audience circles, scheduling/visibility transitions, sponsorship disclosure/embargo checks, comment moderation, and save/retention-based recommendations. Out of scope: video transcoding/playback, live algorithmic feed crawling, direct-message chat (handled by `apps/messages`), and ad-auction billing. Open question: whether reviewers prefer keeping sponsorship disclosure checks enforced by tool validation or surfaced as inspectable compliance warnings for tasks to test agent judgment.
- **License and external dependencies (required):** MIT License for all code, fixtures, and generated PNG assets. Instagram and TikTok are design references only; zero external services required.

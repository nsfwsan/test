# Tasks

Tracked work items for SlideItUpNow.

## In Progress

## Backlog

### Build E621.net Integration

Add e621.net as a content source alongside the existing Reddit integration, following the same `nextSlides()` contract used by `localFiles.js` and `reddit.js`.

#### API Summary

| Detail | Value |
|---|---|
| Base URL | `https://e621.net` |
| Posts endpoint | `GET /posts.json` |
| Response format | JSON |
| Rate limit | Hard cap: 2 req/s — best practice: 1 req/s (503 on breach) |
| User-Agent | **Required.** Custom string only — e.g. `SlideItUpNow/1.0 (by username on e621)`. Impersonating a browser UA results in a block. |

#### Request Parameters (`/posts.json`)

| Parameter | Notes |
|---|---|
| `tags` | Space-separated tag query. Max **6 tags** per request. Supports metatags like `order:score`, `rating:s`, `type:video`. |
| `limit` | Results per page. Max **320**. |
| `page` | Page number for pagination. Also accepts `a{id}` (after ID) and `b{id}` (before ID) for cursor-based pagination. |

#### Authentication

- Read-only access (browsing posts) does **not** require authentication.
- Authenticated requests use **HTTP Basic Auth**: username + API key (generated in e621 account settings).
- Required only for write operations (voting, flagging, etc.) — not needed for this feature.
- Explicit login unlocks access to user-specific content filters and higher-rated content.

#### Post Response Fields (relevant subset)

| Field | Description |
|---|---|
| `id` | Post ID — use for cursor pagination (`a{id}`) |
| `file.url` | Direct URL to the full-resolution file |
| `file.ext` | File extension: `jpg`, `png`, `gif`, `webp`, `mp4`, `webm` |
| `file.width` / `file.height` | Dimensions in pixels |
| `preview.url` | Thumbnail URL |
| `sample.url` | Medium-resolution sample |
| `rating` | `s` (safe), `q` (questionable), `e` (explicit) |
| `tags` | Object of tag arrays by category (general, species, character, etc.) |
| `md5` | File hash — useful for deduplication |

#### Supported File Types (for this app)

- Images: `jpg`, `png`, `gif`, `webp`
- Video: `mp4`, `webm`
- Skip: `swf` (Flash — deprecated)

#### Implementation Notes

- Mirror the structure of `reddit.js`: export `startE621()` and `nextE621Slides()`.
- Use cursor-based pagination (`a{id}`) rather than page numbers to avoid duplicates across fetches.
- Respect the 1 req/s sustained rate limit — add a delay between paginated fetches.
- Set a descriptive `User-Agent` header on every request (required; plain `fetch()` in browsers sends no custom UA — may need a CORS proxy or the app to note this limitation).
- Filter out `swf` posts before returning slides.
- Tags input, sort order, and rating filter should be configurable (similar to Reddit's subreddit/sort/time fields).

#### References

- [E621 OpenAPI Spec](https://e621.wiki/)
- [ZestyAPI — JS wrapper](https://github.com/re621/ZestyAPI)
- [DonovanDMC/E621 — TS wrapper](https://github.com/DonovanDMC/E621)

## Done

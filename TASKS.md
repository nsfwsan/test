# Tasks

Tracked work items for Auto Goon.

## In Progress

### `RG` — Integrate RedGifs

Add RedGifs as a content source, either standalone or as an enhancement to the existing Reddit integration (Reddit posts often embed RedGifs links).

#### Feasibility

RedGifs has a public REST API at `https://api.redgifs.com` with a Swagger spec at SwaggerHub. Key findings:

- **Authentication**: A temporary Bearer token is required for all requests. It is obtained anonymously via `GET /v2/auth/temporary` — no account needed. The token must be attached as `Authorization: Bearer {token}` on subsequent requests.
- **Search endpoint**: `GET /v2/gifs/search?search_text={tags}&order={order}&count={count}&page={page}` — returns paginated GIF/video results.
- **Response fields**: Each item includes video URLs (HD, SD), dimensions, tags, and duration.
- **No account required**: Unlike e621, basic search works without login.

#### CORS Risk (Critical)

CORS issues with `api.redgifs.com` have been actively reported by browser-based projects. The API appears to restrict `Access-Control-Allow-Origin` to specific origins, which may block direct `fetch()` calls from this app. This is the primary feasibility risk and must be tested before investing in full implementation.

- If CORS is blocked from `file://` or GitHub Pages: a proxy would be required, which breaks the "no backend" architecture of this app.
- Mitigation: test a bare `fetch("https://api.redgifs.com/v2/auth/temporary")` in the browser console on the hosted domain first.

#### Two Integration Paths

1. **Standalone source** — new "From RedGifs" button on the welcome screen, form with tag search, mirrors e621.js structure.
2. **Reddit enhancement** — Reddit posts already embed RedGifs iframes; the existing `media_embed` path in `reddit.js` already handles these as iframes. A deeper integration could resolve the actual video URL from RedGifs and play it natively instead.

Path 2 may deliver more value with less work, since Reddit + RedGifs content already partially works.

#### API Summary

| Detail | Value |
|---|---|
| Base URL | `https://api.redgifs.com` |
| Auth endpoint | `GET /v2/auth/temporary` — returns `{ token }` |
| Search endpoint | `GET /v2/gifs/search?search_text=&order=&count=&page=` |
| Order options | `trending`, `top`, `latest`, `best` |
| Response | `{ gifs: [{ id, urls: { hd, sd }, width, height, duration, tags }] }` |
| Pagination | Page-number based (`page=1`, `page=2`, …) |
| Rate limit | Not officially documented; 429s reported under heavy use |
| CORS | **Unconfirmed for browser fetch — test before building** |

#### References

- [RedGIFs REST API on SwaggerHub](https://app.swaggerhub.com/apis/RedGIFs/RedGIFs/1.0.0)
- [redgifs Python wrapper docs](https://redgifs.readthedocs.io/en/stable/api.html)
- [CORS issue report](https://github.com/extesy/hoverzoom/issues/1194)

#### Implementation Plan

- [x] **`RG-1`** Create `redgifs.js` — Core module mirroring `e621.js`
  - `fetchToken()`: `GET /v2/auth/temporary`, stores Bearer token; re-called on 401
  - `startRedgifs()`: reads tags/order from form, resets state, fetches token then first page
  - `loadNextPage()`: `GET /v2/gifs/search` with Bearer header, page-number pagination, maps gifs to `{ type: 'short', format: 'video', url: gif.urls.hd || gif.urls.sd, width, height }` slide objects
  - `nextRedgifsSlides(remainingWidth, height, isEmpty)`: same contract as `nextE621Slides`
  - `initRedgifs()`: binds form element refs and error element
  - `showError()`: same pattern as e621.js
  - On CORS/TypeError: surface actionable error message

- [x] **`RG-2`** Add RedGifs form to `index.html`
  - "From RedGifs" button alongside existing source buttons (`class="titleContent browse noForm"`)
  - `#redgifsForm` (hidden by default) containing:
    - `← Back` button (`#redgifsBack`)
    - Tags input (`#rgTags`)
    - Order select (`#rgOrder`): Trending, Top, Latest, Best
    - Submit button (`#redgifsSubmit`)
    - Error paragraph (`#redgifsError`)

- [x] **`RG-3`** Wire up `script.js`
  - Import `startRedgifs`, `nextRedgifsSlides`, `initRedgifs` from `./redgifs.js`
  - Add `showRedgifsForm()` and `openRedgifs()` functions
  - Bind `#browseRedgifs`, `#redgifsSubmit`, `#redgifsBack` in `window.onload`
  - Call `initRedgifs()` in `window.onload`

- [x] **`RG-4`** Extend CSS selectors in `style.css`
  - Add `#redgifsForm` to form width/margin rule
  - Add `#redgifsForm>div` to form row flex rule
  - Add `#redgifsSubmit` to submit button rule
  - Add `#redgifsSubmit` to portrait media query button rule
  - Add `#redgifsForm` to portrait media query width rule

- [x] **`RG-5`** Add a back button to the slideshow view — mirrors the "Add Back Button to Slideshow" backlog task; implement for RedGifs (and ideally all sources) so the user can return to the welcome screen without refreshing

- [ ] **`RG-6`** Fix: Videos do not load — investigate why video slides from RedGifs fail to play; likely causes: browser autoplay policy requiring `muted` attribute, CORS on the video CDN URLs, or missing `crossOrigin` attribute on the `<video>` element

## Backlog

### `E6-FAV` — E621 "My Favourites" Mode

Add a "My Favourites" button to the E621 form that starts a slideshow of the logged-in user's saved posts, instead of a tag search.

#### Background

The e621 API exposes favourites via `GET /favorites.json?user_id={id}` (authenticated). This is distinct from the tag search endpoint (`/posts.json`) and requires a valid login. Other account features — followed tags, personal feed/home page — have no public API equivalent and cannot be accessed this way.

#### Scope

- The button should appear on the E621 form, replacing or supplementing the submit button when credentials are entered
- Requires the user to be logged in (username + API key); if credentials are absent, show a message directing the user to fill them in
- Fetches from `GET /favorites.json?user_id={id}` with the same `Authorization: Basic` header used in `loadNextPage()`
- Pagination uses the same `page=b{id}` cursor pattern as the posts endpoint
- Response shape is the same as `/posts.json` — `{ posts: [...] }` — so the existing slide-mapping logic in `loadNextPage()` can be reused

#### Implementation Notes

- Need to resolve the logged-in user's numeric `user_id` from their username — the endpoint `GET /users/{username}.json` returns the user object including `id`; fetch this once at start and cache it
- Add `<button id="e621Favourites">My Favourites</button>` to the E621 form in `index.html`, alongside the existing submit button row
- In `e621.js`, add `startE621Favourites()`: fetches the user ID, sets a module flag to switch `loadNextPage()` to use the favourites endpoint instead of the tags endpoint, then proceeds identically to `startE621()`
- Wire `#e621Favourites` to `openE621Favourites()` in `script.js` (mirrors `openE621()` but calls `startE621Favourites()`)
- If the user ID fetch fails (bad credentials, network error), surface a clear error via the existing `showError()` helper

### `RD-UP` — Reddit Upvoted Posts Feed (Investigate)

Display a slideshow sourced from the logged-in user's Reddit upvoted posts via `GET /user/{username}/upvoted.json`.

#### Feasibility

The endpoint exists and works, but requires Reddit OAuth — a significant step up from the current anonymous JSON API approach used in `reddit.js`.

**Auth flow (implicit grant — browser-only, no backend needed):**
1. User is redirected to Reddit's authorization page (requires a registered Reddit app `client_id` from reddit.com/prefs/apps)
2. Reddit redirects back to the app with an access token in the URL fragment
3. Token is attached as `Authorization: Bearer {token}` on requests to `oauth.reddit.com`

**Scope required:** `history` + `identity` (to resolve the username)

**Limitations:**
- Requires the user to register a Reddit app themselves to obtain a `client_id` — adds setup friction
- Implicit grant tokens expire after 1 hour with no refresh token; user must re-authenticate each session
- The existing Reddit integration uses `old.reddit.com` with no auth — OAuth is a different code path entirely

#### Implementation Notes

- Add a "My Upvotes" button to the Reddit form, visible only when OAuth credentials are configured
- On click: redirect to `https://www.reddit.com/api/v1/authorize?client_id=...&response_type=token&scope=identity history&redirect_uri=...`
- On return: parse `#access_token=` from the URL fragment, store in `sessionStorage` (not `localStorage` — tokens expire)
- Fetch `https://oauth.reddit.com/user/{username}/upvoted.json` with the Bearer token; response shape is identical to the existing Reddit JSON API so `reddit.js` parsing logic can be reused
- The `redirect_uri` must exactly match what was registered in the Reddit app — this works for GitHub Pages but not `file://`

#### Verdict

Feasible but non-trivial. Best approached after the core Reddit and E621 integrations are stable.

## Done

### `LOAD-ANIM` — Port Loading Animation to All Sources

Bucket animation now plays during the API call for Reddit, E621, and RedGifs sources. `animateBucket()` gained an optional `fillFraction` parameter (network sources pass `0.5`; local folder load unchanged). Animation is started before `start*()` is awaited so it's visible during the network request, and cleared on both success and failure.

### `SL-BACK` — Add Back Button to Slideshow

Fixed-position `← Back` button in the top-left corner of the slideshow view. Invisible by default, fades in on hover (`opacity` transition). Clicking it calls `stopSlideShow()` which cancels all active timers via a module-level `activeTimers` Set, destroys HLS instances, disposes blob URLs, clears the bucket animation interval, hides the load container, and restores the welcome screen.

### `UI-RESIZE` — Auto Resize UI Depending on Browser Size

10 `clamp()` / `min()` values applied across `style.css` and `tooltip.css`. Buttons, forms, decorative images, settings dialog, and tooltip all scale continuously from 360px to 1920px. Zero new media queries — existing portrait/landscape overrides preserved unchanged.

### `E6` — Build E621.net Integration

Full integration delivered across `e621.js`, `index.html`, `script.js`, and `style.css`. Covers tag search, sort, rating filters, optional account login with localStorage persistence, cursor-based pagination, rate limiting, video slide support, form styling parity, and CORS error surfacing.

### `MENU-BACK` — Add Back Button to Menu Screens

`← Back` button added to the top of `#redditForm` and `#e621Form`. `showWelcome()` in `script.js` reverses the form-show logic. Field values are preserved automatically.

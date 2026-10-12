# Blog performance investigation

Date: 2026-10-10. Repository commit: `fdd3f05`. Production: https://shubhsec.dev/.

## Scope and confidence

The initial investigation was read-only and covered source code, the existing production build in `dist/`, and public production responses. Only this report was added at that stage. The later authorized implementation is recorded at the end of this report.

The user's concern about high LCP was the starting symptom. Subsequently supplied Cloudflare screenshots show good LCP in the selected 24-hour window, with only four recorded page views (see the update below). They do not establish a current widespread Core Web Vitals problem. No Lighthouse run or browser performance trace was captured, so this report does **not** claim independently measured LCP, CLS, INP, or TBT scores, or a guaranteed improvement in milliseconds. Findings distinguish confirmed loading mechanisms from their inferred impact.

No build was run: `pnpm build` runs `optimize:images`, whose script overwrites images and deletes original PNG/JPEG files. That would violate the requested investigation-only scope. Existing build measurements are identified separately from live responses. The live Mermaid chunk exactly matches the local build bytes, and the sampled live HTML uses the same asset names.

## Main findings

The strongest lead is unnecessary JavaScript reaching the initial page: a Mermaid chunk intended for conditional loading is statically imported by globally loaded scripts. Other concrete problems include a wrong image preload, automatic YouTube initialization, inaccurate hero image sizing, and article image visibility/layout depending on JavaScript.

| Priority | Finding | Evidence strength | Likely affected metrics |
| --- | --- | --- | --- |
| P0 | Mermaid is pulled into ordinary pages through static imports | Confirmed in deployed HTML and compiled modules | LCP render delay, loading bytes, CPU work, possible INP/TBT |
| P1 | Homepage preloads a different image from the actual first card | Confirmed in live HTML and source | LCP resource competition, wasted request |
| P1 | BGM creates the YouTube player before music is requested | Confirmed source lifecycle; third-party waterfall not captured | Loading bytes, CPU, resource competition |
| P1 | Article images are hidden until JS runs and change aspect ratio after loading | Confirmed source and live unsized images | CLS, image visibility, possible image LCP |
| P1 | Banner `srcset` width and `sizes` disagree with the real image/layout | Confirmed dimensions and source | Image transfer/decode cost, LCP |
| P2 | Many global and repeated React islands hydrate without interaction | Confirmed live HTML | CPU, loading bytes, possible INP/TBT/CLS |
| P2 | Browser code includes a large slug transliteration table | Confirmed compiled chunk and source import chain | Loading bytes and CPU |
| P2 | Internal article links redirect to trailing-slash URLs | Confirmed production 308 | Navigation latency/TTFB |
| P2 | Production cache headers differ from the repository's Nginx configuration | Confirmed sampled responses | Repeat loading and potentially TTFB |
| P3 | Broad CSS and hidden search UI ship on ordinary pages | Confirmed HTML, CSS, and source | Render blocking, FCP/LCP |

P0 means investigate/fix first because of the unusually large and avoidable cost. Priorities are based on evidence and likely reach, not a measured per-finding score impact.

## Observed baseline

### Production HTTP samples

These are individual command-line requests from this environment through Cloudflare's BOM edge, without mobile throttling. Curl timings do not measure rendering or user experience.

| Request | Observation |
| --- | --- |
| `/` | HTTP 200; approximately 333 ms first byte and 422 ms total in the initial request; 191,499 HTML bytes without requesting compression |
| Mermaid JS chunk | HTTP 200; 2,209,801 decoded bytes; 547,339 transferred bytes with Brotli; approximately 571 ms first byte; `CF-Cache-Status: MISS` |
| `/img/site_header_800.webp` | HTTP 200; 26,562 bytes; `CF-Cache-Status: MISS` |
| Linux article without trailing slash | HTTP 308, then HTTP 200 after following the redirect; approximately 548 ms first byte reported by curl for the followed request; 29,337 transferred bytes with compression |
| Capsule Corp writeup | HTTP 200 after following redirects; 28,511 transferred bytes with compression |

Sampled HTML returned `Cache-Control: public, max-age=0, must-revalidate` and `CF-Cache-Status: DYNAMIC`. Sampled JS and image responses returned `public, max-age=14400, must-revalidate`. A single MISS does not prove a chronically poor cache hit rate. The first uncompressed homepage request does not indicate broken compression: Brotli was confirmed on other negotiated responses.

### HTML and existing build inspection

- Homepage: 38 React islands: 8 `client:only`, 4 `client:load`, 6 `client:idle`, 20 `client:visible`.
- Sampled Linux article and writeup: 29 islands each.
- Homepage decoded HTML: 191,499 bytes; article: 141,392 bytes; writeup: 162,952 bytes.
- The homepage's static dependency closure across **all** island roots and external module-script roots includes 74 local JS files totaling approximately 3.30 MB decoded and 953 KB using independently computed gzip estimates. This is a code graph estimate, not a browser waterfall: invisible islands need not hydrate immediately, modules are shared, and actual Brotli transfer sizes differ.
- The main globally linked CSS file is 241,630 bytes decoded, approximately 46,771 bytes in a local gzip estimate. Hidden search adds another 32,118-byte CSS file, approximately 5,335 bytes gzip.

Large files existing in `dist/` do not automatically mean they are downloaded. The Mermaid finding below has explicit static import evidence; unused comment-provider bundles do not.

## Detailed findings and proposed fixes

### 1. Lazy Mermaid loading is defeated by compiled static imports

**Evidence:** `astro.config.mjs:249` registers Mermaid globally. Its compiled page script, `dist/_astro/page.Dz4aN0eN.js`, is present in all three sampled live pages. That script begins with a static import of a helper from `vendor-mermaid.B0kVuggm.js`, even though the actual Mermaid initialization checks for diagrams and uses a dynamic import.

There are additional static paths: `PagefindConfig...js` imports `vendor-pagefind...js`, which imports the same helper from the Mermaid chunk. The article's `CustomContent...js` also statically imports it. Consequently, checking for diagrams before initialization does not prevent the browser from downloading and processing the entire statically imported module.

The live chunk is **2.21 MB decoded / 547 KB Brotli transferred**. This alone is much larger than the sampled small hero variant. It can compete with critical resources and introduce significant parse/evaluation work. Exact long-task duration and overlap with LCP remain unmeasured.

**Likely mechanism:** the custom `manualChunks` rules at `astro.config.mjs:273` and the bundler's placement of the shared preload helper undermine the intended lazy boundary. The compiled dependency is proven; a controlled build is needed to determine the precise configuration correction.

**Proposed fix:** adjust chunking so shared runtime/preload helpers remain in a lightweight shared module and Mermaid stays behind its dynamic import. Review AntV's boundary too, without assuming its entire bundle currently loads on the homepage. Check the installed Mermaid integration's generated script. Lower the unusually permissive `chunkSizeWarningLimit: 3000` after establishing practical budgets.

**Acceptance:** no Mermaid/AntV request on a diagram-free cold page; diagrams still render on direct article loads and Astro navigation. Inspect every global script's static imports, not just the Mermaid loader.

### 2. Homepage preload points at the wrong cover

**Evidence:** `src/pages/index.astro:59` selects `firstVisiblePost.cover ?? defaultCoverList[0]`. But `src/components/post/PostList.astro:24` shuffles the cover list, and `PostItemCard.astro:46` uses that independently selected random cover when the post has none.

The sampled live homepage preloads `/img/cover/kallen-mech.webp` (and its mobile variant), while the first eager card actually uses `/img/cover/lancelot-final.webp`. This is a directly observed mismatch, not just a theoretical randomization issue.

The page also contains a full-width banner occupying `60dvh`, with high image priority. The homepage's assertion that the first card is the LCP image has no browser evidence behind it; the banner or heading may be LCP depending on viewport and device.

**Proposed fix:** resolve each fallback cover once and use that same value in the rendered card and any preload. Capture the actual LCP element per viewport before selecting its preload. Align a responsive preload with the image candidate the browser will actually select, and keep high priority focused on critical visible content.

**Acceptance:** no unused cover preload; preload URL matches the eventual selected resource; compare banner/card/heading LCP attribution on mobile and desktop.

### 3. Closed music player still initializes YouTube

**Evidence:** BGM is enabled in `config/site.yaml:564`; `AppShell.astro:38` mounts it with `client:only`. `GlobalBGMPlayer.tsx` unconditionally calls `useYouTubePlayer(tracks)`. Its mount effect calls `ensurePlayer()` at `src/hooks/useYouTubePlayer.ts:148`, which loads `https://www.youtube.com/iframe_api` and creates an offscreen player in `src/lib/yt-player-manager.ts:101` and `:156`.

The UI is conditionally displayed, but that condition does not guard the hook. The component comment implying laziness does not describe the actual player initialization lifecycle. No claim is made that audio autoplays; loading the API/player and starting playback are separate actions.

**Proposed fix:** initialize the player on explicit music intent, retaining the existing persistence behavior once playback has started. Keep a lightweight toggle available without loading the full player UI.

**Acceptance:** no YouTube API/iframe requests before opening/playing music on a fresh visit; started playback still survives page navigation.

### 4. Markdown image placeholders can cause shifts and delay visibility

**Evidence:** `src/styles/theme/markdown.css:453` gives images `aspect-ratio: 4 / 3` and `opacity: 0`. The `.loaded` rule at `:471` changes these to `aspect-ratio: auto`, `opacity: 1`, and a maximum height. The class is added by `src/lib/image-enhancer.ts:139`, after the content enhancement script runs.

The sampled Capsule Corp writeup contains four article images with neither `width` nor `height`. `src/lib/markdown/rehype-image-placeholder.ts` adds lazy loading and figure wrappers but does not derive dimensions. Portrait grouping also rearranges wrappers after loading in `image-enhancer.ts`.

A generic 4:3 placeholder cannot reserve the correct final space for screenshots of other shapes. The geometry changes after load, and images can remain transparent when enhancement fails or JavaScript is unavailable. This is especially relevant because the content enhancement script itself statically imports the large Mermaid chunk.

**Proposed fix:** emit intrinsic dimensions or the correct aspect ratio from image metadata; preserve stable geometry; make content images visible independently of enhancement JavaScript. Keep lazy loading for offscreen images, with a targeted exception if a particular article image is actually LCP. The plugin currently forces lazy loading even when image attributes might request another policy.

**Acceptance:** article images remain visible with JS disabled; image loading and portrait grouping do not displace visible text; verify CLS while scrolling as well as during initial loading. Correct dimensions are a recommended way to reserve image space. [web.dev CLS guidance](https://web.dev/articles/optimize-cls/)

### 5. Hero responsive metadata is inaccurate

**Evidence:** `src/components/ui/cover/Cover.astro:140` declares `sizes="(max-width: 768px) 100vw, 50vw"`, but `TwoColumnLayout.astro` places the cover above the columns as a full-width slot. Its `srcset` declares `site_header_1920.webp` as **1200w**, while Sharp metadata reports **2730 × 1536**. The other candidate is correctly 800 × 450.

The large candidate is 129,876 bytes; the small candidate is 26,562 bytes. The incorrect descriptor can make a browser select a resource that is much larger than the advertised width. High-DPR mobile devices can select the large file too. The desktop `50vw` declaration can also choose insufficient resolution for the actual full-width slot. Actual candidate selection must be checked via `currentSrc` at representative viewport/DPR combinations.

**Proposed fix:** produce a deliberate set of real widths, use truthful width descriptors, and describe the actual display width. Preload the selected hero candidate if the trace confirms it is LCP. The existing 800 px variant is already small; more aggressive compression alone is unlikely to address the largest demonstrated loading cost.

### 6. Global hydration cost is high for a reading site

**Evidence:** `src/layouts/AppShell.astro:38–49` mounts music, floating controls, settings, search, fullscreen code/diagrams, image lightbox, and toast islands globally. Header/mobile UI also uses immediate/client-only hydration. Post cards contribute 20 visible islands on the homepage for metadata and tag rows.

Idle hydration delays work until an idle period; it still downloads/executes the component without a user asking for it. Visible hydration still runs for rows in the viewport. Multiple instances share downloaded modules, but each retains its own props and hydration work. Desktop/mobile variants mounted with CSS visibility can both incur work. The homepage contains two `ScrollProgress` islands.

**Proposed fix:** preserve static reading content as Astro HTML; use lightweight event controllers for simple controls and load modal/player implementations on intent. Review repeated scrollable rows for a CSS solution. Make responsive duplicate hydration conditional where needed.

Existing settings content is already dynamically imported by `SettingsPanel.tsx`; retain that useful boundary. Search index loading and UI loading should be evaluated independently.

**Acceptance:** fewer immediate islands and smaller initial JS closure; no regression in navigation, keyboard shortcuts, focus handling, settings, or post interactions. Quantify long tasks before claiming an INP benefit.

### 7. Browser route helper carries a transliteration table

**Evidence:** `dist/_astro/route.Kygf6W-N.js` is 183,224 bytes decoded, approximately 54,029 bytes gzip, and visibly contains a large transliteration mapping. The source chain is `@lib/route` → `getPostSlug` in `src/lib/content/locale.ts` → `src/lib/slug.ts` → `transliteration`.

Client components such as `RandomPostList.tsx` and `RelatedPostList.tsx` import only `encodeSlug` from that route module, but the existing output still carries the broader dependency. Disabling transliteration at runtime does not inherently remove a static dependency.

**Proposed fix:** move browser-safe URL encoding into a dependency-light module, keeping content slug generation at build time. Pass ready-to-use URLs where practical.

**Acceptance:** client encoding users no longer pull transliteration data; existing non-ASCII links and custom permalinks stay correct.

### 8. Production redirects add an avoidable navigation hop

**Evidence:** the homepage links to `/post/linux/linux-privilege-internals-part-1`. Production responds with 308 to `/post/linux/linux-privilege-internals-part-1/`. The Astro configuration has `trailingSlash: 'ignore'`, which does not stop the hosting layer from redirecting directory routes.

**Proposed fix:** choose a canonical route policy supported by production and align internal links, canonical metadata, sitemaps, and redirect handling. Measure through the deployed host rather than assuming local development routing behaves identically.

**Acceptance:** an internal post click reaches its canonical HTML in one request. This particularly affects direct post loads and client-router fetches; it does not explain all homepage LCP.

### 9. Cache policy needs deployment-specific review

**Evidence:** the sampled live hashed JS and stable-path image use a four-hour lifetime. `docker/nginx/default.conf` instead specifies a year with `immutable` for static extensions. Live HTML is `DYNAMIC` with browser revalidation required. These differences establish that the repository's Nginx policy cannot be assumed to describe production.

Cloudflare does not cache HTML by default; `DYNAMIC` is therefore not itself an application bug. [Cloudflare cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/)

**Proposed fix:** identify the actual host and applicable header/cache rules. Long immutable caching is appropriate for content-hashed `/_astro/` assets. Stable-path images need versioned URLs or a shorter/invalidation-aware policy. Consider explicit caching of public static HTML only after separating it from dynamic moments/API/authenticated content and establishing deployment purge behavior.

The Docker rule applying `immutable` to all image paths is also a stale-content risk because those filenames are not content hashes. Do not blindly copy that rule into production.

**Acceptance:** inspect browser and edge cache behavior on repeat requests, fresh deployments, and different regions. Track TTFB distribution; the single request timings here cannot identify regional or origin bottlenecks.

### 10. CSS and hidden search UI add baseline cost

**Evidence:** `src/styles/index.css` globally imports article, media player, quiz, encrypted content, embed, and other feature styles. The live homepage links the approximately 242 KB main CSS and 32 KB Pagefind stylesheet. `SearchPortal.astro` instantiates a search component inside a hidden container; the emitted Pagefind module is loaded globally and has the Mermaid helper dependency described earlier.

**Proposed fix:** first remove the Mermaid dependency leak; then split significant article/feature CSS where it demonstrably reduces ordinary-page CSS, and consider loading search UI/style on intent. Check whether full theme translation/config payloads and fallback post pools materially contribute to serialized HTML before narrowing them.

**Acceptance:** smaller blocking CSS and parse cost without styling flashes; search remains responsive on its first opening.

## Secondary image pipeline issues

`src/scripts/optimizeImages.ts` skips processing whenever a mobile sibling already exists. Updating an original image can therefore leave its mobile variant stale. It also does not resize the base WebP, so large original dimensions survive recompression. Errors are logged and processing continues, while the final message says images were successfully optimized.

Cards mechanically construct `-mobile.webp` URLs for local and external cover strings without an existence/URL policy check. The current sampled local card has its mobile sibling; failures for external or newly added covers are a conditional risk, not an observed production 404.

Article Markdown uses base screenshot URLs even though mobile variants exist. A later responsive-image pass could reduce article bytes, provided text-heavy screenshots remain legible. These are lower priority than correcting the JavaScript leak and stable image layout.

## Existing choices that help

- Astro is configured for static output; ordinary blog content does not require per-request React rendering.
- The hero is in HTML with eager loading and high priority.
- Covers have eager loading for the first card and lazy loading for later cards.
- JetBrains Mono Latin is preloaded, self-hosted, and its Fontsource CSS uses `font-display: swap`.
- KaTeX CSS is linked only when an article contains math.
- Settings panel content already uses a dynamic import.
- Brotli works on sampled production JS/article responses.
- Umami and comments are disabled in the active configuration; their dependencies appearing in `package.json` or old `dist/` output is not proof they slow current visits.

Preserve these benefits. Dependency count and total repository image size are not useful substitutes for a real critical-path measurement.

## Suggested implementation order

1. Record mobile/desktop browser traces and Cloudflare route/device baselines; identify each route's actual LCP element.
2. Correct Mermaid/shared helper chunk boundaries. This has the clearest large avoidable cost.
3. Correct homepage preload selection and banner responsive metadata.
4. Delay YouTube initialization until music intent.
5. Make article images visible and dimensionally stable without enhancement JS.
6. Remove transliteration from lightweight browser URL helpers and reduce global hydration.
7. Align canonical URLs and production cache policy.
8. Split CSS/search costs if the new traces still identify them as significant.

Avoid combining every change into one patch: measure each major mechanism separately so improvements can be attributed and regressions found.

## Measurement plan before and after fixes

Use the homepage, the Linux article, the image-heavy Capsule Corp writeup, and a diagram-containing article. Compare direct cold navigation, warm repeat visits, and Astro client navigation separately.

- Capture DevTools Performance/Network traces on mobile and desktop, including a representative constrained network and CPU profile. Record actual conditions and repeat several times.
- Record LCP element URL/selector and the breakdown into TTFB, resource load delay, download duration, and render delay. Browser guidance describes these as distinct mechanisms requiring different fixes. [LCP optimization guidance](https://web.dev/articles/optimize-lcp)
- Inspect initial requests for Mermaid, AntV, YouTube, Pagefind, and optional UI modules. Check `currentSrc`, request priority, unused preload warnings, duplicate transfers, long tasks, and JS coverage.
- Record CLS sources during load and while scrolling screenshots. Test missing/blocked images and disabled JS.
- Exercise menu, search, settings, music, TOC, image lightbox, and diagram rendering. INP needs real interactions; Lighthouse TBT is a laboratory diagnostic and is not interchangeable with field INP.
- Compare Cloudflare's 75th-percentile LCP/CLS/INP by route and device over comparable traffic windows. Aim for LCP ≤2.5 s, CLS ≤0.1, INP ≤200 ms. Field data may take time to reflect deployments; aggregate improvements can conceal a slow route or device group. [Core Web Vitals guidance](https://web.dev/articles/top-cwv)

The unresolved question is **how much** each confirmed cost contributes to the reported metrics. The repository and production responses provide enough evidence to prioritize fixes, but only browser attribution and field data can establish their exact impact.

## Update: user-provided Cloudflare screenshots

The Web Analytics screenshots select the last 24 hours, exclude bots, and show four visits and four page views. Their visible metrics are:

| Metric | Screenshot value | Interpretation |
| --- | --- | --- |
| LCP P50 | 672 ms | Fast in this sample |
| LCP P75 | 688 ms | Fast in this sample |
| LCP P90 / P99 | 864 ms / 864 ms | Small sample; these percentiles are not a robust tail baseline |
| LCP good | 100% | No poor LCP shown in this window |
| INP good | 100% | No poor INP shown; numeric values and eligible measurement count are not visible |
| CLS good | 100% | No poor CLS shown; numeric values are not visible |
| Page load time | 1,446 ms | Separate dashboard metric; do not equate it with LCP |
| LCP / CLS debug view | No data | Screenshots do not identify the actual LCP element or layout-shift sources |

These observations change the diagnosis: there are confirmed optimization opportunities in the code, but these screenshots do not demonstrate a present high-LCP incident. Four page views cannot establish performance across slow phones, networks, countries, or all article routes. The site-level page-view count also need not equal the eligible measurement count for every vital.

The separate request analytics screenshot shows approximately 1.27k requests, including 508 HTTP 200, 198 HTTP 304, 176 HTTP 404, 145 HTTP 403, and 121 HTTP 308 responses. These count HTTP requests, including assets and potentially automated traffic, rather than Web Analytics page views. The visible request spikes and country distribution cannot by themselves diagnose server overload or visitor performance.

- **404:** filter requests by status and inspect the paths. Missing images, CSS, or JS referenced by real pages would be actionable. Scanner paths or obsolete URLs have a different explanation; the screenshot does not distinguish them.
- **403:** inspect paths and security events to determine whether legitimate page/asset requests were blocked or automated requests were rejected. Do not assume this is an application defect from aggregate counts.
- **308:** inspect redirect sources and destinations. The previously observed article trailing-slash redirect is one confirmed example, but the screenshot cannot attribute all 121 responses to that mechanism; hostname redirects may contribute too.
- **304:** indicates revalidation with an unchanged response. It is not an error, though repeated revalidation of content-hashed assets is a cache-policy optimization opportunity.

Most useful next evidence: a 7–30 day Web Analytics window with measurement volume and browser/country/route breakdowns; mobile PageSpeed reports for the homepage and an image-heavy article; request paths filtered separately for 404, 403, and 308; and identification of the actual hosting platform and cache rules.

## Implementation: first focused performance fixes

The user subsequently authorized implementation on a separate branch. Changes are on `fix/blog-loading-performance`; nothing has been deployed.

- Assigned Vite's shared preload helper to its own lightweight chunk. Global Pagefind/content scripts no longer statically import the entire Mermaid chunk.
- Removed the incorrect homepage card-image preload. Card fallback randomization is preserved; selecting a replacement LCP preload still needs actual LCP attribution.
- Split BGM into a lightweight lazy shell and its existing player implementation. The player is first mounted when music is opened, then retained so closing the panel does not unmount playback.
- Corrected banner `sizes` to the full viewport width, its large candidate descriptor to the actual 2730 px width, and supplied intrinsic dimensions.

### Validation results

- `pnpm build`: passed; 103 pages built. Image optimization processed zero images, and no tracked image/cache files changed.
- `pnpm check`: passed; zero errors, zero warnings, five existing deprecation hints.
- `pnpm lint`: passed with four warnings in unchanged CSS about `!important`.
- `git diff --check`: passed.
- Local production-preview Chromium checks: no Mermaid chunk, BGM implementation, or YouTube request on initial homepage load; opening music fetched BGM and the YouTube API; closing retained initialization; no runtime exceptions observed.
- Direct Linux article load: all five Mermaid diagrams rendered successfully; no runtime exceptions observed.
- Hero loaded correctly at the default desktop viewport and at 390 px / DPR 3. The high-DPR mobile case still selected the large existing image: intermediate generated widths remain a useful future improvement.

The same static dependency-closure method used in the baseline now finds 72 JS files totaling **1,078,582 decoded bytes**, approximately **344,133 bytes in a gzip estimate**, compared with 3,301,554 / 953,430 previously. This is approximately a 67% decoded-byte reduction and 64% gzip-estimate reduction. It measures available static dependencies across all island/script roots, not actual initial network transfer or an LCP improvement. Mermaid, AntV, and the BGM implementation are absent from that static closure.

Actual audio playback across navigation, field Core Web Vitals after deployment, article image geometry/visibility fixes, transliteration dependencies, and hosting/cache/redirect changes remain outside this first patch's verified results.

## Merge review — 2026-10-12

Reviewed every source change and the new player file against `main` at `fdd3f05`. The extracted player implementation matches its original implementation except for its component name and comments. No blocking regression was found; no further application changes were required during this review.

The subsequent tooltip fix is also included: floating controls use a CSS label with a single-line layout on hover and keyboard focus, avoiding dependence on the global tooltip library initializing after React hydration. Buttons retain their accessible names, and duplicate label text is hidden from assistive technology.

Fresh merge checks:

- Production build passed (103 pages); no image assets were rewritten.
- Astro/TypeScript validation passed with zero errors/warnings and five deprecation hints.
- Lint passed with four existing CSS warnings; whitespace validation passed.
- Config, Markdown, and TOC tests passed: 18, 21, and 12 respectively.
- The full test command stopped at backup/migration tests: 34 passed and 22 failed. An isolated checkout of unchanged `main` reproduced the same 22 failing test names, including missing backup `manifest.json` errors. These are pre-existing failures and were not changed as part of this performance work.
- Ran the otherwise-skipped Moments group separately: all 61 tests passed.
- Production browser check confirmed that the homepage does not initially request Mermaid, the full BGM component, or YouTube, and that the incorrect image preload is absent.
- With a simulated YouTube API, verified play, closing/reopening without recreating the player, Astro navigation restoring the same track at 37 seconds, and pause/resume afterward. This proves the application lifecycle against the API contract; it does not verify real YouTube streaming or audible playback.
- All five Mermaid diagrams on the Linux article rendered after client navigation. Keyboard-focus tooltips were visible on one line and remained within a 390 px viewport. No uncaught browser exceptions occurred during the successful check.

The user's production-preview Lighthouse reports showed 100 desktop and 94 mobile performance, with mobile LCP of 2.9 seconds. Those are user-reported local lab results; earlier development-server results are not a comparable performance baseline. Further mobile image sizing and the other deferred audit opportunities can be handled separately.

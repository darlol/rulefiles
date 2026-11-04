# Design notes

How the site looks and why, so the next change does not have to guess.

## Direction

**Signal Press** (Direction A, brief-pinned 2026-10-27). The site is a weekly sourced wire: dates, source links and status badges first. Paper ground, serif display, one signal-orange accent used for interaction at AA depth. Cards use a 1px border. There are no drop-shadows and no gradients. The header stays sticky.

Incumbent Layout A (Hanken + indigo) is anti-reference for this world.

## Tokens

All colors, spacing steps and radii are CSS custom properties at the top of `src/static/style.css`. The dark theme redefines every color token inside `@media (prefers-color-scheme: dark)`. Colors are plain hex so the contrast test can read them.

| Role | Light | Notes |
|------|-------|-------|
| `--bg` | `#f6f1e7` | Paper |
| `--surface` | `#fffdf8` | Cards |
| `--sunken` | `#ebe4d6` | Tags, footer, hover rows |
| `--ink` | `#14110e` | Body |
| `--muted` | `#5c564e` | Secondary |
| `--line` | `#ddd4c5` | Hairlines |
| `--accent` | `#9a4318` | Links and primary buttons (BAR signal-deep; AA on paper) |
| `--signal` | `#c45c26` | Brand mark highlight only |
| `--mark` | `#ffe066` | Selection / Latest tag |

Status colors come in pairs (`--reads-fg` on `--reads-bg`, and so on). A status never relies on color alone: every badge has an icon and the status text.

## Type

- **Display:** Source Serif 4 (self-hosted latin woff2 400/600/700)
- **UI:** Source Sans 3 (400/600/700)
- **Data:** IBM Plex Mono (400/500)

Files live under `src/static/fonts/`. License text is `OFL.txt` (SIL OFL 1.1 for all three families). The CSP allows fonts from the site itself (`font-src 'self'`) and nothing else. Latin files come from Fontsource mirrors of google/fonts OFL packages; see `src/static/fonts/README.txt`.

Share-image glyph outlines in `scripts/lib/og-font.json` remain Hanken Grotesk Bold paths (separate asset; license in `scripts/lib/og-font.README.txt`).

## The mark and the name

The mark is a page with one highlighted signal line on an ink plate. It has no letters. The header, the footer, `favicon.svg` and the share image all draw it. The site name always comes from `site.config.json`. The home headline lives in `HERO_TITLE` in `scripts/lib/render.mjs`.

## Home composition

Sticky masthead → issue band (latest week / latest item / Read digest) → H1 + lead + CTAs + side card for this week's issue (no eyebrow/kicker) → trust strip from build data → digest cards with tool chips → matrix teaser + specimen → generator band → newsletter band. The GitHub repository link appears on About only.

## Modes

- Home: Persuade-lite
- Digest / About / legal: Read
- Matrix / Generator: Operate

## Craft floor

No eyebrows/kickers. No indigo. No Hanken on the site surface. No card drop-shadows. ASCII hyphens in client-facing copy.

No coloured side bars. A quote (matrix panel, answer pages, comparisons) is one shared `blockquote` rule: `--sunken` tint, `--r-ctl` corners, `--ink` text (14.9:1 light, 13.6:1 dark), code inside on `--surface`, and `cite` set to the source URL. The "Source" link under it names the origin, so the quote has no label of its own.

On /matrix/ from 60rem the detail panel is alone in the sticky side column, so a tile on the first screen opens its note in view. The title takes focus with `preventScroll`, and the page does not move. The filter bar opens the main column, above the grid and out of the panel's column, so on a desktop the search box, Tools and Status are on the first screen. Under the label and the count, one line holds the search box, the Tools and Status toggles and Reset filters. The chips of each group start closed and open under that line, pushing the grid down; a dot on a toggle shows that one of its chips is on. The dot is `aria-hidden`; screen readers hear it in the name of the button instead, "Tools, filter active" or "Status, filter active", with no count and no `aria-pressed`. Nothing may follow the panel in its column: a sticky element slides over the siblings after it, and that is how the search box once went out of reach. The controls of the bar have a `scroll-margin-top` that clears the sticky header, 138 pixels tall at 320. The bar costs one row of tiles at 1440 and 1920 and two at 1024 and 1280. Below 60rem the open panel is the modal sheet.

## Browser support

The versions below are the first release of each engine that supports the feature without a prefix or a flag. They come from MDN's browser-compat-data (the `@mdn/browser-compat-data` package, version 8.1.6, built on 15 October 2026), which feeds the compatibility tables on MDN. WOFF2 comes from caniuse (`Fyrd/caniuse`, read on 16 October 2026). `dvh` and `text-wrap` were also checked against their MDN pages. Where two numbers are given for Chrome / Edge, the second is the first EdgeHTML version; Chromium-based Edge starts at 79. "No" means the engine has no support.

Floors that follow from the table:

- Full layout: Chrome and Edge 84, Firefox 75, Safari 14.1. The limits are `clamp()` (Firefox 75, Safari 13.1) and the `gap` property in flexbox (Chrome 84, Safari 14.1).
- Scripts (matrix filters, generator): Chrome 73, Edge 79, Firefox 63, Safari 12.1, set by `Object.fromEntries`. The Copy button needs `navigator.clipboard`, which Safari has from 13.1. Without it the button shows its failure message.
- Below those versions the site is untested. The table says which declaration or script is lost.

### Used by the site

| Feature | Used for | Chrome / Edge | Firefox | Safari | Without it |
| --- | --- | --- | --- | --- | --- |
| Custom properties, `var()` | every color, space and radius | 49 / 15 | 31 | 9.1 | No colors or spacing. No fallback. |
| `clamp()` | heading and lead sizes | 79 | 75 | 13.1 | Declaration dropped, text keeps the inherited size. |
| `min()`, `max()` | column minimums, `max-height` | 79 | 75 | 11.1 | Declaration dropped. Card grids fall back to one column; `max-height` has a `rem` value before it. |
| Grid with `repeat(auto-fit)` and `minmax()` | home, cards, legend | 57 / 16 | 52 | 10.1 | Block layout. |
| `gap` in flexbox | header, chips, footers | 84 | 63 | 14.1 | Items touch. |
| `gap` in grid | layouts | 66 / 16 | 61 | 12 | Items touch. |
| `position: sticky` | site header from 48rem, matrix tool row from 48rem, matrix detail panel from 60rem | 56 / 16 | 32 | 13 | They scroll with the page. |
| `margin-inline`, `padding-inline` | page width, buttons | 87 | 66 | 14.1 | `margin-left`, `margin-right`, `padding-left` and `padding-right` come first in the same rule. |
| `dvh` | page height, table and generator panel | 108 | 101 | 15.4 | A `vh` declaration comes first. |
| `text-wrap: balance` | headings | 114 | 121 | 17.5 | Normal wrapping. |
| `text-wrap: pretty` | lead paragraphs | 117 | no | 26 | Normal wrapping. |
| `:focus-visible` | focus ring | 86 | 85 | 15.4 | The rule is dropped and the browser draws its own ring. |
| `color-scheme` | native controls and scrollbars in dark mode | 81 | 96 | 13 | Controls stay light. |
| `prefers-color-scheme` | dark theme | 76 / 79 | 67 | 12.1 | Light theme only. |
| `prefers-reduced-motion` | motion overrides | 74 / 79 | 63 | 10.1 | Motion is not reduced. |
| `accent-color` | checkbox and radio color | 93 | 92 | 26.2 (15.4 to 26.1 partial) | Browser default color. |
| `scrollbar-color` | page scrollbars | 121 | 64 | 26.2 | Default scrollbars. |
| `overscroll-behavior` | file, comparison and unverified table scrolling | 144 (63 to 143 partial) / 18 | 150 (59 to 149 partial) | 16 (partial) | Scrolling can chain to the page. |
| `text-underline-offset`, `text-decoration-thickness` | link underlines | 87 / 87, 89 / 89 | 70 | 12.1 | Default underline. |
| `::marker` | list bullets | 86 | 68 | 11.1 (color and font size only) | Default bullets. |
| `font-variant-numeric` | tabular digits | 52 / 79 | 34 | 9.1 | Proportional digits. |
| `overflow-wrap: anywhere` | long code strings | 80 | 65 | 15.4 | Long strings can overflow. |
| WOFF2 (caniuse) | the web font | 36 / 14 | 39 | 12 | System font stack in `--font`. |
| Static WOFF2 files (Source Serif 4, Source Sans 3, IBM Plex Mono) | display, UI and data type | 36 / 14 | 39 | 12 | System stacks in `--serif`, `--font`, `--mono`. |
| `font-display` | font loading | 60 / 79 | 58 | 11.1 | Browser default loading. |
| `@keyframes`, `animation` | tile entry effect | 43 / 12 | 16 | 9 | Tiles appear without the effect. |
| `<use href="#id">` without `xlink:href` | icons from the inline sprite | 50 / 12 | 1.5 | 12.1 | Empty icon boxes. They keep their 20 by 20 size. |
| `<script type="module">` | matrix filters, keyboard and detail panel, generator | 61 / 79 | 60 | 10.1 | Filters, panel and generator do not run. The whole grid stays visible, each tile links to its entry in the open "All notes" list, and both folds stay open. |
| `Object.fromEntries` | generator form values | 73 / 79 | 63 | 12.1 | Generator does not run. |
| Optional `catch` binding | clipboard error handling | 66 / 79 | 58 | 11.1 | The script does not parse. |
| `async` functions | Copy button | 55 / 15 | 52 | 10.1 | The script does not parse. |
| `Element.closest()` | filter buttons | 41 / 15 | 35 | 6 | Filters do not run. |
| `Clipboard.writeText()` | Copy button | 66 / 79 | 63 | 13.1 | The button shows "Copy failed, select the text instead". |
| `URL.createObjectURL()` and `<a download>` | Download button | 19 / 12 and 14 / 18 | 19 and 20 | 6 and 10.1 | No download. |
| `FormData.entries()` | generator form values | 50 / 18 | 44 | 11.1 | Generator does not run. |
| `Element.append()` | generator output | 54 / 17 | 49 | 10 | Generator does not run. |

Partial support, from the same MDN data (version 8.1.6, `css.properties.accent-color` and `css.properties.overscroll-behavior`):

- `accent-color`: Safari 15.4 to 26.1 (and Safari on iOS) support it partially, because Safari does not keep the minimum contrast of the control for legibility (WebKit bug 244233). It is complete from Safari 26.2. MDN also marks Chrome for Android partial for the same kind of contrast issue (Chromium bug 343503163); Chrome desktop, Edge and Firefox have no partial flag.
- `overscroll-behavior`: partial in Chrome from 63 to 143 and in Firefox from 59 to 149, because the property has no effect on a scroll container that has no scrollable overflow. Complete from Chrome 144 and Firefox 150. Safari has it from 16 and MDN still marks it partial for the same reason, with no complete version yet. MDN gives Edge one number, 18, with no partial flag, so the row keeps it. The file, comparison and unverified tables do have overflow when they scroll, so the partial case does not change the behavior the site relies on. That last sentence is our reading, not an MDN statement.

### Not used, and kept out

The stylesheet and scripts use none of the features below. `tests/design.test.mjs` fails if the stylesheet starts to use one of the CSS ones (`inset` has its own fallback check), or if a script uses lookbehind, `??`, `?.` or `replaceChildren()`. Adding one means adding a fallback or an `@supports` block and a row above.

| Feature | Chrome / Edge | Firefox | Safari | Note |
| --- | --- | --- | --- | --- |
| CSS nesting | 120 (112 without nested type selectors) | 117 | 17.2 (16.5 partial) | |
| `@layer` | 99 | 97 | 15.4 | |
| `:has()` | 105 | 121 | 15.4 | |
| `color-mix()` | 111 | 113 | 16.2 | |
| `oklch()` | 111 | 113 | 15.4 | |
| `light-dark()` | 123 | 120 | 17.5 | |
| Container queries | 105 | 110 | 16 | |
| `aspect-ratio` | 88 | 89 | 15 | |
| `:is()`, `:where()` | 88 | 78 | 14 | |
| `@property` | 85 | 128 | 16.4 | |
| View transitions (`document.startViewTransition`) | 111 | 144 | 18 | |
| Subgrid | 117 | 71 | 16 | |
| `svh`, `lvh` | 108 | 101 | 15.4 | `dvh` is used, with a `vh` fallback. |
| `@scope` | 118 | 146 | 26.4 | |
| `inset` | 87 | 66 | 14.1 | Replaced by `top`, `right`, `bottom` and `left` on the stretched card link. |
| Regex lookbehind | 62 / 79 | 78 | 16.4 | Removed from `yamlQuote`. A SyntaxError stops the whole module. |
| `??` | 80 | 72 | 13.1 | Removed from `generator-core.js`. |
| `?.` | 80 | 74 | 13.1 | |
| `Element.replaceChildren()` | 86 | 78 | 14 | Replaced by `textContent = ''`. |

### Icons without the stylesheet

An inline SVG with no `width` and `height` takes the width of its container, or 300 by 150 pixels, so a stale or blocked `style.css` once left icons as large as the page. Every inline SVG now has both attributes (`20` for icons, `32` for the mark, `0` for the sprite), and `style.css` sizes `.ic`, `.mark` and `.sprite` itself. `tests/design.test.mjs` checks both.

### What was tested

Run on 16 October 2026 with Playwright 1.63.0, kept outside the repository, against a build served by `createServer` from `scripts/preview.mjs`:

| Engine | Version |
| --- | --- |
| Chromium | 153.0.8010.12 |
| Firefox | 155.0 |
| WebKit | 26.6 (Playwright's Linux build, WPE port; same engine family as Safari, not Safari itself) |

Pages: `/`, `/matrix/`, `/generator/`, `/digest/` and `/digest/2026-W42/`, each at 1280 and 390 pixels wide. For every run the script checks that the page is styled, that the font loaded, that no SVG is larger than 64 pixels, that there are no console errors, page errors, failed requests or CSP violations, and that there is no horizontal scroll. The matrix has no inner scroll box: the grid fits the page from 320 to 1440 pixels. On the home page it counts the mini-matrix tiles, one per cell and one column per tool, both when the document is parsed and after load. On `/matrix/` it clicks a status filter, and on `/generator/` it types into the form and reads the output. That run dates from 16 October, when the status chips were always on screen. Since #40 they open under the Status toggle, so a new run has to click Status before it clicks a chip.

Three more runs per engine, each over the same five pages and two widths: JavaScript off (every mini-matrix tile, every matrix tile and every entry of the "All notes" list visible, both folds open, filter bar hidden), `style.css` blocked, and `style.css` replaced by the pre-redesign stylesheet from `da63abf`, which stands for an old cached copy. In the last two, no SVG may exceed 64 pixels.

Not tested: Safari itself, Edge, mobile browsers, and any version older than the three above. The floors in this section come from the table, not from running those versions. The screenshots are in `site-vibe-coding-screenshots/live-rulefiles/` as `compat-<engine>-<page>-<width>.png`.

## Checks

- `tests/design.test.mjs` computes WCAG contrast for every color pair in both themes, and checks that no page loads from another origin, that the CSP stays strict, and that the landmarks, headings, labels and icons are in order. It also checks that every animation, transition and hover movement has an override inside `@media (prefers-reduced-motion: reduce)`, and that each Source link in the matrix's "All notes" list has a unique accessible name (`Source — AGENTS.md × Cursor`) and a target of at least 24 by 24 pixels. The reduced-motion check also covers the individual `translate`, `scale` and `rotate` properties, which `transform: none` does not reset.
- The same file also checks that every inline SVG has numeric `width` and `height` attributes, that newer CSS values have an older one before them, that no very recent CSS feature is used, that the browser scripts avoid syntax and APIs from the table above, that each Source link on the digest cards has a unique accessible name that starts with its visible text (`Source: Cursor changelog — Origin App Marketplace`) and a target of at least 24 by 24 pixels, and that the usual ways of hiding the mini-matrix (opacity, scale, clipping, zero size, `display`, `visibility`) are caught, whatever the spelling.
- `tests/matrix-filter.test.mjs` covers the filter logic and the matrix markup. `tests/matrix-ui.test.mjs` checks the copy, the two folds, that the "All N notes" count follows the data, that every cell keeps its status, note, quote, source, date, version and answer page, and that the list is never filtered.
- `tests/build.test.mjs` reads the visible text of every built page and fails on a literal `**` outside `<code>`: notes and quotes go through `inlineHtml`, which escapes first and only then turns `` `x` `` into `<code>` and `**x**` into `<strong>`.
- `tests/browser/matrix.test.mjs` (`npm run test:browser` after a build, CI job `browser`) runs Chromium through Playwright: no horizontal scroll or inner scroll box from 320 to 1920 pixels, statuses on the first screen (at least 8 at 390×844 and 1024×768, 16 at 1280×800, 32 at 1440×900, 56 at 1920×1080), the search box, Tools and Status on the first screen and above the grid from 1024 to 1920 pixels, 44-pixel tiles on a phone, arrow keys, Enter, Esc and `#d-<tool>--<file>` for all cells, the phone sheet at most 60% of the screen for the longest note, the open phone sheet as a modal dialog (`role="dialog"`, `aria-modal="true"`, focus inside, Tab and Shift+Tab kept inside, the scrim and Esc close it and focus goes back to the tile), the side panel left as a plain region on a desktop and without scripts, a click on a first-screen tile at 1440×900 that leaves `scrollY` at 0 with the tile and the panel in view, the quote without a side bar and at 4.5:1 in both themes, the search box, the Tools and Status toggles and their chips reachable by click from 320 to 1920 pixels in both themes, with the panel empty or open, at the top and after a scroll, each one filtering the tiles, the search box focused from far down the page left below the sticky header, the search box still below the header after a status chip clicked at the top of the window (320, 390 and 1440 pixels; the page does not scroll when the bar is already in view), the Tab loop of the phone sheet (Tab from the last control to the first, Shift+Tab back), focus moved into the panel when it turns modal (opened from its address on a phone, or a window narrowed below 60rem), the open panel named by its title through `aria-labelledby`, the tool names of the header row at 3:1 from body text and 4.5:1 on the page in both themes (they have no underline on a phone), the names of Tools and Status with and without an active chip, and after Reset filters, and status contrast in both themes. `PORT` sets the port of the local server, and `BROWSER_BASE_URL` points the same checks at a deployed copy such as a branch preview.
- `tests/og.test.mjs` checks the share image.

For a deeper pass, run axe-core against the built site in a browser, in light and dark, at 1280 and 390 pixels wide. Keep axe-core out of the repo dependencies. Playwright is a dev dependency for `tests/browser` only. The multi-browser run described under Browser support lives outside the repository.

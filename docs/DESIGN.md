# Design notes

How the site looks and why, so the next change does not have to guess.

## Direction

The site is a reference, so it reads like one: dates, source links and status badges first, decoration last. The one picture it allows itself is a small grid on the home page and in the share image. It is drawn from the real matrix data, one tile per cell, colored by status.

The type is Hanken Grotesk for everything except code, which uses the system monospace stack. Cards use one device, a 1px border. There are no shadows and no gradients. The palette is neutral grey with one indigo accent, and the header stays at the top of the window from 48rem wide.

## Tokens

All colors, spacing steps and radii are CSS custom properties at the top of `src/static/style.css`. The dark theme redefines every color token inside `@media (prefers-color-scheme: dark)`. Colors are plain hex values so the contrast test can read them.

Status colors come in pairs (`--reads-fg` on `--reads-bg`, and so on). A status never relies on color alone: every badge has an icon and the status text.

## Font

`src/static/fonts/hanken-grotesk.woff2` is a Latin subset of Hanken Grotesk (variable weight), under the SIL Open Font License 1.1. The license text sits next to it. The CSP allows fonts from the site itself (`font-src 'self'`) and nothing else.

The subset keeps U+0020-007E, U+00A0-00FF, the dashes and quotes U+2013, U+2014, U+2018, U+2019, U+201C and U+201D, the bullet U+2022, the ellipsis U+2026 and the arrow U+2192. It also keeps name IDs 0-6, 13 and 14 (copyright, license description and license URL) and 256-267 (variation names). To rebuild it from the `HankenGrotesk[wght].ttf` file in google/fonts (`ofl/hankengrotesk`), with fonttools and brotli installed, run the command below. Keep the quotes, because the brackets are shell wildcards. The output is byte for byte the file in the repository.

```
pyftsubset "HankenGrotesk[wght].ttf" \
  --unicodes=U+0020-007E,U+00A0-00FF,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026,U+2192 \
  --layout-features=kern,liga,ss01 \
  --name-IDs=0,1,2,3,4,5,6,13,14,256,257,258,259,260,261,262,263,264,265,266,267 \
  --flavor=woff2 \
  --output-file=hanken-grotesk.woff2
```

## The mark and the name

The mark is a page with one highlighted line. It has no letters, so it does not change when the project is renamed. The header, the footer, `favicon.svg` and the share image all draw it. The site name always comes from `site.config.json`. The home headline lives in `HERO_TITLE` in `scripts/lib/render.mjs`, and the share image reuses it.

## Share image

`scripts/lib/ogimage.mjs` draws `og.png` with `node:zlib` and a small scanline rasteriser. Text comes from glyph outlines in `scripts/lib/og-font.json`, converted from the same font at weight 720. The name, the headline and the grid are arguments, so a rename needs no change in this file.

## Matrix filters

`src/js/matrix-filter.js` holds the logic and has no DOM access. `src/static/matrix.js` wires it to the page. An empty selection means no filter. Without JavaScript the filter bar stays hidden and the whole table shows. Nothing is stored and nothing is fetched.

The search reads the file path, its description, the tool name and the note of each cell, and keeps the cells that hold every word typed. With JavaScript the notes are folded away so the grid reads at a glance; the Show notes toggle brings them back, and they also show while a search is typed. Below 48rem the table becomes one card per file, with the tool name on each cell, so nothing scrolls sideways. The legend sits above the table in a `details` element. All of it is CSS and the same two scripts, so the page needs nothing new from the CSP.

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
| `position: sticky` | site header from 48rem, matrix header row and first column | 56 / 16 | 32 | 13 | They scroll with the page or the table. |
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
| `overscroll-behavior` | matrix table scrolling | 144 (63 to 143 partial) / 18 | 150 (59 to 149 partial) | 16 (partial) | Scrolling can chain to the page. |
| `text-underline-offset`, `text-decoration-thickness` | link underlines | 87 / 87, 89 / 89 | 70 | 12.1 | Default underline. |
| `::marker` | list bullets | 86 | 68 | 11.1 (color and font size only) | Default bullets. |
| `content` with alternative text | the dash in empty matrix cells | 77 / 79 | 128 | 17.4 | A plain `content: "–"` comes first, so the dash is read out. |
| `font-variant-numeric` | tabular digits | 52 / 79 | 34 | 9.1 | Proportional digits. |
| `overflow-wrap: anywhere` | long code strings | 80 | 65 | 15.4 | Long strings can overflow. |
| WOFF2 (caniuse) | the web font | 36 / 14 | 39 | 12 | System font stack in `--font`. |
| Variable fonts (`font-variation-settings`) | weights 100 to 900 from one file | 62 / 17 | 62 | 11 | System font stack. |
| `font-display` | font loading | 60 / 79 | 58 | 11.1 | Browser default loading. |
| `@keyframes`, `animation` | tile entry effect | 43 / 12 | 16 | 9 | Tiles appear without the effect. |
| `<use href="#id">` without `xlink:href` | icons from the inline sprite | 50 / 12 | 1.5 | 12.1 | Empty icon boxes. They keep their 20 by 20 size. |
| `<script type="module">` | matrix filters, generator | 61 / 79 | 60 | 10.1 | Filters and generator do not run. The whole table stays visible. |
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
- `overscroll-behavior`: partial in Chrome from 63 to 143 and in Firefox from 59 to 149, because the property has no effect on a scroll container that has no scrollable overflow. Complete from Chrome 144 and Firefox 150. Safari has it from 16 and MDN still marks it partial for the same reason, with no complete version yet. MDN gives Edge one number, 18, with no partial flag, so the row keeps it. The matrix table does have overflow when it scrolls, so the partial case does not change the behavior the site relies on. That last sentence is our reading, not an MDN statement.

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

Pages: `/`, `/matrix/`, `/generator/`, `/digest/` and `/digest/2026-W42/`, each at 1280 and 390 pixels wide. For every run the script checks that the page is styled, that the font loaded, that no SVG is larger than 64 pixels, that there are no console errors, page errors, failed requests or CSP violations, and that there is no horizontal scroll (the matrix table scrolls inside its own box). On the home page it counts the 36 mini-matrix tiles, in four columns, both when the document is parsed and after load. On `/matrix/` it clicks a status filter, and on `/generator/` it types into the form and reads the output.

Three more runs per engine, each over the same five pages and two widths: JavaScript off (all 36 tiles and all 36 matrix cells visible, filter bar hidden), `style.css` blocked, and `style.css` replaced by the pre-redesign stylesheet from `da63abf`, which stands for an old cached copy. In the last two, no SVG may exceed 64 pixels.

Not tested: Safari itself, Edge, mobile browsers, and any version older than the three above. The floors in this section come from the table, not from running those versions. The screenshots are in `site-vibe-coding-screenshots/live-rulefiles/` as `compat-<engine>-<page>-<width>.png`.

## Checks

- `tests/design.test.mjs` computes WCAG contrast for every color pair in both themes, and checks that no page loads from another origin, that the CSP stays strict, and that the landmarks, headings, labels and icons are in order. It also checks that every animation, transition and hover movement has an override inside `@media (prefers-reduced-motion: reduce)`, and that each Source link in the matrix has a unique accessible name (`Source — AGENTS.md × Cursor`) and a target of at least 24 by 24 pixels. The reduced-motion check also covers the individual `translate`, `scale` and `rotate` properties, which `transform: none` does not reset.
- The same file also checks that every inline SVG has numeric `width` and `height` attributes, that newer CSS values have an older one before them, that no very recent CSS feature is used, that the browser scripts avoid syntax and APIs from the table above, that each Source link on the digest cards has a unique accessible name that starts with its visible text (`Source: Cursor changelog — Origin App Marketplace`) and a target of at least 24 by 24 pixels, and that the usual ways of hiding the mini-matrix (opacity, scale, clipping, zero size, `display`, `visibility`) are caught, whatever the spelling.
- `tests/matrix-filter.test.mjs` covers the filter logic and the matrix markup.
- `tests/og.test.mjs` checks the share image.

For a deeper pass, run axe-core against the built site in a browser, in light and dark, at 1280 and 390 pixels wide. Keep axe-core and Playwright out of the repo dependencies. The multi-browser run described under Browser support lives outside the repository.

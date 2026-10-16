# Design notes

How the site looks and why, so the next change does not have to guess.

## Direction

The site is a reference, so it reads like one: dates, source links and status badges first, decoration last. The one picture it allows itself is a small grid on the home page and in the share image. It is drawn from the real matrix data, one tile per cell, colored by status.

The type is Hanken Grotesk for everything except code, which uses the system monospace stack. Cards use one device, a 1px border. There are no shadows and no gradients.

## Tokens

All colors, spacing steps and radii are CSS custom properties at the top of `src/static/style.css`. The dark theme redefines every color token inside `@media (prefers-color-scheme: dark)`. Colors are plain hex values so the contrast test can read them.

Status colors come in pairs (`--reads-fg` on `--reads-bg`, and so on). A status never relies on color alone: every badge has an icon and the status text.

## Font

`src/static/fonts/hanken-grotesk.woff2` is a Latin subset of Hanken Grotesk (variable weight), under the SIL Open Font License 1.1. The license text sits next to it. The CSP allows fonts from the site itself (`font-src 'self'`) and nothing else.

The subset keeps U+0020-007E, U+00A0-00FF, the dashes and quotes U+2013, U+2014, U+2018, U+2019, U+201C and U+201D, the bullet U+2022, the ellipsis U+2026 and the arrow U+2192. It also keeps name IDs 0-6, 13 and 14 (copyright, license description and license URL) and 256-267 (variation names). To rebuild it from the `HankenGrotesk-VariableFont_wght.ttf` file in google/fonts, with fonttools and brotli installed:

```
pyftsubset HankenGrotesk-VariableFont_wght.ttf \
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

## Checks

- `tests/design.test.mjs` computes WCAG contrast for every color pair in both themes, and checks that no page loads from another origin, that the CSP stays strict, and that the landmarks, headings, labels and icons are in order. It also checks that every animation, transition and hover movement has an override inside `@media (prefers-reduced-motion: reduce)`, and that each Source link in the matrix has a unique accessible name (`Source — AGENTS.md × Cursor`) and a target of at least 24 by 24 pixels.
- `tests/matrix-filter.test.mjs` covers the filter logic and the matrix markup.
- `tests/og.test.mjs` checks the share image.

For a deeper pass, run axe-core against the built site in a browser, in light and dark, at 1280 and 390 pixels wide. Keep axe-core out of the repo dependencies.

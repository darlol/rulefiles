# License of the data and the text

Copyright (c) 2026 Rulefiles contributors.

The data and the text of this project are licensed under the Creative Commons Attribution 4.0 International license (CC BY 4.0, SPDX identifier `CC-BY-4.0`).

- License summary: https://creativecommons.org/licenses/by/4.0/
- Legal code, the only binding text: https://creativecommons.org/licenses/by/4.0/legalcode
- A copy of the legal code is in [docs/licenses/CC-BY-4.0.txt](docs/licenses/CC-BY-4.0.txt). It is the file https://creativecommons.org/licenses/by/4.0/legalcode.txt, unchanged, read on 2026-10-16, SHA-256 `9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411`.

The code is under the MIT license, see [LICENSE](LICENSE).

## What this license covers

| Covered by CC BY 4.0 | Covered by MIT |
| --- | --- |
| `data/matrix.json`, `data/digest/*.json` and the drafts in `data/drafts/` | `scripts/`, `src/`, `tests/`, `.github/` |
| `/data/matrix.json` and `/data/digests.json` on the built site | `package.json`, `package-lock.json`, `site.config.json` |
| The text of `content/` and of `docs/*.md` | `README.md` |

Every published data file carries `license`, `licenseUrl` and `attribution` fields. The build and `npm run validate` refuse a data file without them.

The other files in `data/` (`allowed-source-hosts.json`, `watch-sources.json`, `watch-state.json`) are working files of the watch script. They are covered by CC BY 4.0 as well, and carry no license field.

## What this license does not cover

- The excerpts quoted from official pages. Digest items and matrix notes quote short passages from the pages of Cursor, Anthropic, OpenAI and GitHub. Those words belong to their authors, and this project cannot license them. Each excerpt names its source and links to it.
- Product names and trademarks. CC BY 4.0 grants no trademark rights (Section 2(b)(2)), and the name "Rulefiles" is not licensed for use as the name of another project.
- The font. `src/static/fonts/` holds Hanken Grotesk under the SIL Open Font License 1.1, see `src/static/fonts/OFL.txt`.
- The license text itself in `docs/licenses/`, which belongs to Creative Commons and to the MIT template.

## Summary of CC BY 4.0

This is a reading aid, taken from the legal code. If it differs from the legal code, the legal code applies.

- Section 2(a)(1): the license is worldwide, royalty-free, non-sublicensable, non-exclusive and irrevocable. Section 6(a): it applies for the term of the rights licensed, and ends automatically for a reuser who does not comply. Section 6(b): the rights come back if the breach is cured within 30 days of discovery. Section 6(c): the project may stop distributing the data at any time, and that does not end the license for people who already have it.
- Anyone may reproduce and share the data, in whole or in part, and produce, reproduce and share adapted material, for any purpose, including commercial purposes.
- Section 4: where database rights apply, the license lets reusers extract, reuse and share all or a substantial part of the database.
- Section 3(a)(1): a reuser who shares the data must keep, when it is supplied with the data, the creator's identification (a pseudonym is allowed if designated), a copyright notice, a notice that refers to the license, a notice that refers to the disclaimer of warranties, and a link to the data where reasonably practicable. They must also say whether they modified it, and give the license text or its link.
- Section 3(a)(2): they may do this in any reasonable manner for the medium, for example with a link.
- Section 3(a)(3): if the licensor asks, the reuser must remove the information required by Section 3(a)(1)(A) as far as reasonably practicable.
- Section 2(a)(5)(b): a reuser may not add terms or technical measures that restrict what other recipients may do with the data.
- Section 2(a)(6): the license gives no permission to suggest that the project endorses the reuser.
- Section 2(a)(2): where an exception or limitation to copyright applies, such as a short quotation, the license does not apply and no credit is owed.
- Section 5: the data is provided as is, with no warranty.

## Suggested credit

> Rulefiles data by Rulefiles contributors, https://rulefiles.dev/, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Provided as is, without warranty. Quoted excerpts belong to their authors.

The domain in this text is the `baseUrl` of `site.config.json`. The About page of the built site shows the domain set at build time.

## Reporting a problem

If a source asks for an excerpt to be removed, or a reuser misuses the data, write to the address on the Legal notice page of the site. The license does not stop the project from taking an excerpt down.

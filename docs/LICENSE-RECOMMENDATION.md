# License recommendation

Prepared on 2026-10-16. This is a working note, not legal advice. The recommendation was accepted on 2026-10-16 and is now in force: `LICENSE` (MIT), `LICENSE-DATA.md` (CC BY 4.0), the `license` fields in the data files, the About page and the JSON-LD all state it. The copyright holder named in `LICENSE` is "Rulefiles contributors", which the owner still has to confirm as the name to use. A lawyer should confirm the points marked "to confirm".

## Recommendation

| What | License | Why |
| --- | --- | --- |
| Code: `scripts/`, `src/`, `tests/`, `.github/`, `package.json` | MIT | Short, widely understood, allows any reuse. The only duty is to keep the copyright and permission notice. |
| Data and text: `data/` (`matrix.json`, the digests), the published `matrix.json` and `digests.json`, `content/`, `docs/` | CC BY 4.0 | Allows any reuse, including commercial use and use by AI tools, on one condition: credit the project and link the license. It also covers database rights (Section 4 of the legal code). |
| Quoted excerpts of official pages | Not licensed by this project | The text belongs to the vendors. See "What the data license cannot cover". |

The texts are in `docs/licenses/`. `MIT.txt` is the standard MIT text with `<year>` and `<copyright holder>` left blank. `CC-BY-4.0.txt` is the Creative Commons legal code, copied unchanged from https://creativecommons.org/licenses/by/4.0/legalcode.txt on 2026-10-16 (SHA-256 `9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411`). Neither file is named `LICENSE`. The root `LICENSE` file is the MIT text with the year and holder filled in.

## What each choice means

MIT, for the code:

- Anyone can use, copy, modify, sell and relicense the code, as long as the copyright and permission notice stay in all copies.
- No warranty, and no patent grant. The project has no patents, so this is not a practical gap.
- It is compatible with almost everything downstream, including closed-source use.

CC BY 4.0, for the data and the text (points taken from the legal code in `docs/licenses/CC-BY-4.0.txt`):

- Section 2(a)(1): worldwide, royalty-free, non-exclusive and irrevocable. Once published under it, the data cannot be taken back for people who already have it.
- Section 3(a): anyone who shares the data must keep the creator's identification (a pseudonym is allowed, Section 3(a)(1)(A)(i)), a copyright notice, a notice that refers to the license, the license link, and an indication of any change they made. Section 3(a)(2) lets them do this in any reasonable way for the medium, for example with a link.
- Section 2(a)(6): no endorsement. Reusers may not suggest the project backs them.
- Section 2(b)(2): patent and trademark rights are not licensed. The name "Rulefiles" stays out of the grant.
- Section 2(a)(2): where a legal exception or limitation applies to a reuse, the license does not apply to it and the reuser owes no attribution. That is the case for the short-quotation exception.
- Section 4: database rights are covered, so reuse of the data files as a database is covered too.
- Section 2(a)(5)(b): no additional terms and no technical measure that restricts what a recipient may do with the data.

Whether the matrix and the digests are protected by copyright or by the database right at all is to confirm. Facts such as "this tool reads this file" are not protected as such. The selection, the structure and the project's own notes may be. A license costs nothing if the protection is thin, and it gives reusers a clear rule.

## Attribution wording

Text a reuser can copy, published on the About page:

> Rulefiles data by Rulefiles contributors, https://<domain>/, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Quoted excerpts belong to their authors.

In the JSON-LD Dataset block, `license` takes a URL: `https://creativecommons.org/licenses/by/4.0/`. The SPDX identifiers are `MIT` and `CC-BY-4.0`.

## What the data license cannot cover

The digest items and some matrix notes quote wording from the vendors' pages. Those words belong to Cursor, Anthropic, OpenAI and GitHub, and the project cannot license them. State it next to the license, as in the attribution text above.

Quoting in the first place:

- French law allows "analyses et courtes citations justifiées par le caractère critique, polémique, pédagogique, scientifique ou d'information de l'oeuvre à laquelle elles sont incorporées", with a clear indication of the author's name and the source (Code de la propriété intellectuelle, article L122-5, 3°, a). Read on 2026-10-16 at https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000006278917.
- The project's practice fits that frame: each excerpt is one line from a dated entry, with the vendor named and a link to the page. It does not fit if the excerpts grow, or if the digest reproduces a whole changelog.
- Other countries have their own rules. Only French law was read. To confirm.
- The vendors' own terms are a separate question. See `docs/SOURCE-TERMS.md`.

Vendor trademarks: the product names are used to say which tool a line is about. The licenses above grant no right to them, and the About page already says the project is not affiliated.

## Possible conflicts with the sources' terms

- No license that would stop a short quote with a link was found on the vendors' changelog text. Cursor and OpenAI state no license for their changelog feeds. The `anthropics/claude-code` repository has no license field on GitHub, and its `LICENSE.md` says all rights reserved and use subject to Anthropic's Commercial Terms. `openai/codex` is Apache-2.0. The GitHub documentation repository is CC-BY-4.0 for its content, which does not necessarily extend to the GitHub blog changelog. Details and dates are in `docs/SOURCE-TERMS.md`.
- The risk is in the volume of what is copied. A data license on a file full of full-length changelog text would claim more than the project owns. Keeping excerpts short and the project's own fields (dates, statuses, notes) separate from them avoids that.
- If a vendor asks for a removal, the license does not stop that. Section 3(a)(3) even lets a licensor ask reusers to drop attribution details, and the project should keep a way to take an excerpt down quickly (the correction channel on the About page).

## Alternatives

| Option | Fits when | Cost |
| --- | --- | --- |
| Apache-2.0 for the code | Contributors may bring patents, or the project wants an explicit patent grant and a NOTICE mechanism | Longer text, and a duty to carry a NOTICE file and mark changes |
| CC0 for the data | The owner wants no attribution at all, so AI tools and scrapers need no credit | No credit for the project, and nothing obliges reusers to say where the data came from |
| ODbL for the data | A database-specific license, with share-alike on derived databases | The share-alike condition discourages reuse by others. Heavier for a small dataset |
| CC BY-SA 4.0 for the data | The owner wants derived datasets to stay open | Share-alike can put off reuse in closed products and in tools that cannot meet the condition |
| All rights reserved | The owner wants to decide each reuse | Contradicts the aim of being cited and reused, and `llms.txt` invites crawlers |

Contributions: with MIT and CC BY 4.0, an outside contribution is normally taken under the same license as the file it changes. A short line in a future `CONTRIBUTING.md` can say so. To confirm.

## What was done to activate it

1. `docs/licenses/MIT.txt` became `LICENSE`, with the year 2026 and the holder "Rulefiles contributors".
2. `LICENSE-DATA.md` states the scope of CC BY 4.0, a reading aid taken from the legal code, and the suggested credit. It points to `docs/licenses/CC-BY-4.0.txt`.
3. `package.json` has `"license": "MIT"`.
4. The About page names both licenses and gives the suggested credit, the Dataset and Article JSON-LD carry `license`, and the site footer states both licenses.
5. `matrix.json` and every digest carry `license`, `licenseUrl` and `attribution`. The validators and the watch script enforce them.

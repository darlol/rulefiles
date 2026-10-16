# Rulefiles

A static website with two parts. The first is a weekly digest of dated, sourced changes in Cursor, Claude Code, Codex and GitHub Copilot. The second is a matrix of which agent reads which instruction file (`AGENTS.md`, `CLAUDE.md`, Cursor rules, Copilot instructions), plus a generator for those files that runs in the browser.

The site has no runtime dependencies and is built by plain Node scripts. The only dev dependency is `yaml`, which the tests use. Bots update the site by editing JSON files, never code. "Rulefiles" is the chosen name, set in `site.config.json`. The domain `rulefiles.dev` in that file is provisional: it is not bought. The first candidate name, "Agent Diffs", was dropped on 2026-10-16.

Status: MVP, not published. Nothing here sends email, and no domain or hosting account has been bought or created.

## Quick start

You need Node 20 or later. There is nothing to install.

```
npm run validate      # check data files against the schema and the official-host list
npm run build         # write the site to dist/
npm test              # run the test suite
npm run check-links   # check internal links in dist/
npm run preview       # serve dist/ at http://127.0.0.1:4173/ (local only)
npm run ci            # validate, build, test and check links in one go
```

## Layout

```
site.config.json            name, base URL, newsletter form settings
data/matrix.json            instruction file matrix, one cell per tool and file
data/digest/YYYY-Www.json   one published digest per ISO week
data/drafts/                drafts written by the watch script (not built)
data/watch-sources.json     official feeds the watch script reads
data/watch-state.json       entries the watch script already listed
data/allowed-source-hosts.json  hosts accepted as official sources
content/*.md                prose for About, Sponsors, Privacy and the legal notice
src/js/generator-core.js    generator logic, shared by the browser and the tests
src/js/matrix-filter.js     matrix filter logic, shared by the browser and the tests
src/static/                 CSS, the generator and matrix scripts, the font
scripts/                    build, validation, link check, watch, preview
tests/                      node:test suites and fixtures
docs/DESIGN.md              design tokens, the font, the mark and how the checks work
docs/DATA.md                data schema and the update workflow for bots
docs/OPERATIONS.md          hosting, newsletter, CI and launch checklist
docs/LAUNCH-BLOCKERS.md     decisions the owner has to make before the site goes public
docs/NEWSLETTER.md          newsletter tools compared on vendor pages, with a recommendation
docs/LICENSE-RECOMMENDATION.md  recommended licenses for the code and the data, not active
docs/licenses/              license texts, kept inactive until the owner decides
docs/SOURCE-TERMS.md        what the project takes from each source and the clauses that matter
docs/BRAND.md               the name, the fallback and the names dropped
docs/BRAND-CLEARANCE.md     trademark, collision, domain, handle and fee checks for the name
```

## How a bot keeps it current

1. The weekly workflow runs `npm run watch`. It reads the official feeds, skips anything already published or already listed, and writes `data/drafts/YYYY-Www.draft.json`. It opens a pull request. It never publishes.
2. A reviewer, human or bot, opens the draft, keeps the items worth publishing, checks each against its source link, and moves the file to `data/digest/YYYY-Www.json` with `"status": "published"`.
3. For the matrix, a person or bot re-reads the cited official pages and updates `verifiedOn`. The watch script does not fetch documentation pages. `npm run validate` warns about cells older than `staleAfterDays`.
4. `npm run validate` and `npm test` must pass before merge. Validation fails on a source URL that is not https or not on an official host, a missing matrix cell, a bad date, or an item dated outside its week.

The full schema is in [docs/DATA.md](docs/DATA.md).

## The watch script

`scripts/watch.mjs` lists changes. It does not write summaries: each draft item holds the title, date and link from the source, and the first line of the release notes in the source's own words.

- It identifies itself with a User-Agent that starts with `RulefilesWatch/0.1`.
- It reads `robots.txt` for every host before any request, including hosts reached by redirect. It follows up to five redirects when fetching `robots.txt`. It treats a 404, 410 or 403 as no restrictions, and stays out when `robots.txt` answers 429 or 5xx, cannot be followed, or disallows the path. A group in `robots.txt` applies when its user-agent value is `RulefilesWatch` or a leading part of it.
- It waits 1.5 seconds between network requests, caches responses on disk, sends conditional requests, and does not hit the network again within six hours.
- For GitHub it calls the REST API. It does not read `releases.atom`, because `github.com/robots.txt` disallows `*.atom`.
- `npm run watch:offline` runs against the fixtures in `tests/fixtures` with no network.

Sources and what they return:

| Tool | Source | Type |
|---|---|---|
| Cursor | https://cursor.com/changelog/rss.xml | RSS |
| Claude Code | https://api.github.com/repos/anthropics/claude-code/releases | GitHub API |
| Codex | https://developers.openai.com/codex/changelog/rss.xml | RSS |
| GitHub Copilot | https://github.blog/changelog/label/copilot/feed/ | RSS |

Release dates use the UTC date of the publication timestamp.

## Privacy and security

- No cookies, no analytics, no third-party scripts, fonts or images. A test fails if any appears.
- Every page carries a Content-Security-Policy meta tag. `dist/_headers` repeats it for hosts that read that file.
- The generator runs in the browser and sends nothing.
- The newsletter form is off until `newsletter.formAction` in `site.config.json` (or the `NEWSLETTER_FORM_ACTION` environment variable) holds an https URL. Then it posts only the email address typed by the visitor, and the CSP allows that one origin.
- There are no secrets in the repository. The watch script reads an optional `GITHUB_TOKEN` from the environment, only for `api.github.com`.

## Environment variables

| Variable | Effect |
|---|---|
| `SITE_URL` | Base URL used in canonical links, sitemap, feed and llms.txt |
| `NEWSLETTER_FORM_ACTION` | https URL the signup form posts to |
| `BUILD_DATE` | Fixed date for the build, used by tests and freshness checks |
| `WATCH_USER_AGENT` | Replaces the watch script's User-Agent |
| `GITHUB_TOKEN` | Raises the GitHub API rate limit for the watch script |

## Limits

- Cells marked "unverified" in the matrix mean the cited official page does not mention the file. They are not a claim that the tool ignores it. Cells marked "migration only" mean the page mentions the file only as input to a migration command such as `/init`.
- The domain in `site.config.json` is a placeholder. Nothing is registered.
- Digest items are a selection, not every release.

# Data schema

All content comes from JSON files in `data/`. `npm run validate` checks every rule below, and the build refuses to run when data is invalid.

## Official hosts

`data/allowed-source-hosts.json` lists the hosts accepted as official sources. A `sourceUrl` must use https and a host from that list, or a subdomain of one. To add a host, edit the list in a pull request and say why it counts as official.

## matrix.json

```
{
  "schemaVersion": 1,
  "license": "CC-BY-4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/", "attribution": "Rulefiles contributors",
  "lastReviewed": "2026-10-15",
  "tools": [ { "id": "cursor", "name": "Cursor", "docsUrl": "https://...", "scope": "optional note" } ],
  "files": [ { "id": "agents-md", "path": "AGENTS.md", "description": "..." } ],
  "cells":  [ { "tool": "cursor", "file": "agents-md", "status": "reads", "note": "...",
                "sourceUrl": "https://...", "verifiedOn": "2026-10-15", "version": "optional" } ]
}
```

Rules:

- `license`, `licenseUrl` and `attribution` are required and the first two have one allowed value each, set in `scripts/lib/license.mjs`. The same three fields are required in every digest, draft included, and the watch script writes them.
- There is exactly one cell for every tool and file pair.
- `status` is one of `reads`, `reads-conditionally`, `configurable`, `migration-only`, `not-read`, `unverified`.
- `note` is required, at most 400 characters, and states only what the cited page says.
- Use `migration-only` when the page mentions the file only as input to a migration command, such as `/init` copying Cursor or Copilot rules into CLAUDE.md. The note says so and says that the page does not state that the tool loads the file.
- Use `unverified` when the cited page does not confirm the cell. The note then reads "Not mentioned on the cited page when checked." and `verifiedOn` is the date of the check.
- `verifiedOn` is the day a person or bot read `sourceUrl`. It cannot be in the future or later than `lastReviewed`.
- `version` is optional and names the first version that behaves as described, when the source says so.
- Cells older than `staleAfterDays` in `site.config.json` (30) are flagged "check again" on the page and warned about by `npm run validate`.

## digest/YYYY-Www.json

```
{
  "schemaVersion": 1,
  "license": "CC-BY-4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/", "attribution": "Rulefiles contributors",
  "week": "2026-W41", "start": "2026-10-05", "end": "2026-10-11",
  "status": "published",
  "verifiedOn": "2026-10-15",
  "title": "...", "summary": "...",
  "items": [ {
    "id": "claude-code-2026-10-07-v2.1.293",
    "date": "2026-10-07", "tool": "claude-code",
    "title": "Claude Code v2.1.293",
    "text": "wording taken from the source",
    "quote": true,
    "version": "2.1.293", "figure": "1M context; $0.10/$0.50 per Mtok",
    "sourceUrl": "https://...", "sourceLabel": "Claude Code release notes"
  } ]
}
```

Rules:

- The file name equals `week` plus `.json`. `start` and `end` are the Monday and Sunday of that ISO week.
- `status` is `published` or `draft`. Only `published` files in `data/digest/` are built. Files in `data/drafts/` must have `status: "draft"`.
- Every item date lies inside the week and not in the future. `tool` is `cursor`, `claude-code`, `codex` or `github-copilot`.
- `text` is at most 400 characters. With `"quote": true` it is the source's own wording, with only trailing pull request references removed. Set `"quote": false` for any wording that is not the source's, and keep it to facts the source states.
- `version` and `figure` are optional. Put a number there only if the source states it.
- No item without a `sourceUrl` and a `sourceLabel`.
- Drafts may also hold `candidateLines`, up to three lines from the source, for the reviewer. They are not shown on the site.

Two optional fields add blocks to the issue page. The blocks only repeat fields of the items, so they add no text of their own.

```
{
  "highlights": ["claude-code-2026-10-20-v2.1.10", "codex-2026-10-19-0.164.0", "github-copilot-2026-10-20-example"],
  "items": [ {
    "id": "github-copilot-2026-10-20-example",
    "matrix": [ { "tool": "github-copilot", "file": "copilot-instructions-md" } ]
  } ]
}
```

- `highlights` lists 3 to 5 `id`s of items of the same issue, each once. The page then shows an "In short" list under the lead, in that order, in place of the `summary` paragraph. Each bullet is the item `title`, followed by ` (figure)` when the item has a `figure`, and links to its `sourceUrl`. The Atom entry and `llms-full.txt` carry the same list. Without `highlights`, the page shows `summary` as before. `summary` stays required, because the Atom `<summary>` and `llms-full.txt` still use it.
- `matrix`, on an item, lists `{ "tool", "file" }` pairs. Each pair must be a cell of `matrix.json`, and an entry has no other field. The "Instruction files this week" section appears only when at least one item has `matrix`. It has one line per such item: its `text` (quoted when `"quote": true`), its date, its source link, and a link to each cell, `/matrix/#cell-<tool>-<file>`. Validation also refuses two matrix cells that would get the same anchor.
- "Versions this week" needs no field. For each tool with at least one item that has a `version`, it shows one row with the highest version of the issue, the date of that item and its source. Versions compare as SemVer: `2.1.10` is above `2.1.9`, a leading `v` is ignored, and a release is above its prereleases. A tool with no versioned item gets no row. The table starts with 2026-W43 (`VERSIONS_TABLE_FROM` in `scripts/lib/render.mjs`), so the pages of W41 and W42 do not change.
- From 2026-W43, `title` is at most 90 characters and no longer starts with "Digest for" (`tests/digest-editorial.test.mjs`). W41 and W42 keep their titles.

## watch-sources.json and watch-state.json

`watch-sources.json` lists the feeds (`rss` or `github-releases`). `watch-state.json` holds `seen`, which maps an entry id to the date it was listed. The watch script updates it. A reviewer does not need to edit it. Documentation pages are not fetched by the script.

A response may be at most 5 000 000 bytes. A source can raise that with `maxBytes` (a whole number, never above 25 000 000, the hard limit in `scripts/lib/fetcher.mjs`). `codex-releases` sets 20 000 000, because the GitHub API lists every build asset of each release: 30 releases were 12 009 211 bytes on 2026-10-16. A source that fails, for a size or any other reason, is skipped and the run goes on with the others. The run ends with a `WARNING: n of m source(s) skipped: …` line on stderr. In GitHub Actions the same line is a warning annotation and appears in the job summary. The same sources are listed in a `⚠ Sources skipped: id (reason)` line at the top of the draft pull request body (the watch writes `.cache/watch/skipped-sources.txt`, `scripts/open-watch-pr.sh` reads it). The run still exits 0 unless four or more sources are skipped and nothing was listed (exit 3).

What the parsers read, and which date they keep:

- `rss`: `content:encoded` can hold HTML (list items, or paragraphs when there are none) or Markdown (the Codex changelog feed moved to Markdown). Both give at most three candidate lines. Markdown headings and code fences are skipped, and links, bold and code marks lose their syntax.
- `github-releases`: the lines are the first three bullet points of the release notes. `tagPrefix` removes a prefix such as `rust-v` from the tag to get the version, and `titleFormat` builds the title. Prereleases and drafts are skipped.
- Date of an `rss` entry: the feed date, read in UTC. When the link holds a date (`/2026-10-15-slug`) that is at most one day away from the UTC date, the date in the link is kept, because it is the date the publisher shows on the page. github.blog does not state its zone. Its link dates matched Pacific time on all ten entries of the Copilot feed read on 2026-10-16, so an entry published at 02:16 UTC on 16 October reads 15 October on the page and in its link. Other feeds, and a link date further than one day away, keep the UTC date. GitHub release dates stay in UTC (`published_at`).

## Published JSON

The build copies the matrix to `/data/matrix.json` and all published digests to `/data/digests.json`, so readers and crawlers can use the data without scraping HTML.

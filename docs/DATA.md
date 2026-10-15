# Data schema

All content comes from JSON files in `data/`. `npm run validate` checks every rule below, and the build refuses to run when data is invalid.

## Official hosts

`data/allowed-source-hosts.json` lists the hosts accepted as official sources. A `sourceUrl` must use https and a host from that list, or a subdomain of one. To add a host, edit the list in a pull request and say why it counts as official.

## matrix.json

```
{
  "schemaVersion": 1,
  "lastReviewed": "2026-10-15",
  "tools": [ { "id": "cursor", "name": "Cursor", "docsUrl": "https://...", "scope": "optional note" } ],
  "files": [ { "id": "agents-md", "path": "AGENTS.md", "description": "..." } ],
  "cells":  [ { "tool": "cursor", "file": "agents-md", "status": "reads", "note": "...",
                "sourceUrl": "https://...", "verifiedOn": "2026-10-15", "version": "optional" } ]
}
```

Rules:

- There is exactly one cell for every tool and file pair.
- `status` is one of `reads`, `reads-conditionally`, `configurable`, `not-read`, `unverified`.
- `note` is required, at most 400 characters, and states only what the cited page says.
- Use `unverified` when the cited page does not confirm the cell. The note then reads "Not mentioned on the cited page when checked." and `verifiedOn` is the date of the check.
- `verifiedOn` is the day a person or bot read `sourceUrl`. It cannot be in the future or later than `lastReviewed`.
- `version` is optional and names the first version that behaves as described, when the source says so.
- Cells older than `staleAfterDays` in `site.config.json` (30) are flagged "check again" on the page and warned about by `npm run validate`.

## digest/YYYY-Www.json

```
{
  "schemaVersion": 1,
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

## watch-sources.json and watch-state.json

`watch-sources.json` lists the feeds (`rss` or `github-releases`) and the docs pages for `--docs`. `watch-state.json` holds `seen` (entry id to the date it was listed) and `docs` (page id to the hash of its visible text). The watch script updates it. A reviewer does not need to edit it.

## Published JSON

The build copies the matrix to `/data/matrix.json` and all published digests to `/data/digests.json`, so readers and crawlers can use the data without scraping HTML.

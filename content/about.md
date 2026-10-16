---
title: About
description: What Agent Diffs tracks, how each line is sourced, and what the project does not do.
---
# About Agent Diffs

Agent Diffs follows two things for people who work with AI coding tools. One is the weekly list of changes in Cursor, Claude Code, Codex and GitHub Copilot. The other is a matrix of which instruction file each tool reads, such as `AGENTS.md`, `CLAUDE.md` or `.github/copilot-instructions.md`.

## How the data is made

Every digest item and every matrix cell has a date and a link to an official page. Digest items quote the wording of the source. They do not restate a release note in new words, so a line cannot say more than the source does.

A watch script reads the official changelogs and release feeds and writes a draft with each entry's title, date and link. A person or a bot reviews the draft before anything moves into a digest. The script respects `robots.txt`, identifies itself in its User-Agent header, and waits between requests.

Matrix cells that we could not confirm on an official page are marked "unverified", with the date of the check. A cell is marked "migration only" when the page mentions the file only as input to a migration command such as /init. In the current data, last reviewed on {{lastReviewed}}, {{unverified}} of {{cells}} cells are unverified and {{migrationOnly}} are migration only.

## What this site is not

It is an independent project. It is not affiliated with Cursor, Anthropic, OpenAI, GitHub or Google, and the product names belong to their owners. It does not rank tools, and it does not summarize release notes with a model.

## Data files

The matrix and the digests are available as JSON files: [matrix.json](/data/matrix.json) and [digests.json](/data/digests.json). The [llms.txt](/llms.txt) file lists the pages for chatbots and crawlers. Terms for reusing the data and the code are not set yet. They will be named here before the site is published.

## Corrections

A correction channel will be listed here before the site goes public.

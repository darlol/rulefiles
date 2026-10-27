# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

[Inferred from site.config.json, content/, and BAR brief — interview unavailable in executor subagent.] Engineers and AI-coding practitioners who need dated, sourced changes in Cursor, Claude Code, Codex and GitHub Copilot, and a matrix of which agent reads which instruction file.

## Product Purpose

[Inferred.] Rulefiles publishes a weekly digest of dated, sourced tool changes and a matrix of instruction-file support across those tools, plus an in-browser generator for AGENTS.md / CLAUDE.md / Cursor rules / Copilot instructions. Success: visitors trust the sources, open the matrix or digest, and can generate files without sending data.

## Positioning

[Inferred.] Independent, cookieless reference: every digest item and matrix cell carries an official source URL and a date. Not affiliated with the tools covered.

## Capabilities

- Weekly digest archive + Atom feed (Buttondown newsletter optional)
- Matrix of tools × instruction files with status badges and sources
- Browser-only generator (presets, copy/download; nothing sent)
- About, Privacy, Legal, Sponsors ("not open yet")

## Constraints

- Content language: English; ASCII hyphens client-facing
- CSP cookieless (O5); font-src 'self' only; no Google Fonts CDN
- Counts and claims from build data only — never invent
- GitHub darlol link on About only (not site-wide footer)
- Preview deploy may be noindex; production custom domain changes are out of scope for this redesign job

## Accessibility

[Inferred.] WCAG AA contrast enforced by tests; skip link; landmarks; status never by color alone.

## Voice

[Inferred from existing copy.] Plain, sourced, editorial. No hype claims.

## Evidence

- site.config.json: name Rulefiles, baseUrl https://rulefiles.dev, Buttondown newsletter
- content/about.md: public GitHub via {{repoUrl}}
- Matrix and digest JSON under content/data (build-time)

## Open decisions

None for this redesign: Direction A Signal Press is brief-pinned.

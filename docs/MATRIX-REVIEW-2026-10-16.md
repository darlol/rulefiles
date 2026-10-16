# Matrix review of 2026-10-16

On 2026-10-16 the four cited documentation pages were fetched again and read, and so were the pages next to them: Cursor's help article on rules, the Cursor docs index, the Claude Code docs index, the Codex configuration reference, and GitHub's reference table "Support for different types of custom instructions" and its page for Copilot CLI. A cell changed only when a page says so in words. Where a page says nothing, the cell stays unverified and its note names the pages that were read.

Changed or moved:

- Cursor, CLAUDE.md: unverified, now reads. Source: https://cursor.com/help/customization/rules. The page says "Cursor reads `CLAUDE.md` files the same way it reads `AGENTS.md`." and that CLAUDE.md files are always applied.
- Cursor, .cursorrules: unverified, now migration only. Same source. The page calls the file "legacy and will be deprecated" and lists it in a migration section only.
- Codex, .github/copilot-instructions.md: configurable, now unverified. The Codex page describes fallback file names checked in each directory from the project root to the working directory. It does not say whether a path like `.github/copilot-instructions.md` can be listed, so the earlier status went further than the page.

Still unverified, with nothing found on any page read:

- Cursor: AGENTS.override.md, GEMINI.md, .claude/rules/*.md, .github/copilot-instructions.md, .github/instructions/*.instructions.md.
- Claude Code: GEMINI.md, .github/instructions/*.instructions.md.
- Codex: .cursor/rules/*.mdc, .claude/rules/*.md, .github/instructions/*.instructions.md.
- GitHub Copilot: AGENTS.override.md, .cursorrules, .cursor/rules/*.mdc, .claude/rules/*.md.

Moved pages: the Cursor rules page is now https://cursor.com/docs/rules (the old /docs/context/rules link answers 308), and the Codex AGENTS.md guide is now https://learn.chatgpt.com/docs/agent-configuration/agents-md (the old developers.openai.com link answers 308). Both new hosts and paths are cited in the data, and learn.chatgpt.com is added to `data/allowed-source-hosts.json`.

Other statements noticed on the pages and not added to the matrix: the Claude Code page says /init reads other tools' files, and with `CLAUDE_CODE_NEW_INIT=1` also AGENTS.md, `.devin/rules/`, `.windsurf/rules/`, `.windsurfrules` and `.clinerules`; it also documents an /import command, from v2.1.213. GitHub lists REVIEW.md as an agent instruction file for Copilot code review, and says Copilot CLI also uses `.claude/CLAUDE.md`. The matrix has no row for those files.

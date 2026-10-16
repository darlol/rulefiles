# Terms of the sources

Read on 2026-10-16 on the vendors' own pages. This is a working note for the owner, not legal advice. It records what the project takes from each source, which clauses look relevant, and a cautious reading. "To confirm" marks a point a lawyer should look at before launch. Terms change, so the check has to be repeated (see item 9 of `docs/LAUNCH-BLOCKERS.md`).

## What the project does with the sources

- The watch script (`scripts/watch.mjs`) reads five public sources listed in `data/watch-sources.json`: the Cursor changelog RSS, the GitHub REST API for the releases of `anthropics/claude-code`, the Codex changelog RSS, the GitHub REST API for the releases of `openai/codex`, and the GitHub changelog feed filtered on the Copilot label. It does not fetch HTML pages.
- It identifies itself with the User-Agent `RulefilesWatch/0.1`, checks `robots.txt` on every host, waits 1,500 ms between requests, and caches responses on disk. It runs once a week.
- A digest item keeps a title, a date, a link and one short excerpt of the source wording. A matrix cell keeps a status, a link to an official page, a date, and a short note that can quote one sentence.
- The matrix pages were read one by one by hand on 2026-10-16. No crawler fetched them.
- The site uses no vendor logo. Product names appear as text.

## Cursor (Anysphere, Inc.)

| Item | Detail |
| --- | --- |
| Used | https://cursor.com/changelog/rss.xml (RSS), and links to cursor.com help and docs pages for the matrix |
| Terms read | Terms of Service, "Last updated September 3, 2026", https://cursor.com/terms-of-service |
| Clauses | Section 1.5 lists what a user may not do, including "(ii) reproduce, modify, translate, or create derivative works of the Service" and "(viii) harvest, scrape, or extract data from the Service". The Service is defined to include the website www.cursor.com. |
| robots.txt | `User-agent: *` with `Allow: /` and a list of `Disallow` rules, among them `/api/`, `/dashboard`, `/*/docs` and `/*/help`. The changelog feed is not disallowed. |
| Feed license | None stated on the feed or the changelog page. |
| Brand | https://cursor.com/brand: "Refer to us as Cursor. Not Cursor AI or Cursor Code." The site writes "Cursor". |

Cautious reading: the feed is published for readers and the project takes one request a week from it, but Section 1.5(viii) is broad and the Terms do not carve out feeds. Quoting a short line with a link looks defensible, copying whole entries does not. To confirm. A short email asking whether feed use and short quotes are fine would settle it.

## Anthropic (Claude Code)

| Item | Detail |
| --- | --- |
| Used | The GitHub REST API (`https://api.github.com/repos/anthropics/claude-code/releases`), not anthropic.com. Links to code.claude.com docs pages for the matrix. |
| Terms read | Consumer Terms, effective October 8, 2025, https://www.anthropic.com/legal/consumer-terms. Commercial Terms, effective June 17, 2025, https://www.anthropic.com/legal/commercial-terms (they govern the API and the Console). |
| Clauses | The Consumer Terms forbid "To crawl, scrape, or otherwise harvest data or information from our Services other than as permitted under these Terms" and access "through automated or non-human means, whether through a bot, script, or otherwise" except with an Anthropic API key. On the brand: "You may not, without our prior written permission, use our name, logos, or other trademarks in connection with products or services other than the Services, or in any other way that implies our affiliation, endorsement, or sponsorship" (marketing@anthropic.com). |
| Repository | The GitHub license field is empty. `LICENSE.md` says: "© Anthropic PBC. All rights reserved. Use is subject to Anthropic's Commercial Terms of Service." |
| robots.txt | anthropic.com allows all. code.claude.com carries a Content-Signal of `ai-train=yes, search=yes, ai-input=yes` and disallows `/cdn-cgi/` and `/_next/`. |

Cautious reading: the project does not touch Anthropic's own services, it reads a public GitHub API, so GitHub's API terms are the ones that bind the access (see below). The release notes are Anthropic's text under all rights reserved, so only short quotes with a link are safe. Using the name "Claude Code" to say which tool a line is about is not the use the brand clause targets, as far as can be read, but the clause is broad. To confirm.

## OpenAI (Codex)

| Item | Detail |
| --- | --- |
| Used | https://developers.openai.com/codex/changelog/rss.xml (RSS, which redirects to learn.chatgpt.com), and the GitHub REST API for the releases of `openai/codex` (`https://api.github.com/repos/openai/codex/releases`, one request, not the `.atom` feed). Links to developers.openai.com, learn.chatgpt.com and github.com release pages for the matrix and the digests. |
| Terms read | Terms of Use, effective January 1, 2026, https://openai.com/policies/terms-of-use/. It applies to ChatGPT and OpenAI's other services for individuals. The Business Terms govern the APIs. |
| Clauses | "Modify, copy, lease, sell or distribute any of our Services." and "Automatically or programmatically extract data or Output (defined below)." On the brand: "You may only use our name and logo in accordance with our Brand Guidelines." |
| Repository | `openai/codex` is Apache-2.0 (GitHub API, 2026-10-16). That covers the code, not the documentation site, and the license text does not say anything about the text of the release notes. The release notes are quoted short, with a link to the release, like any other source. |
| robots.txt | developers.openai.com and learn.chatgpt.com both have `User-agent: *` and `Allow: /`. api.github.com is the host already used for the Claude Code releases and is checked the same way (see the GitHub section). |
| Feed license | None stated in the feed. |
| Brand | The OpenAI brand guidelines page returned an error to the command-line check and was not read. Not verified. |

Cautious reading: this is the least clear source. The Terms of Use are written for the products used by individuals, and it is not clear that they cover the developer documentation site and its feed. If they do, the "programmatically extract data" line is wide. The project reads one feed a week, honors `robots.txt`, and identifies itself. To confirm, and worth a short email to OpenAI before launch.

## GitHub (Copilot)

| Item | Detail |
| --- | --- |
| Used | https://github.blog/changelog/label/copilot/feed/ (WordPress feed), and the GitHub REST API for the Claude Code and Codex releases. Links to docs.github.com pages for the matrix. |
| Terms read | Terms of Service, effective April 27, 2026, https://docs.github.com/en/site-policy/github-terms/github-terms-of-service, Section H (API Terms). Acceptable Use Policies, https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies. Logos and usage page, https://github.com/logos. |
| Clauses | AUP Section 6: "You will not reproduce, duplicate, copy, sell, resell or exploit any portion of the Service, use of the Service, or access to the Service without our express written permission." AUP Section 7 defines scraping as "extracting information from our Service via an automated process, such as a bot or webcrawler" and says "Scraping does not refer to the collection of information through our API". It forbids using the information for spam. Logos page: "Do not use GitHub trademarks, logos, or artwork without GitHub's prior written permission." |
| robots.txt | github.com: "If you would like to crawl GitHub contact us via https://support.github.com?tags=dotcom-robots". github.blog: `User-agent: *` with an empty `Disallow`. |
| Content license | The `github/docs` repository publishes its documentation content under CC-BY-4.0 (code under MIT). No license was found for the github.blog changelog entries. |

Cautious reading: reading the REST API is explicitly not scraping under AUP Section 7, and the API terms apply. The github.blog feed is a published feed on a site whose robots file allows access. The project sends no spam and keeps no personal data from GitHub. Whole-entry copying is the risk, not the reading. To confirm.

## What holds for all the sources

- No source gave an explicit permission to republish its text. None stated a license for its changelog text, apart from the GitHub documentation repository (CC-BY-4.0) and the Apache-2.0 code of `openai/codex`.
- The practice that keeps the project closest to safe ground is the one it already follows: read feeds and APIs rather than pages, honor `robots.txt`, keep volume low, quote one short excerpt with the vendor named and a link, keep the project's own fields apart from the quote, and never restate a release note in new words.
- French law allows short quotations with the author and source indicated (CPI article L122-5, 3°, a). See `docs/LICENSE-RECOMMENDATION.md`. That is an exception to copyright. It does not override a contract, so the vendors' terms still matter for the reading itself. Only French law was checked.
- The project needs a quick way to remove an excerpt on request. The correction channel on the About page is meant for that, once it has an address.

## Before launch

1. Repeat this check on the day, since each document carries its own date above.
2. Decide whether to write to Cursor and OpenAI, the two sources with the broadest wording, to ask about feed reading and short quotes.
3. Read the OpenAI brand guidelines, which could not be read here.
4. Have a lawyer read the points marked "To confirm".

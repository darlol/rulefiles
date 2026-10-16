# Brand clearance for "Agent Diffs"

Checked on 2026-10-16. This is a working note for the owner, not legal advice and not a trademark opinion. Nothing was bought, filed, reserved or created. Every check was read-only. A professional trademark search (by an industrial property attorney) is the only way to rule out a conflict, and it is the recommended step before any filing or purchase.

## Summary

- No registered or pending trademark named "Agent Diffs", "AgentDiffs", "Agent Diff", "AgentDiff" or "Agent-Diffs" appeared in TMview, which aggregates the EUIPO, INPI and many other offices. TMview is a search aid, not an official register, and the INPI and WIPO databases could not be queried automatically (see "What could and could not be searched").
- The name is not free in practice. At least four software projects already use "Agent Diff" or "AgentDiff", two of them with a registered domain and one with a published package of the same name, all in the AI agent tooling field. Adding an "s" does not make the name clearly different. This is the main finding, and it changes the earlier recommendation in `docs/BRAND.md`.
- The domains `agentdiffs.dev`, `.app`, `.org`, `.net` and `.ai` looked unregistered. `agentdiffs.com` is registered (since 2026-02-14) and returned no website. `agentdiff.dev`, `agentdiff.app` and `agentdiff.com` are registered and in use.
- The X account `@agentdiffs` exists, created on 2026-05-27, with the bio "What shipped vs. what the demo showed. AI agents, dev tools, infra." That is the same field as this project. It is unknown who runs it.
- The owner decides the name. Options are in "Options".

## What could and could not be searched

| Register | Result |
| --- | --- |
| TMview, https://www.tmdn.org/tmview/ | Works with a headless browser, no captcha. Used for every query below. Not an official register: it copies data from the participating offices, with some delay. |
| EUIPO eSearch plus, https://euipo.europa.eu/eSearch/ | The page loaded in a headless browser and showed "No results were found using the criteria introduced" for "agent diffs". It was not confirmed that the page applied the typed query, so this is weak evidence. |
| INPI, https://data.inpi.fr/ | Blocked. Automated requests get a Cloudflare challenge ("Attention Required", HTTP 403). The challenge was not bypassed. |
| WIPO Global Brand Database, https://branddb.wipo.int/ | Serves a captcha page to automated clients. Not bypassed. |
| USPTO, https://tmsearch.uspto.gov/ | Not queried. TMview covers the USPTO. |

Manual procedure, to run in an ordinary browser:

1. INPI: open https://data.inpi.fr/, choose the trade mark search, type `agent diffs`, then repeat with `agentdiffs`, `agent diff`, `agentdiff` and `diffs`. Note the owner, the classes and the status of every result.
2. EUIPO: open https://euipo.europa.eu/eSearch/, choose trade marks, do a basic search on the same words, and look at the results for classes 9, 41 and 42.
3. WIPO: open https://branddb.wipo.int/, choose the Brand tab, search the same words, and filter on Nice classes 9, 41, 42 (and 38 if used).
4. For each hit, check whether the owner and the goods or services are in the AI software or developer tools field. A mark in an unrelated field matters less.
5. A professional search also looks at phonetic and visual similarity, which these tools only partly do.

## TMview results

Searches ran on 2026-10-16 with the criteria Is (exact), Begins with and Contains, over all offices TMview lists. A zero means the result list stayed empty in the captured page. The page did not print an explicit "no result" line, and a slow load could look the same, so a zero is a strong hint and not proof.

| Query | Is | Begins with | Contains |
| --- | --- | --- | --- |
| agent diffs | 0 | 0 | 0 |
| agentdiffs | 0 | 0 | 0 |
| agentdiff | 0 | 0 | 0 |
| agent-diffs | 0 | 0 | 0 |
| agent diff | 0 | 0 | 24 |
| diffs | 3 | 42 | 56 |
| diff | 106 | 4,789 | 33,005 |
| rulefiles (fallback name) | 0 | 0 | 0 |
| cursor (control query, to show the tool returns results) | 135 | 242 | 732 |

Notes:

- "agent diff", Contains, gave 24 rows. All were long marks that contain the words "agent" and "different" or "difference", none a mark called Agent Diff.
- "diffs", Is, gave three marks, none in the EU or France: DIFFS (class 9, registered, USPTO, an unrelated fire-suppression equipment company), DIFFS (no class, ended, South Korea) and DIFFS (class 25, expired, Canada).
- "diffs", Begins with, has 42 results. The first page was read. Among the marks in classes 9 or 42 are DIFFSHOP (class 42, USPTO and China), DIFFSTAR (class 9, ended or expired in several offices), DIFFSEAL (class 9, expired, Sweden) and DIFFSPEC (classes 9 and 42, ended, South Korea). The hits from EU national offices in these classes (Sweden, Denmark) are expired.
- "diff", Is, has 106 results. Only the first page of 30 was read. In it, classes 9, 38, 41 or 42 appear for DIFF, LLC (class 9, registered, USPTO), a Canadian consulting company (class 42, registered), a US market studies company (class 41, ended), and THERMCROSS (classes 3, 4, 6, 7, 8, 9, 11 and 21, registered in France and the United Kingdom). The goods behind these were not read. A professional search should read all 106.

## Nice classes

Read in the Nice Classification, 13th edition, version 2026 (https://nclpub.wipo.int/enfr/ and the class PDFs):

| Class | What it covers, as relevant here |
| --- | --- |
| 9 | Recorded and downloadable multimedia files and computer software. Relevant only if the project distributes downloadable software. The generator runs in the browser from the site and is open source, which may or may not count. |
| 41 | Education, training, entertainment. Includes "publication of books and texts, other than publicity texts" and online non-downloadable publications. The closest fit for a digest and a newsletter. |
| 42 | Includes software as a service (SaaS), providing online non-downloadable computer software, and design of computer software. Relevant if the matrix or generator is offered as an online tool. |
| 38 | Telecommunications services, including online forums and chatrooms. Not needed unless the project hosts discussion. |

A filing is in specific goods and services, so the wording matters. An attorney should choose it. Choosing classes 41 and 42 only is cheaper than adding 9.

## Existing uses of the same or a close name

Found on 2026-10-16 by registry queries and web search. None of this was checked in depth, and the people behind these projects are not contacted.

| Name as used | What it is | Where | Seen |
| --- | --- | --- | --- |
| Agent Diff | API and MCP sandboxes to evaluate AI agents, with benchmarks | https://www.agentdiff.dev/, GitHub `agent-diff-bench/agent-diff` (MIT, 35 stars), npm `agent-diff`, PyPI `agent-diff` | Domain registered and live. The GitHub repository was created 2025-08-23. |
| AgentDiff | Trajectory regression testing for AI agents, pre-release, MIT | https://agentdiff.app, PyPI `agent-trajectory-diff`. A LinkedIn post dated 2026-10-09 says it joined the Claude for Startups program. | Domain registered and live |
| agentdiff | Git-native record of which AI agent wrote which line | GitHub `codeprakhar25/agentdiff` (Apache-2.0, 46 stars), homepage https://getagentdiff.com | Live. A crate named `agentdiff` also exists on crates.io ("Audit and trace autonomous AI code contributions in git repositories", version 0.1.30, updated 2026-06-08). That it is the same project was not confirmed. |
| agentdiff | Open-source CI for AI agent behavior changes | GitHub `agentdiff-ai/agentdiff` | Live |
| AgentDiff (X) | An account named "Skittle", created 2022-05-16, empty bio | https://x.com/AgentDiff | Exists |
| agentdiffs (X) | An account named "AI Agent Tooling", created 2026-05-27 | https://x.com/agentdiffs | Exists |

Close marks to weigh: "Agent Diff" and "AgentDiff" (singular, in use in the same field), "Diffs" and "Diff" (generic for software that compares files, and a crowded space in TMview). A word that describes what a tool does is weak as a trademark and gives little protection to its owner.

## Domains

RDAP (the registry's own lookup, through the IANA bootstrap file) plus a DNS lookup over HTTPS, run on 2026-10-16. A 404 from RDAP together with NXDOMAIN means the name looks unregistered. It does not prove that it can be bought: a registry can reserve it and a registrar can price it as premium.

| Name | .dev | .app | .org | .com | .net | .ai |
| --- | --- | --- | --- | --- | --- | --- |
| agentdiffs | free | free | free | registered 2026-02-14, expires 2027-02-14, no website answered | free | free |
| agentdiff | registered | registered | free | registered | free | free |
| rulefiles | free | free | registered | registered | free | free |

### Prices

Read on 2026-10-16 from the registrars' own pages. Prices change, taxes and the ICANN fee (0.20 USD per year) can be added at checkout, and a first-year price can be a promotion. Nothing was bought.

| Registrar | .dev | .app | .org | .com |
| --- | --- | --- | --- | --- |
| Porkbun (public API, https://api.porkbun.com/api/json/v3/pricing/get), USD, registration then renewal | 8.75 then 12.87 | 8.75 then 14.93 | 7.98 then 11.84 | 11.08 then 11.08 |
| Namecheap (product pages), USD, registration then renewal | 10.98 (regular 15.98) then 20.98 | 10.98 (regular 17.98) then 22.98 | 8.48 (regular 14.48) then 18.98 | 11.28 (regular 14.98) then 18.48 |
| Gandi (product pages), EUR, registration then renewal | 14.01 (first year promo 8.99) then "from 31.98" (promo 28.78) | 19.90 (promo 8.99) then 40.00 (promo 36.00) | 15.20 (promo 7.99) then 31.98 | 11.00 then "from 31.98" (28.78) |
| Cloudflare Registrar | Sold at cost, no markup (https://www.cloudflare.com/products/registrar/). Not verified: a live price needs a Cloudflare account. The documentation example response (https://developers.cloudflare.com/registrar/registrar-api/) shows .com 8.57, .dev 10.11 and .app 11.00 USD with renewal at the same price, but it is an example, not a quote, and it has no .org. | | | |

Notes: Gandi shows the same renewal figure of 31.98 for .dev, .org and .com, which looks odd and was recorded as displayed. Whether Gandi's prices include VAT was not stated on the pages read. Among the three registrars with a published price, Porkbun lists the lowest renewal price for each of the four extensions. The currencies differ (USD and EUR), so the columns are not directly comparable.

## Handles

Read-only checks on 2026-10-16. A 404 on a name means no account or package with that name was found, and does not guarantee the name can be claimed (a platform can reserve names).

| Platform | agentdiffs | agent-diffs | agentdiff | agent-diff | rulefiles |
| --- | --- | --- | --- | --- | --- |
| GitHub user or organization | free | free | taken (organization, created 2025-08-10, 1 repository) | taken (organization, created 2026-01-15, no public repository) | free |
| npm package | free | free | free | taken (`agent-diff`, TypeScript SDK for Agent Diff) | free |
| PyPI project | free | free | free | taken (`agent-diff`, Python SDK for Agent Diff) | free |
| crates.io | free | free | taken (AI code provenance) | free | free |
| Docker Hub organization | free | free | free | not checked | not checked |
| X | taken (@agentdiffs, see above) | not checked | taken (@AgentDiff) | not checked | taken (@Rulefiles, personal account created 2015, empty bio) |

Not checked: Bluesky (the lookup failed with a 400 for the handles tried), LinkedIn, YouTube, Reddit, Mastodon, Product Hunt and Hugging Face. X was read through the X API; the other checks used each platform's public registry or API.

## Official filing fees, for information

- INPI (France), electronic filing: 190 EUR for one class and 40 EUR for each added class. Three classes cost 270 EUR. Source: https://www.inpi.fr/realiser-demarches/propriete-intellectuelle/deposant-et-cout-dune-marque, read on 2026-10-16. Renewal after ten years: 290 EUR for one class and 40 EUR per added class (INPI renewal guidelines, August 2026, https://www.inpi.fr/sites/default/files/2026-08/inpi-directives-renouvellement-marques_08-2026.pdf).
- EUIPO (European Union), online: 850 EUR for one class, 50 EUR for the second, 150 EUR for each from the third. Three classes cost 1,050 EUR. Valid ten years. Source: https://www.euipo.europa.eu/en/trade-marks/before-applying/fees-payments, read on 2026-10-16. Fees are not refundable.
- The INPI page also mentions a SME Fund that can refund part of the costs for small and medium businesses. Whether an individual or this project qualifies was not checked.
- A French filing covers France only. An EU filing covers the whole Union, and an opposition against a close earlier mark is a real risk in a crowded field. Attorney fees are not included.

## Options

Neutral list, in no order of preference. The owner chooses.

1. Keep "Agent Diffs". The domain `agentdiffs.dev` and the GitHub and package names look free. The risk is confusion with at least four existing "Agent Diff" or "AgentDiff" projects in the same field, and the existing X account. The professional search and a conversation with the attorney would tell how serious it is.
2. Change the name before publication. The cost now is low, since the site is unpublished, no domain is bought and nothing is filed.
3. Fallback already checked: "Rulefiles". On 2026-10-16: `rulefiles.dev`, `.app`, `.net` and `.ai` look unregistered, `rulefiles.com` and `.org` are registered, the npm, PyPI, crates.io and GitHub names are free, TMview returned no result for the word, and a web search found no project of that name (several tools with similar purposes, such as Rulesync and ai-rules, exist under other names). The X handle @Rulefiles belongs to a personal account. The name fits the matrix and the generator better than the weekly digest. Not searched in INPI or WIPO.
4. "Agent Changelog" stays dropped: pages and repositories already use it (see `docs/BRAND.md`).

## Before any purchase or filing

1. Run the manual searches above, and read all 106 "DIFF" results in classes 9, 41 and 42.
2. Ask an industrial property attorney for a similarity search on the chosen name.
3. Repeat the RDAP check on the day of purchase.
4. Register the domain and the handles in one sitting once the name is final, then file the trademark.

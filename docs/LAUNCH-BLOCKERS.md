# Launch blockers

The site must not go public until each item below has an answer from the owner. None of them has been decided, and nothing in the repository decides them in the owner's place. This is a list of open decisions. It is not legal advice, and items 1 and 2 should be confirmed with a legal adviser.

Every field that only the owner can supply is marked in the copy as `[[TODO-OWNER: field]]`. `npm run build` prints a `LAUNCH WARNING` line for every marker still on a page, for older placeholder sentences such as "will be named here", and for the placeholder domain. The warnings do not stop that build. `npm run build:strict` (or `AGENT_DIFFS_STRICT=1`) makes the build fail, and removes `dist/`, while any of them remains. The release build uses strict mode. The list of markers is under "Fields to fill in" below, and a test keeps it in step with the files.

## 1. License for the code and the data

Open: the license of the code, and the license of the data in `data/` (`matrix.json`, the digests, and the published `matrix.json` and `digests.json`). These can differ.

State today:

- There is no `LICENSE` file in the repository.
- `content/about.md` does not invite anyone to reuse the data. It says the terms are not set yet.
- The JSON-LD Dataset block on the matrix page has no `license` property. Add it only once the license is chosen.
- The digest items quote wording from official pages. Whether those quotes can be republished under a data license, and under what conditions, is part of the question.

Once chosen: add `LICENSE`, state both licenses on the About page, add `license` to the Dataset JSON-LD in `scripts/lib/render.mjs`, and mention it in `README.md`.

## 2. Publisher identity and legal notice (mentions légales, France)

Open: who publishes the site, and what the legal notice says. What it must contain depends on whether an individual or a business runs the site, and on the choice between showing a personal identity or relying on the host's details. A legal adviser should confirm this.

Information the owner has to supply:

- name of the publisher (person or company), and a postal address if required
- contact email
- name of the person responsible for the publication, if required
- name, address and contact details of the host (item 3)

GDPR: name the data controller (responsable de traitement) and the procedure for the rights of the people concerned (access, rectification, erasure, objection, and the right to complain to the CNIL). The newsletter is the only processing of personal data planned, and the controller is whoever runs the list.

There is no legal notice page yet. The footer has Privacy and Sponsors links only.

## 3. Host

Open: where the site is served from. `docs/OPERATIONS.md` compares GitHub Pages, Cloudflare Pages and Netlify. No account exists with any of them. The host has to be named on the privacy page, and its details belong in the legal notice.

## 4. Domain

Open: the name and the domain. `docs/BRAND.md` lists candidates and registry checks from 2026-10-15. Nothing is bought. A trademark search is still needed. After the choice, set `baseUrl` in `site.config.json` (or `SITE_URL` at build time). The placeholder `https://agentdiffs.dev` triggers a build warning.

## 5. Contact address and correction channel

Open: one or more addresses for privacy requests, corrections to the data, and sponsorship questions, and where corrections are handled (an inbox, an issue tracker, or both). Markers wait for them in `content/about.md` (corrections), `content/privacy.md` (contact) and `content/sponsors.md` (through `sponsorContact` in `site.config.json`).

## 6. Newsletter list

Open: who is responsible for the subscriber list, which provider is used (`docs/NEWSLETTER.md` compares options), and the data processing terms with that provider. Then update `content/privacy.md` and the newsletter page, set the form address (`NEWSLETTER_FORM_ACTION`), and turn on double opt-in at the provider. Until then the form stays off and the site sends nothing.

## 7. Sponsorship

Open: whether sponsorship opens at all, and under which terms. `content/sponsors.md` states the editorial rules that would apply. No rates are published.

## 8. Repository settings

Open: enable "Allow GitHub Actions to create and approve pull requests" for the weekly watch workflow, and protect `main`. Pull requests that the workflow opens with `GITHUB_TOKEN` do not start CI by themselves (see `docs/OPERATIONS.md`).

## 9. Data freshness

Before launch: re-read the cited official pages for every matrix cell, update `verifiedOn`, and read the terms of use of each source again. `npm run validate` warns about cells older than `staleAfterDays`.

## Fields to fill in

Each line is one marker, the file that holds it, and the item above it belongs to. Replace the whole `[[TODO-OWNER: ...]]` text with the real value. A test compares this list with the markers in `content/`, `scripts/lib/render.mjs` and `site.config.json`.

- `[[TODO-OWNER: license of the data and the code]]` in `content/about.md`, item 1.
- `[[TODO-OWNER: correction channel]]` in `content/about.md`, item 5.
- `[[TODO-OWNER: host name and address]]` in `content/privacy.md`, item 3.
- `[[TODO-OWNER: newsletter provider]]` in `content/privacy.md`, item 6.
- `[[TODO-OWNER: person responsible for the list]]` in `content/privacy.md`, item 6.
- `[[TODO-OWNER: privacy contact address]]` in `content/privacy.md`, item 5.
- `[[TODO-OWNER: sponsorship contact address]]` in `scripts/lib/render.mjs`. The Sponsors page shows it until `sponsorContact` is set in `site.config.json`, item 5.

The placeholder domain is not a marker. The build reports `baseUrl` while it is still `https://agentdiffs.dev`, item 4.

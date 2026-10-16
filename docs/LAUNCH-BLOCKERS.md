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

## 2. Publisher identity, legal notice and GDPR (France)

Open: who publishes the site. The pages `content/legal.md` (legal notice, mentions légales) and `content/privacy.md` are written, and every fact only the owner has is a marker, listed under "Fields to fill in". Nothing about the owner was invented. None of this is legal advice, and a legal adviser should confirm it.

What the texts rest on, read on 2026-10-16:

- Article 1-1 of loi n° 2004-575 du 21 juin 2004 (https://librejustice.fr/norm/fr/loi-n-2004-575-du-21-juin-2004-pour-la-confiance-dans-l-economie-numerique/1-1, in force since 23 May 2024). A person who publishes a site must make available: for an individual, name, first names, home address and phone number, plus the registration number if registered at the RCS or the RNE; for a company, name, head office, phone number, registration number and share capital; the name of the director of publication; and the name, address and phone number of the host. The same article gives a right of reply, to be requested within three months, and sends it to the director of publication.
- The same article, II: a person who publishes on a non-professional basis may show only the host's name and address, if the host holds that person's identity details. The host then keeps them under professional secrecy, except toward the courts. If the owner chooses this, replace the "Publisher", "Director of publication" and "Contact" sections of `content/legal.md` with a sentence such as: "The publisher of this site has chosen to remain anonymous, as the law allows for a non-professional publisher. The host is X. Send any request, including a right of reply, to the host, which passes it on." The owner must then give the host the identity details first. Whether a site with a sponsorship plan and a newsletter counts as non-professional is a question for the adviser.
- Article L34-5 of the code des postes et des communications électroniques (https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000042155961/): sending a message that promotes goods, services or the image of a seller to an individual's email address needs that person's prior consent, which must be free, specific and informed. Each message must show valid contact details to ask for the messages to stop, and the sender's identity cannot be hidden. The page read also notes a Constitutional Council decision of 25 June 2026 that finds the sixth, eighth and next-to-last paragraphs unconstitutional, with repeal postponed to 31 October 2027. By their position these are the paragraphs on the CNIL's oversight and on the fine, not the consent rule in the first paragraphs. To confirm.
- GDPR: the privacy page names the controller (responsable de traitement), the purpose, the legal basis (consent, article 6(1)(a)), the provider and its transfer to the United States, the retention, and the rights, with the right to complain to the CNIL. The CNIL says the retention period has to be set by the controller in line with the purpose (https://www.cnil.fr/fr/les-durees-de-conservation-des-donnees). No fixed period exists for a newsletter list, so the owner has to choose one.
- Not covered here: whether a record of processing (registre des traitements) is needed, whether a data protection officer is needed, the consent evidence the provider keeps, and any duty of an EU representative. To confirm with the adviser.

Information the owner has to supply: the publisher's name or pseudonym policy, status, address (or the address of a domiciliation service, which a business can use, to confirm), phone number, registration data if any, director of publication, contact email, host details, data controller, retention after unsubscription, and the tracking decision.

## 3. Host

Open: where the site is served from. `docs/OPERATIONS.md` compares GitHub Pages, Cloudflare Pages and Netlify. No account exists with any of them. The legal notice has to give the host's name, address and phone number, and the privacy page names the host too. One marker, `host name, address and phone number`, serves both pages.

## 4. Name, domain and trademark

Open: the domain, and what to do about the name. The owner retained "Agent Diffs" on 2026-10-16. `docs/BRAND-CLEARANCE.md` (checks of 2026-10-16) found at least four software projects already called "Agent Diff" or "AgentDiff" in the same field, so the name needs a decision with open eyes. The INPI and WIPO databases could not be searched automatically, so the manual searches in that document are still to do, and an industrial property attorney should run a similarity search before any filing. Nothing is bought, filed or reserved. After the choice, set `baseUrl` in `site.config.json` (or `SITE_URL` at build time). The placeholder `https://agentdiffs.dev` triggers a build warning.

## 5. Contact address and correction channel

Open: one or more addresses for privacy requests, general contact, corrections to the data, and sponsorship questions, and where corrections are handled (an inbox, an issue tracker, or both). Markers wait for them in `content/about.md` (corrections), `content/privacy.md` (privacy contact), `content/legal.md` (contact email) and `scripts/lib/render.mjs` (sponsorship, until `sponsorContact` is set in `site.config.json`).

## 6. Newsletter list

Decided on 2026-10-16: Buttondown, with Kit as the fallback, and the form stays disabled. `docs/NEWSLETTER.md` has the setup steps for the day the owner gives the publication go, none of them executed. Still open: the data controller and the retention period after unsubscription (markers in `content/privacy.md`), the decision on tracking opens and clicks (a marker), the data processing terms accepted in the account, and then the form address (`NEWSLETTER_FORM_ACTION`). If the provider changes, `content/privacy.md` has to change with it, since it names Buttondown. Until the form is on, the site sends nothing.

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
- `[[TODO-OWNER: publisher name]]` in `content/legal.md`, item 2.
- `[[TODO-OWNER: publisher status]]` in `content/legal.md`, item 2. Individual not acting professionally, sole trader, or company.
- `[[TODO-OWNER: publisher address]]` in `content/legal.md`, item 2. Home address, or the registered office or domiciliation address for a business.
- `[[TODO-OWNER: publisher phone number]]` in `content/legal.md`, item 2.
- `[[TODO-OWNER: publisher registration number and share capital]]` in `content/legal.md`, item 2. Only if the publisher is registered. Otherwise write that there is none.
- `[[TODO-OWNER: director of publication]]` in `content/legal.md`, item 2.
- `[[TODO-OWNER: contact email address]]` in `content/legal.md`, item 5.
- `[[TODO-OWNER: host name, address and phone number]]` in `content/legal.md` and `content/privacy.md`, item 3.
- `[[TODO-OWNER: data controller]]` in `content/privacy.md`, item 2.
- `[[TODO-OWNER: privacy contact address]]` in `content/privacy.md`, item 5.
- `[[TODO-OWNER: email open and click tracking]]` in `content/privacy.md`, item 6. Say whether opens and clicks are tracked.
- `[[TODO-OWNER: retention period after unsubscription]]` in `content/privacy.md`, item 6.
- `[[TODO-OWNER: sponsorship contact address]]` in `scripts/lib/render.mjs`. The Sponsors page shows it until `sponsorContact` is set in `site.config.json`, item 5.

The placeholder domain is not a marker. The build reports `baseUrl` while it is still `https://agentdiffs.dev`, item 4.

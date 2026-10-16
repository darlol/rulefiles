# Launch blockers

The site must not go public until each item below is settled. Several were decided on 2026-10-16 and are recorded under their item, with what is still open. Nothing in the repository decides an open item in the owner's place. This is a list of decisions. It is not legal advice, and items 1, 2 and 3 should be confirmed with a legal adviser.

Every field that only the owner can supply is marked in the copy as `[[TODO-OWNER: field]]`. `npm run build` prints a `LAUNCH WARNING` line for every marker still on a page, for older placeholder sentences such as "will be named here", and for the placeholder domain. The warnings do not stop that build. `npm run build:strict` (or `RULEFILES_STRICT=1`) makes the build fail, and removes `dist/`, while any of them remains. The release build uses strict mode. The list of markers is under "Fields to fill in" below, and a test keeps it in step with the files.

## 1. License for the code and the data

Decided on 2026-10-16: MIT for the code, CC BY 4.0 for the data and the text. See `LICENSE`, `LICENSE-DATA.md` and `docs/LICENSE-RECOMMENDATION.md`.

Still open:

- The name in the copyright line of `LICENSE` and in the `attribution` field of the data files is "Rulefiles contributors". The owner has to confirm it, or give another name. The value sits in `LICENSE`, `scripts/lib/license.mjs`, the data files and the About page template.
- The digest items quote wording from official pages. The license does not cover those quotes, and the pages say so. Whether the quoting stays inside the French short-quotation exception is a question for the adviser (see `docs/LICENSE-RECOMMENDATION.md`).

## 2. Publisher identity, legal notice and GDPR (France)

Decided on 2026-10-16: version 1 is a non-professional publication, with no income at opening. The publisher stays anonymous, as article 1-1, II of loi n° 2004-575 du 21 juin 2004 allows. The legal notice (`content/legal.md`) names no person and gives the host's name, address and phone number (item 3). The full text of the article, the duty to give the host the publisher's real identity, and the steps for a switch to a professional status are in `docs/LAUNCH.md`.

About the numbering: the rule was article 6, III, 2 of the same law until the law of 21 May 2024 (n° 2024-449) moved it to article 1-1, II, in force since 23 May 2024. The consolidated text on Légifrance, "en vigueur au 16/10/2026", has it at article 1-1. The pages cite article 1-1.

What the texts rest on, read on 2026-10-16:

- Article 1-1 of the law, on Légifrance (https://www.legifrance.gouv.fr/loda/id/LEGITEXT000005789847). I lists what a publisher whose activity is publishing must make available. II lets a non-professional publisher give only the host's name and address, provided the host holds the publisher's identification details. III gives the right of reply, which goes to the host when the publisher stays anonymous, within three months.
- Article L34-5 of the code des postes et des communications électroniques (https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000042155961/): sending a message that promotes goods, services or the image of a seller to an individual's email address needs that person's prior consent, which must be free, specific and informed. Each message must show valid contact details to ask for the messages to stop, and the sender's identity cannot be hidden. The page read also notes a Constitutional Council decision of 25 June 2026 that finds the sixth, eighth and next-to-last paragraphs unconstitutional, with repeal postponed to 31 October 2027. By their position these are the paragraphs on the CNIL's oversight and on the fine, not the consent rule in the first paragraphs. To confirm.
- GDPR: the privacy page names the controller (responsable de traitement), the purpose, the legal basis (consent, article 6(1)(a)), the provider and its transfer to the United States, the retention, and the rights, with the right to complain to the CNIL (https://www.cnil.fr/fr/plaintes). The CNIL says the retention period has to be set by the controller in line with the purpose (https://www.cnil.fr/fr/les-durees-de-conservation-des-donnees). The period chosen is 30 days after an unsubscription or a request.
- Not covered here: whether a record of processing (registre des traitements) is needed, whether a data protection officer is needed, the consent evidence the provider keeps, and any duty of an EU representative. To confirm with the adviser.

Still open:

- The name of the data controller, marker `[[TODO-OWNER: data controller name]]` in `content/privacy.md`. The GDPR asks for the controller's identity and contact details in the information given to subscribers. A named controller and an anonymous publisher do not sit well together, so the adviser should say how to do both.
- Whether a site with a newsletter and a sponsorship plan counts as non-professional. The sponsorship page says it is not open, and nothing is sold at opening.

## 3. Host

Decided on 2026-10-16: Cloudflare, Inc. The details come from Cloudflare's own pages and are held in `site.config.json` under `host`, with the source and the date they were read: https://www.cloudflare.com/website-terms/ (section 15, "Cloudflare, Inc., located at 101 Townsend St., San Francisco, California 94107", and the phone line +1 (650) 319-8930 at the foot of the page), read on 2026-10-16. https://www.cloudflare.com/privacypolicy/ gives the same address and phone number. The legal notice and the privacy page read the values from the configuration.

Still open: Cloudflare's website terms say its network services are "pass-through network services ... not hosting provider services". The site would be served by Cloudflare Pages, which stores the files. Whether Cloudflare is the "fournisseur de services d'hébergement" of article 1-1 for that service is for the adviser. No Cloudflare account for the production site exists yet.

## 4. Name, domain and trademark

Open: the domain and the trademark checks. The owner chose "Rulefiles" on 2026-10-16, after the first candidate, "Agent Diffs", turned out to collide with existing projects (see `docs/BRAND-CLEARANCE.md`). The clearance of "Rulefiles" is in the same document. The INPI database could not be searched automatically, so the manual INPI search there is still to do, and an industrial property attorney should run a similarity search before any filing. Nothing is bought, filed or reserved. The domain `rulefiles.dev` in `site.config.json` is a provisional value: it is not bought and is not known to be buyable. After the choice, set `baseUrl` in `site.config.json` (or `SITE_URL` at build time). The placeholder `https://rulefiles.dev` triggers a build warning.

## 5. Contact addresses

Decided on 2026-10-16: three public role addresses on the provisional domain, set in `site.config.json`: `contact@rulefiles.dev` (general contact, corrections, right of reply), `privacy@rulefiles.dev` (personal data) and `sponsors@rulefiles.dev` (sponsorship). They are aliases that do not exist yet. They are to be set up with Cloudflare Email Routing after the domain is bought, see `docs/LAUNCH.md`. If the domain changes, the three values change with it.

## 6. Newsletter list

Decided on 2026-10-16: Buttondown, with Kit as the fallback, and the form stays disabled. No tracking of opens or clicks. Subscriber data is deleted within 30 days of an unsubscription or a request, unless the law requires otherwise. `docs/NEWSLETTER.md` has the setup steps for the day the owner gives the publication go, none of them executed, and `docs/LAUNCH.md` lists the Buttondown settings to check before opening. Still open: the data controller's name (a marker in `content/privacy.md`), the data processing terms accepted in the account, and then the form address (`NEWSLETTER_FORM_ACTION`). If the provider changes, `content/privacy.md` has to change with it, since it names Buttondown. Until the form is on, the site sends nothing.

## 7. Sponsorship

Decided on 2026-10-16: not open at launch, no rates and no figure published. `content/sponsors.md` states the editorial rules that would apply and the alias for questions.

## 8. Repository settings

Open: enable "Allow GitHub Actions to create and approve pull requests" for the weekly watch workflow, and protect `main`. Pull requests that the workflow opens with `GITHUB_TOKEN` do not start CI by themselves (see `docs/OPERATIONS.md`).

## 9. Data freshness

Before launch: re-read the cited official pages for every matrix cell, update `verifiedOn`, and read the terms of use of each source again. `npm run validate` warns about cells older than `staleAfterDays`.

## Fields to fill in

Each line is one marker, the file that holds it, and the item above it belongs to. Replace the whole `[[TODO-OWNER: ...]]` text with the real value. A test compares this list with the markers in `content/`, `scripts/lib/render.mjs` and `site.config.json`.

- `[[TODO-OWNER: data controller name]]` in `content/privacy.md`, item 2.

The placeholder domain is not a marker. The build reports `baseUrl` while it is still `https://rulefiles.dev`, the provisional domain that is not bought, item 4.

# Launch readiness

State on 2026-10-16. This file records the decisions taken for the first public version, the steps that only the owner can do, and what the build still reports. The owner reports that `rulefiles.dev` was bought on 2026-10-16 and that the three aliases route to a mailbox. Nothing is published, no email was sent and no newsletter issue exists. It is not legal advice, and the points listed under "To validate with an adviser" should be checked by one.

`docs/LAUNCH-BLOCKERS.md` holds the decisions item by item. `docs/HISTORY-REWRITE.md` holds the plan to remove the owner's personal email address from the commit history, and the record of how it was done on 2026-10-16.

## Decisions

| Topic | Decision |
| --- | --- |
| License | MIT for the code, CC BY 4.0 for the data and the text. Holder and credit name: "Rulefiles contributors" (to be confirmed by the owner). See `LICENSE` and `LICENSE-DATA.md`. |
| Publisher, version 1 | Non-professional publication with no income at opening. The publisher gives only the host's details and no postal address for the site, as article 1-1, II of loi n° 2004-575 du 21 juin 2004 allows. The legal notice names the owner, by name only, as publisher of the site and of the newsletter (see "Data controller"). |
| Host | Cloudflare, Inc. Details in `site.config.json` under `host`. |
| Contact | `contact@rulefiles.dev` (public, corrections, right of reply), `privacy@rulefiles.dev` (personal data), `sponsors@rulefiles.dev` (sponsorship). |
| Sponsors page | "Not open yet". No rate, no figure. |
| Newsletter | Buttondown. No open or click tracking. Subscriber data deleted within 30 days of an unsubscription or a request, and within 40 days for a signup never confirmed, unless the law requires otherwise. The newsletter opens at the publication go. The form stays disabled until then, as a step of the publication. |
| Data controller | The owner, by name only and with no postal address, as the person responsible for the newsletter data and as its publisher. The name is on the privacy page and in the legal notice, and `privacy@rulefiles.dev` is the only contact. The legal notice names the same person as publisher of the site, gives only the host's details and publishes no postal address. Decided by the owner on 2026-10-16, replacing the earlier choice of an anonymous controller. |
| Domain | `rulefiles.dev`, bought on 2026-10-16 at Cloudflare Registrar, with WHOIS privacy included (reported by the owner). The build no longer checks the domain. |

## What `npm run build:strict` reports today

It passes: no `[[TODO-OWNER: ...]]` marker is left, no placeholder sentence is left, and `baseUrl` is the release address. A test (`tests/launch.test.mjs`) freezes the list of remaining markers, and the list is empty. It runs the strict build on the real tree and fails if a marker, a placeholder sentence or a configuration placeholder comes back.

The domain is bought. The old guard on the provisional domain (`PLACEHOLDER_DOMAIN` in `scripts/lib/placeholders.mjs`, which made the build warn while `baseUrl` was `https://rulefiles.dev`) is removed, since that value is now the real one. The strict build still guards the base URL, with a different rule: `releaseProblems` in the same file, run only in strict mode, fails the build when `baseUrl` (after `SITE_URL` is applied) is anything other than `https://rulefiles.dev`. That rejects `localhost`, `example.com`, a `pages.dev` preview address, `http://` and `www.`. A preview build is not affected: it sets `SITE_URL` to its own address and runs `npm run build` without `--strict`, so it prints no warning and is not blocked. If the domain ever changes, edit `RELEASE_URL` in `scripts/lib/placeholders.mjs`, then `baseUrl`, `contactEmail`, `privacyEmail` and `sponsorContact` in `site.config.json`, in one commit. Tests in `tests/launch.test.mjs` keep `baseUrl`, the strict rule and the preview case. They also check that canonical links, Open Graph tags, sitemap, `robots.txt` and `llms.txt` use `https://rulefiles.dev`.

If a marker is added on purpose, add it to the expected list in `tests/launch.test.mjs` and to `docs/LAUNCH-BLOCKERS.md` in the same commit. The tests fail otherwise. The marker is named `TODO-OWNER`, so no personal name sits in the tooling, and `tests/launch.test.mjs` refuses the owner's first name and surname in every tracked file, in the built site and in the new commit messages. The only exception is the full name on `content/privacy.md` and `content/legal.md`, and on their built pages. A test checks that it is there and nowhere else.

## Dated legal pages

`content/legal.md`, `content/privacy.md` and `content/sponsors.md` carry `updated: 2026-10-16` in their front matter. The page template shows it at the foot of the page as "Last updated: 2026-10-16" and adds `dateModified` to the JSON-LD. Change the date by hand in the same commit as any change to the text of those pages. The build stops if the value is not written YYYY-MM-DD, and a test checks the three pages.

## Publisher giving only the host's details

Article 1-1, II of loi n° 2004-575 du 21 juin 2004, as consolidated on Légifrance and "en vigueur au 16/10/2026" (https://www.legifrance.gouv.fr/loda/id/LEGITEXT000005789847, read on 2026-10-16):

```
II.-Les personnes éditant à titre non professionnel un service de communication au public en ligne peuvent ne tenir à la disposition du public, pour préserver leur anonymat, que le nom, la dénomination ou la raison sociale et l'adresse du fournisseur de services d'hébergement, sous réserve d'avoir communiqué à ce fournisseur les éléments d'identification personnelle mentionnés au I du présent article.

Les fournisseurs de services d'hébergement sont assujettis au secret professionnel, dans les conditions prévues aux articles 226-13 et 226-14 du code pénal, pour tout ce qui concerne la divulgation de ces éléments d'identification personnelle ou de toute information permettant d'identifier la personne concernée. Ce secret professionnel n'est pas opposable à l'autorité judiciaire.
```

Article 1-1, III, first two paragraphs, on the right of reply:

```
III.-Toute personne nommée ou désignée dans un service de communication au public en ligne dispose d'un droit de réponse, sans préjudice des demandes de correction ou de suppression du message qu'elle peut adresser au service.

La demande d'exercice du droit de réponse est adressée au directeur de la publication ou, lorsque la personne éditant à titre non professionnel a conservé l'anonymat, au fournisseur de services d'hébergement, qui la transmet sans délai au directeur de la publication. Elle est présentée dans un délai de trois mois à compter de la mise à la disposition du public du message justifiant cette demande.
```

Numbering: before the law of 21 May 2024 (n° 2024-449), the same rule was article 6, III, 2 of the same law. The law of 2024 created article 1-1 and, in force since 2024-05-23, the rule now sits at 1-1, II. Article 1-2 punishes a breach of I and II of article 1-1 with one year of imprisonment and a EUR 75,000 fine for an individual, so the condition below matters. Article 6, IV, B of the law requires hosts to give publishers technical means to meet the identification rules of article 1-1, I.

What the owner has to do, which the site does not say and does not promise:

1. Give the host the identification details listed in article 1-1, I: for an individual, the surname, first names, home address and phone number. The Cloudflare pages read do not say how a customer gives these details or where Cloudflare records them, so ask Cloudflare, and keep a copy of its answer. The condition of the article is that the host holds them, so this has to be done before the site is published.
2. The legal notice uses the option of article 1-1, II: it gives the host's details and no postal address or phone number for the publisher. It names the owner, by name only, as publisher of the site and of the newsletter. It makes no statement about what the host holds. A lawyer should say whether this still fits article 1-1, II and III (see "To validate with an adviser").
3. A right of reply request is sent to the publisher at `contact@rulefiles.dev` or `privacy@rulefiles.dev`, with a copy to the host, which forwards it to the director of publication. Article 1-1, III sends the request to the host "when the person publishing on a non-professional basis has stayed anonymous". Whether that route is still the one provided when a name is published is to be confirmed by a lawyer. The director of publication is the publisher, so the owner has to answer within the legal delay: three days to insert the reply (article 1-1, III), and for a message sent by a periodic email that is not daily, in the next issue (décret n° 2007-1527 du 24 octobre 2007, article 4, https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000428279, read on 2026-10-16; the decree still uses the old numbering, "IV de l'article 6"). The decree also asks the host to forward a request within 24 hours (article 6) and the request to be sent by registered letter or any means that proves the sender and the receipt (article 1). Ask Cloudflare how it forwards such requests.
4. The publication has to stay non-professional. Article 1-1 does not define the term. Treat any income as a trigger: switch to the full notice (next section) before the first sponsor is booked, paid or invoiced, and before any affiliate link, advertising or paid plan goes live. Whether a newsletter with sponsor lines stays non-professional is a point for a lawyer. A breach of article 1-1, I and II is punished by article 1-2 with one year of imprisonment and a EUR 75,000 fine (same Légifrance source). The sentence "The site earns no income" in `content/legal.md` becomes false with the first euro, so it changes in the same pull request.

Cloudflare details used for the host, read on 2026-10-16:

- https://www.cloudflare.com/website-terms/, section 15: "The Websites and Online Services are operated by Cloudflare, Inc., located at 101 Townsend St., San Francisco, California 94107." The page ends with "+1 (650) 319-8930" and "Cloudflare, Inc. 101 Townsend St, San Francisco, CA 94107 USA".
- https://www.cloudflare.com/privacypolicy/: same address and phone number at the top of the page, and "Cloudflare, Inc. 101 Townsend St. San Francisco, CA 94107, Attention: Data Protection Officer" in section 19.
- https://www.cloudflare.com/contact/ lists sales phone numbers by country (France +33 1 73 01 52 44, US +1 (888) 99 FLARE). Those are sales lines and are not used.
- Cloudflare's abuse-reporting page (https://www.cloudflare.com/trust-hub/abuse-approach/, read on 2026-10-16) says Cloudflare might qualify as the origin hosting provider for Pages, Workers, Workers KV, Stream and Images. The host line is only right if the site files are stored on Cloudflare Pages, not only proxied by Cloudflare. To be confirmed by a lawyer.

Transfers to the host, for the privacy page (read on 2026-10-16):

- The privacy page links Cloudflare's data processing addendum (https://www.cloudflare.com/cloudflare-customer-dpa/) and privacy policy (https://www.cloudflare.com/privacypolicy/). The addendum defines the Standard Contractual Clauses (decision 2021/914) and the EU-U.S. Data Privacy Framework. Cloudflare's Data Privacy Framework entry (participant 5666, https://www.dataprivacyframework.gov/participant/5666) read "Active", with certification due on 2027-09-15 and the note "Re-certification under review". It could not be read again on the day of the review, so check it before publication.
- Before publication the owner checks that the addendum applies to the Cloudflare account that serves the site (a self-serve subscription agreement).
- The two links are written by hand in `content/privacy.md`. A test (`tests/legal.test.mjs`) fails if the host in `site.config.json` stops being Cloudflare while the links stay, so a change of host means changing the links and the sentence.

## Passage en activité pro

If the owner starts a professional activity (for example a micro-entreprise) or the site earns income, the legal notice has to give the full details of article 1-1, I, and the sentence that gives only the host's details goes. Fields to add:

- For an individual: surname, first names, home address, phone number. For a business set up as a company: its name, registered office, phone number.
- The registration number (SIREN or SIRET) if the person is registered at the RCS or the RNE as a craft business, and the share capital for a company (article 1-1, I, 1° and 2°).
- The name of the director of publication, and of the editor-in-chief if there is one (I, 3°). For a sole trader this is usually the owner.
- The host's name, address and phone number, already in place (I, 4°).
- If a company other than the host stores data that the site processes directly, such as the newsletter provider, its name, corporate name and address (I, 5°). To confirm with the adviser.
- To check with the adviser: VAT number and billing details once sponsorship invoices exist, the labeling of advertising (article 20 of loi n° 2004-575, https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000006421566/, read on 2026-10-16: an advertisement must be clearly identifiable as such and must make clearly identifiable the person it is made for, which is why `content/sponsors.md` asks a sponsor line to name its sponsor), and whether the home address can be replaced by a domiciliation address.

Files to change in the same pull request:

- `content/legal.md`: replace the "Publisher" section by the fields above, as markers `[[TODO-OWNER: ...]]` until the values are known. Keep the host section. Drop the sentence that gives only the host's details. State the director of publication. Send the right of reply to the director of publication.
- `content/privacy.md`: the controller is the person or company now identified.
- `tests/launch.test.mjs` and `docs/LAUNCH-BLOCKERS.md`: the expected list of markers.
- `tests/build.test.mjs`: the legal notice test, which today forbids publisher identity fields on the page.

## Contact addresses

The three addresses are aliases. The owner reports on 2026-10-16 that Cloudflare Email Routing now forwards `contact@`, `privacy@` and `sponsors@rulefiles.dev` to a private mailbox. The steps, kept as the record of the setup and as a checklist to re-check:

1. Put the domain on Cloudflare DNS. Email Routing needs it, per https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/ (read on 2026-10-16).
2. In Email Routing, onboard the domain. Cloudflare adds MX records and the SPF and DKIM TXT records.
3. Add and verify a destination mailbox, then create three routing rules: `contact`, `privacy` and `sponsors`, each sending to that mailbox.
4. Test each alias with a message sent from a different account.
5. Replies sent from the destination mailbox show that mailbox's address. If the owner does not want to show it, use a "send as" setup for the alias in the mail client.

Send a test message to each alias before the site is published, since the pages show these addresses.

## Newsletter

The owner reports that the free Buttondown account `rulefiles` exists (newsletter "Rulefiles"), with nothing published and nothing sent. Buttondown settings to check before the form is enabled, with the sources read on 2026-10-16:

- Open tracking and click tracking off. Buttondown describes both as opt-in: open tracking injects a tracking pixel (https://docs.buttondown.com/open-tracking), click tracking rewrites links through a proxy URL (https://docs.buttondown.com/click-tracking). Both live under the Tracking section of the Email settings (https://buttondown.com/blog/settings-cleanup, 2026-10-05). If tracking is turned off later, links already sent keep their tracking links and clicks on them are still recorded (click tracking page), so keep it off from the first issue.
- The UTM information add-on off (same blog post), and the web analytics add-on of the Archive settings off, because the privacy page says the site adds no tracking.
- Double opt-in on, which is the default.
- Subscriber deletion. The privacy page promises deletion within 30 days of an unsubscription or a request, and within 40 days for a signup that is never confirmed. Buttondown keeps a hidden record when a subscriber is deleted from the dashboard or by automatic cleanup. A permanent deletion needs the API call `DELETE /v1/subscribers/{id_or_email}` with API version 2024-09-30 or later, per https://docs.buttondown.com/deleting-and-recovering-data and https://docs.buttondown.com/subscriber-cleanup. Permanently deleted data stays in backups for up to two days (same page). Only the API call `DELETE /v1/subscribers/{id_or_email}` keeps that promise: the dashboard and the automatic cleanup only hide the subscriber. The owner sets a calendar routine, every 7 days, to delete permanently the addresses that are unsubscribed or blocked, and those that have stayed unconfirmed for more than 30 days (with the automatic cleanup on, Buttondown hides them after 7 and 30 days), and to handle erasure requests received at `privacy@`. With a 7-day routine the privacy page can promise 30 days after an unsubscription and 40 days for an unconfirmed signup. If the routine changes, change the durations in `content/privacy.md` in the same pull request. Buttondown's GDPR page says deletion requests from subscribers go to its support (https://buttondown.com/legal/gdpr-eu-compliance). The call has not been tried without an account: item 5 of "Before the publication go" tests it on a test subscriber before the form opens.
- Data processing agreement: https://buttondown.com/legal/data-processing-agreement (last updated 2026-09-17 on the page). Section 8.1 says personal data is processed in the United States, and section 8.2 applies the EU Standard Contractual Clauses, module 2, to transfers from the EEA. Annex II says services are hosted on Amazon Web Services. The agreement's customer is the data controller.
- Sub-processors: https://buttondown.com/legal/subprocessors (last updated 2026-09-17 on the page). Check again before opening.
- Not verified: the AWS region, whether the hosted subscribe and confirmation pages set cookies, the EU-US Data Privacy Framework status of Buttondown, and whether the agreement has to be accepted in the account.

## Data controller

Decided by the owner on 2026-10-16, replacing the earlier choice of an anonymous controller: the owner is the person responsible for the newsletter data, the messages sent to the three addresses and the request logs, and the publisher of the site and of the newsletter, named by name only. The name is on the privacy page ("Who is responsible") and in the "Publisher" section of the legal notice, and in no other file. No postal address is published, and the only contact is `privacy@rulefiles.dev`. A name answers the rule that the controller has to be identifiable (GDPR, article 13(1)(a)) and the rule of article L34-5 of the code des postes et des communications électroniques that the sender's identity is not hidden.

The decision n° 2026-1210 QPC of 25 June 2026 of the Conseil constitutionnel (https://www.conseil-constitutionnel.fr/decision/2026/20261210QPC.htm, read on 2026-10-16) declared the sixth, eighth and penultimate paragraphs of article L34-5 (the sanctions) unconstitutional, with a repeal postponed to 31 October 2027. The prohibitions themselves are unchanged. Whether a digest with no sponsor line counts as direct prospecting under L34-5, and whether one with sponsor lines does, is to be confirmed by a lawyer. The double confirmation of the form and the unsubscribe link cover the consent and the way to stop.

The newsletter opens at the publication go. The form stays disabled until then, because the site collects nothing before the form is on. This is a step of the publication, listed under "Before the publication go", and not a legal lock.

## To validate with an adviser

- Whether a site with a newsletter and a sponsorship plan stays "non-professional" under article 1-1, II.
- Whether Cloudflare counts as the host (fournisseur de services d'hébergement) for Cloudflare Pages. Its website terms, section 3, say its network services are "pass-through network services used to improve network performance, not hosting provider services".
- Whether the option of article 1-1, II (give only the host's details) still fits now that the owner is named as publisher of the site and of the newsletter, with no postal address. The legal notice no longer says the publisher is anonymous, and it no longer says the right of reply goes only to the host. Which route article 1-1, III provides when a name is published is to be confirmed by a lawyer. A registered letter, which the decree of 2007 names, needs an address that the pages do not publish.
- The controller for the other data. Decided by the owner on 2026-10-16: the owner, named, is also responsible for the messages sent to the three addresses and for the request logs. The privacy page now says so in "Who is responsible". Whether the owner or the host is the controller of the host's request logs is to be confirmed by a lawyer.
- The legal basis for the messages: the privacy page gives the legitimate interest in answering (GDPR, article 6(1)(f)). The wording is a proposal of form and is to be confirmed by a lawyer.
- Whether a name with no postal address meets article 13(1)(a) of the GDPR, which asks for the identity and the contact details of the controller, with `privacy@rulefiles.dev` as the contact. To be confirmed by a lawyer.
- The copyright holder name "Rulefiles contributors". It is not an identified person. The formula is common in open source and fits CC BY 4.0, section 3(a)(1)(A)(i), which allows a pseudonym. Articles L113-1, L113-5 and L113-6 of the code de la propriété intellectuelle (Légifrance, read on 2026-10-16) deal with the author, the collective work and the anonymous or pseudonymous author. To be confirmed by a lawyer. The README says that a contribution is licensed under the same terms.
- The extension of CC BY 4.0 to `content/` and `docs/*.md` also covers the legal notice and the privacy page. This is probably not intended. Clarify it if the owner wishes.
- The copyright status of text produced with AI tools. Not looked at, and for a lawyer.
- Whether French law applies. The files do not say where the publisher is established. If the publisher is established in the European Union, article 27 of the GDPR (representative in the Union) does not apply. Both points are to be confirmed by a lawyer.
- The JSON-LD types the publisher as an `Organization` named Rulefiles, while the legal notice says the site is published by a private individual. It is a brand name and changes nothing in law, and it can be changed if the owner prefers.
- Whether the short excerpts quoted in the digests stay within the French quotation exception (see `docs/LICENSE-RECOMMENDATION.md`).
- Messages sent to the three addresses. The privacy page now says they reach the owner, named, through Cloudflare Email Routing and a private mailbox, that they are used only to answer on the basis of the legitimate interest in answering (article 6(1)(f)), and that they are kept for 12 months after the exchange ends, then deleted. The owner deletes the older messages in a calendar routine, once a month. The 12 months is the owner's choice, and the legal basis is a proposal: both are to be confirmed by a lawyer.
- Registre des traitements, data protection officer, and consent evidence (see `docs/LAUNCH-BLOCKERS.md`).

## Before the publication go

Status on 2026-10-16:

1. Done on 2026-10-16 (reported by the owner): domain bought, `baseUrl` set, aliases routed. Send a test message to each alias.
2. Give the host the identification details (publisher who gives only the host's details).
3. Done on 2026-10-16: the owner is named, by name only, as controller and publisher of the newsletter. Send a test message to `privacy@rulefiles.dev`.
4. Check the Buttondown settings above. Keep the form disabled until the publication go. At the go, set the form address and enable the form (`docs/NEWSLETTER.md`). The texts that say the signup is off follow `newsletterEnabled(config)` in `scripts/lib/render.mjs`: the callout on the home page, the newsletter page (lead, status line, the sentence about the Atom feed, the heading and the page description), the word "planned" in the data sentence of `content/legal.md` and in the description of `content/privacy.md` (the `{{dataStatus}}` variable, "planned" or "collected"), and the first sentence of the "The newsletter" section of `content/privacy.md` (the `{{newsletterIntro}}` variable), and the statements of fact in the same section (what the provider records, the unsubscribe link, what the provider sends and stores, the hosted pages, the absence of tracking), which say "will" while the form is closed (the `{{nl...}}` variables of `scripts/lib/render.mjs`). They change by themselves once the form address is set. In the same pull request, update the two tests that describe the off state, which fail once the form address is set in `site.config.json`: "Content-Security-Policy meta tag locks scripts, styles and connections to self" (it expects `form-action 'self'` on the default build) and "newsletter form is disabled without a provider and enabled with one" (it expects the disabled form on the default build). Checked on 2026-10-16 by setting a form address temporarily: these two are the only tests that fail, because the assertions on the privacy and legal wording follow the configuration. Also change the `updated` dates of `content/privacy.md` and `content/legal.md`, then rebuild with `npm run build:strict`.
5. Check the deletion call on the real Buttondown account. The repository cannot call the Buttondown API without an account, so the promise of the privacy page (permanent deletion, which only `DELETE /v1/subscribers/{id_or_email}` gives) has not been tested. Before the go: create a test subscriber with an address the owner controls, keep it apart from real subscribers, then call `DELETE /v1/subscribers/{email}` with API version 2024-09-30 or later and an API key kept outside the repository. Check that the call succeeds and that the subscriber is gone, including from the list of deleted subscribers. If the call fails, or the plan gives no API access, the 7-day routine cannot keep the promise: switch off the automatic cleanup of the account, since it only hides records, and do not open the form until the deletion method or the wording of the privacy page is changed. Write the date and the result in `docs/NEWSLETTER.md`.
6. Done on 2026-10-16: the history was rewritten with option A (`docs/HISTORY-REWRITE.md`). The code lives in a new private repository, `darlol/rulefiles`. A backup bundle is kept outside the repository, and the old repository is archived and private. Deleting the old repository stays the owner's call.
7. Run `npm run build:strict`. It must pass with no output about placeholders. It passes today.
8. On the first deployment, before the site is announced, test the claim "the site sets no cookies" (`content/legal.md`, `content/privacy.md`): read the `Set-Cookie` headers of the home page and, once the form is on, of the signup and confirmation pages hosted by Buttondown. Check too that the postal address field of the email footer in Buttondown is empty, as the privacy page publishes no postal address.
9. Check each link of the privacy page and the legal notice on the deployed site.

## Before the repository becomes public

These items wait until the repository is public. Nothing on the built site needs them today.

1. Link the About page to `LICENSE` and `LICENSE-DATA.md` on the repository, and set `repoUrl` in `site.config.json`. It is empty today, since there is no public repository to point to, and the license text lives in the repository only.
2. The repository is now named `rulefiles` (option A, 2026-10-16), and `docs/OPERATIONS.md` shows the owner's GitHub handle in a command. A public repository shows the handle in its URL anyway, and the owner accepts that by publishing the name on the legal pages.
3. Apply the branch ruleset (`docs/ruleset-main.json`). GitHub refuses it while the repository is private on the free plan. The command and the settings already made are in `docs/OPERATIONS.md`, under "Recommended protection for main".
4. Decide what happens to the old, archived repository. Deleting it is the owner's call.

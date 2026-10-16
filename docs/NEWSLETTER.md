# Newsletter tools

Checked on the vendors' own pages on 2026-10-15. The beehiiv row and everything about Buttondown were checked again on 2026-10-16. Prices and limits change often, so the check has to be repeated before signing up. No account was created and no email was sent.

## Decision

The owner retained Buttondown on 2026-10-16, with Kit as the fallback. The signup form stays disabled until the publication go: `newsletter.formAction` in `site.config.json` stays empty, so the site sends nothing and collects nothing. Nothing in this file has been executed.

## What the site needs

- A signup form that posts to the vendor over HTTPS. The site itself stores nothing.
- Double opt-in, so that every address is confirmed by its owner.
- Export and deletion of subscriber data, for GDPR requests.
- An API that a bot can call, ideally on the free plan, so a weekly issue can be created as a draft from the digest JSON. A human sends it.

## Comparison

| Tool | Free plan, as stated on the vendor page | Double opt-in | Export | API on the free plan | Source |
| --- | --- | --- | --- | --- | --- |
| Buttondown | Free for the first 100 subscribers. Includes a markdown editor, sending from a custom domain, hosted archives. Add-ons cost extra per month. | Required by default for every newsletter | CSV export from the dashboard. The file includes IP address and creation date when present. | The features page says yes, on all plans including free (https://buttondown.com/features/api). The drafting guide carries a "paid feature" tag for the API (https://docs.buttondown.com/drafting-emails-via-the-api), so this is to confirm when an account exists. No official MCP server or SDK. | https://buttondown.com/pricing, https://docs.buttondown.com/double-opt-in, https://docs.buttondown.com/data-exports-subscriber, https://buttondown.com/features/api, https://docs.buttondown.com/drafting-emails-via-the-api |
| Kit | Free for up to 10,000 subscribers, unlimited broadcasts, forms and landing pages, API access. Automations, sequences and RSS campaigns need a paid plan. Free accounts are in the Creator Network recommendations, which can be turned off. | Not verified | Not verified | Yes, listed as included | https://help.kit.com/en/articles/16627071-the-kit-free-plan, https://kit.com/pricing |
| beehiiv | Free for up to 2,500 subscribers, unlimited sends. API access except the Send API. Custom domains, custom HTML and automations need a paid plan. Lite is listed from 49 USD per month billed annually (588 USD per year) for up to 1,000 subscribers, and 59 USD per month billed monthly for that tier. The page itself says not to read exact prices from its HTML price slider. | Not verified | Data exports listed on all plans | Yes, except the Send API (Pro only) | https://www.beehiiv.com/pricing |
| MailerLite | Free for up to 250 subscribers and 2,500 emails per month. Sending is locked above 250 subscribers. | Not verified | Not verified | Limited. The page says sending through the API or MCP needs a paid plan. | https://www.mailerlite.com/pricing |
| Substack | Publishing is free at any size. Substack keeps 10 percent of paid subscription revenue. | Not verified | Not verified | No public API was checked | https://support.substack.com/hc/en-us/articles/360037607131-How-much-does-Substack-cost |
| Brevo | A free plan exists with up to 300 emails per day, per the vendor FAQ. The rest of the page was not reviewed. | Not verified | Not verified | Not verified | https://www.brevo.com/pricing/ |

"Not verified" means the statement was not found on a vendor page during this check. It does not mean the feature is missing.

## Data location and GDPR

Buttondown, read on 2026-10-16:

- The company is Buttondown, LLC, 406 W Franklin St. #201, Richmond, VA 23221, United States. Its data processing agreement (last updated 2026-09-17) says personal data is transferred to and processed in the United States, and that transfers from the EEA are governed by the EU Standard Contractual Clauses (Module 2, controller to processor), which are deemed signed by entering the agreement. Source: https://buttondown.com/legal/data-processing-agreement.
- For a subscriber it stores the email address and the IP address and referrer-level metadata of the signup (https://buttondown.com/legal/gdpr-eu-compliance). The processing details in the agreement also list analytics on email engagement (opens and clicks).
- It says all unsubscribe, data copy and deletion requests are honored immediately, that deletion goes through its support team (support@buttondown.com), and that data is not sold or used for advertising.
- Sub-processors listed on 2026-09-17: Amazon Web Services, Cloudflare, Google Workspace, Heroku, Mailgun, Plain, Postmark, Sentry, Slack, Stripe and Twilio (https://buttondown.com/legal/subprocessors). The agreement says services are hosted on Amazon Web Services.
- Double opt-in is required by default, and Buttondown refuses to disable it for plain signup forms without upstream verification (https://docs.buttondown.com/double-opt-in).
- In the agreement, the customer is the data controller and Buttondown the processor. So the site owner is the responsable de traitement.

Not verified: whether Buttondown is certified under the EU-US Data Privacy Framework, whether its hosted pages (the subscribe and confirmation pages) set cookies, and which AWS region is used.

Retention, read on 2026-10-16 at https://docs.buttondown.com/deleting-and-recovering-data and https://docs.buttondown.com/subscriber-cleanup: deleting a subscriber from the dashboard or by automatic cleanup removes them from the list but keeps a hidden record, so that an unsubscribed address is not added back by an import. A permanent deletion goes through the API (`DELETE /v1/subscribers/{id_or_email}`, API version 2024-09-30 or later). Permanently deleted data stays in the provider's backups for up to two days. The privacy page promises deletion within 30 days after an unsubscription and within 40 days for a signup never confirmed. Only the permanent deletion keeps that promise, so a routine every 7 days has to use it, for the unsubscribed and blocked addresses and for those unconfirmed for more than 30 days.

MailerLite states that its data centre is in the European Union and that it has GDPR controls (https://www.mailerlite.com/pricing). For Kit and the other tools, hosting location and data processing agreements were not checked.

Whatever tool is chosen, the privacy page in `content/privacy.md` has to name it, the data it receives (the email address, and what the vendor logs, such as the IP address), the transfer outside the EU and the way to ask for deletion.

## Why Buttondown, and what it costs

It requires double opt-in, exports to CSV, offers an API that is meant to include the free plan, and the free tier is enough for a first list. A bot can create each issue as a draft from `data/digest/*.json`, and a person sends it. No script for this exists in the repository yet.

Prices read on https://buttondown.com/pricing on 2026-10-16:

- Free for the first 100 subscribers. That includes the editor, sending from a custom domain, hosted archives and "privacy-first".
- Add-ons per month: tagging and segmentation, paid subscriptions, comments and surveys, analytics, RSS-to-email, sponsorships and email attachments at 9 USD each. Archives on a custom domain, multiple newsletters and automations at 29 USD each. Whitelabeling and teams at 79 USD each.
- The page says its prices assume at most one email a day, and that it charges for active subscribers.
- Price beyond 100 subscribers: not verified. The page prices it with a slider, and the fetched text only showed the free tier. A third-party site (https://newslettermath.com/platforms/buttondown) says 9 USD per month up to 1,000 subscribers and 29 USD up to 5,000, and the 2022 vendor post is marked "this might be a little outdated", so neither counts as a verified price. To read on the page with a browser before the list grows.

Limits to know about:

- The export contains IP addresses, which are personal data.
- The weekly digest does not need any add-on. Analytics (opens and clicks) is an add-on, and tracking is a privacy page decision, see below.

Kit is the fallback if the list grows past 100 quickly. Its free plan goes to 10,000 subscribers and includes API access, according to https://help.kit.com/en/articles/16627071-the-kit-free-plan. On 2026-10-16 the https://kit.com/pricing page showed features but no readable prices. Its double opt-in, export behavior and data processing terms are not verified.

## Steps when the owner gives the publication GO

Not executed. Each step needs the owner, and the form stays disabled until the last one.

1. Create the Buttondown account with the owner's own address, and pick the newsletter username. This creates the account, so it is the owner's act.
2. In the newsletter settings, set the name, the description, the sender name and a reply-to address. Use `privacy@rulefiles.dev`, the address on the privacy page. Check what Buttondown adds to the footer of each email (sender identity and unsubscribe link), since French law requires the sender to be identifiable and to offer a way to stop receiving messages (code des postes et des communications électroniques, article L34-5).
3. Leave double opt-in on, which is the default. Do not ask for an exception.
4. Opens and clicks are not tracked (decided on 2026-10-16, and stated on the privacy page). In the email settings, check that click tracking and open tracking are both off, and that the UTM add-on is off. Check that the web analytics add-on of the archive settings is off too. See `docs/LAUNCH.md` for the sources.
5. Check the data processing terms and the sub-processor list in the account, then record the date. Check whether the hosted subscribe and confirmation pages set cookies, since the site claims none for itself and the privacy page says the confirmation page is Buttondown's.
6. Send a test: subscribe an address the owner controls, confirm it, read the confirmation email, unsubscribe, export the list to CSV, then delete the test subscriber.
7. If the sending domain is custom, add the DNS records Buttondown asks for (SPF, DKIM, DMARC) once the domain exists.
8. Optional: create an API key under the API section of the settings and store it as a repository secret. Check on the account that the API works on the free plan before relying on it. The weekly draft script does not exist yet.
9. The owner is named on the privacy page as the person responsible for the newsletter data and its publisher, by name only, with `privacy@rulefiles.dev` as the contact. Retention is decided: 30 days after an unsubscription, 40 days for an unconfirmed signup, with a deletion routine every 7 days. Set up the deletion routine in `docs/LAUNCH.md`.
10. Last, enable the form (next section) and build with `npm run build:strict`.

## Enabling the form on the site

Buttondown documents an HTML form endpoint that accepts a plain form post (https://docs.buttondown.com/building-your-subscriber-base). The page says to point a form at `https://buttondown.com/api/emails/embed-subscribe/<username>`, and not to call it with `fetch`, because the subscriber sometimes has to follow Buttondown's response to pass a captcha. The site's form is a plain post, so it fits. The setting would be:

```
"newsletter": {
  "provider": "Buttondown",
  "formAction": "https://buttondown.com/api/emails/embed-subscribe/<username>",
  "method": "post",
  "emailFieldName": "email",
  "hiddenFields": { "embed": "1" }
}
```

The `embed` field and the exact endpoint come from a search summary of Buttondown's documentation and were not seen in the fetched page text, so check them on the account's embed settings page. The build adds the form's origin to the `form-action` directive of the Content-Security-Policy header by itself. Set the value in `site.config.json`, or with `NEWSLETTER_FORM_ACTION` at build time, as described in `docs/OPERATIONS.md`. Left empty, the form stays disabled and the site sends nothing. Once the address is set, the newsletter page and the first sentence of the newsletter section on the privacy page stop saying that signup is off; update the `updated` date in `content/privacy.md` in the same pull request.

## Still not verified

- Buttondown price beyond 100 subscribers.
- Whether the API works on the free plan (the features page and a docs tag disagree). The deletion call `DELETE /v1/subscribers/{email}` has to be tried on a test subscriber before the go (`docs/LAUNCH.md`, "Before the publication go", item 5), and the result written here.
- Buttondown cookies on its hosted pages, Data Privacy Framework status and AWS region.
- The exact form fields above.
- Kit: double opt-in, export, data processing terms, and prices.
- Everything marked "Not verified" in the comparison table.

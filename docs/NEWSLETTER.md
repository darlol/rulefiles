# Newsletter tools

Checked on 2026-10-15 on the vendors' own pages. Prices and limits change often, so repeat the check before signing up. No account was created and no email was sent.

## What the site needs

- A signup form that posts to the vendor over HTTPS. The site itself stores nothing.
- Double opt-in, so that every address is confirmed by its owner.
- Export and deletion of subscriber data, for GDPR requests.
- An API that a bot can call, ideally on the free plan, so a weekly issue can be created as a draft from the digest JSON. A human sends it.

## Comparison

| Tool | Free plan, as stated on the vendor page | Double opt-in | Export | API on the free plan | Source |
| --- | --- | --- | --- | --- | --- |
| Buttondown | Free for the first 100 subscribers. Includes a markdown editor, sending from a custom domain, hosted archives. Add-ons cost extra per month. | Required by default for every newsletter | CSV export from the dashboard. The file includes IP address and creation date when present. | Yes. The vendor says the API is available on all plans, free included. No official MCP server or SDK. | https://buttondown.com/pricing, https://docs.buttondown.com/double-opt-in, https://docs.buttondown.com/data-exports-subscriber, https://buttondown.com/features/api |
| Kit | Free for up to 10,000 subscribers, unlimited broadcasts, forms and landing pages, API access. Automations, sequences and RSS campaigns need a paid plan. Free accounts are in the Creator Network recommendations, which can be turned off. | Not verified | Not verified | Yes, listed as included | https://help.kit.com/en/articles/16627071-the-kit-free-plan, https://kit.com/pricing |
| beehiiv | Free for up to 2,500 subscribers, unlimited sends. API access except the Send API. Custom domains, custom HTML and automations need a paid plan. Paid plans start at 59 USD per month billed monthly. | Not verified | Data exports listed on all plans | Yes, except the Send API (Pro only) | https://www.beehiiv.com/pricing |
| MailerLite | Free for up to 250 subscribers and 2,500 emails per month. Sending is locked above 250 subscribers. | Not verified | Not verified | Limited. The page says sending through the API or MCP needs a paid plan. | https://www.mailerlite.com/pricing |
| Substack | Publishing is free at any size. Substack keeps 10 percent of paid subscription revenue. | Not verified | Not verified | No public API was checked | https://support.substack.com/hc/en-us/articles/360037607131-How-much-does-Substack-cost |
| Brevo | A free plan exists with up to 300 emails per day, per the vendor FAQ. The rest of the page was not reviewed. | Not verified | Not verified | Not verified | https://www.brevo.com/pricing/ |

"Not verified" means I did not find the statement on a vendor page during this check. It does not mean the feature is missing.

## Data location and GDPR

- MailerLite states that its data centre is in the European Union and that it has GDPR controls (https://www.mailerlite.com/pricing).
- Buttondown states that double opt-in is its default and that confirmed consent is evidence for GDPR (https://docs.buttondown.com/double-opt-in). Where it hosts data was not checked.
- For the other tools, hosting location and data processing agreements were not checked.

Whatever tool is chosen, the privacy page in `content/privacy.md` has to name it, the data it receives (the email address, and whatever the vendor logs such as the IP address), and the way to ask for deletion.

## Recommendation

Buttondown for the start. It requires double opt-in, exports to CSV, exposes the API on the free plan, and the free tier is enough for a first list. A bot can create each issue as a draft from `data/digest/*.json` and a person sends it.

Limits to know about:

- The free plan ends at 100 subscribers. Beyond that, the price on the pricing page depends on a slider that I could not read as numbers, so the cost at 500 or 1,000 subscribers is unverified.
- The export contains IP addresses, which are personal data.

Kit is the fallback if the list grows past 100 quickly, since its free plan goes to 10,000 subscribers and includes the API. Its double opt-in and export behavior still has to be checked before use.

## Enabling the form on the site

Set `NEWSLETTER_FORM_ACTION` to the vendor's form URL at build time, as described in `docs/OPERATIONS.md`. Left empty, the form stays disabled and the site sends nothing.

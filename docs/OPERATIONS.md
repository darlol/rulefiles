# Operations

The GitHub repository is `darlol/rulefiles`, and it is private. It was created on 2026-10-16 when the history was rewritten (`docs/HISTORY-REWRITE.md`). Nothing in the code depends on the repository name.

## Hosting

The build output is plain files in `dist/`. Any static host works. Facts below come from the providers' pages, checked on 2026-10-15.

| Host | Free tier fact | Fit for a protected preview |
|---|---|---|
| GitHub Pages | Available for public repositories on GitHub Free. Private repositories need Pro, Team or Enterprise. Pages sites are public on the internet even when the repository is private. https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site | No: it is either public or unavailable on the free plan. |
| Cloudflare Pages | Free plan: 500 builds per month, 20,000 files per site, 25 MiB per file, unlimited preview deployments. https://developers.cloudflare.com/pages/platform/limits/ | Needs a Cloudflare account. Access protection for previews was not checked. |
| Netlify | Free plan with a 300 credit limit, unlimited deploy previews, "private by default until you publish". https://www.netlify.com/pricing/ | Needs a Netlify account. The meaning of "private by default" was not tested. |

No account has been created. To get a preview URL, the owner has to sign in to one of the two providers, or decide to make the repository public for GitHub Pages.

Set `SITE_URL` to the preview URL before building so canonical links, the sitemap, the feed and llms.txt point at the right place:

```
SITE_URL=https://example-preview.pages.dev npm run build
```

Build command for a preview on either provider: `npm run build`. It prints a `LAUNCH WARNING` for each placeholder and still succeeds. The build command for a release is `npm run build:strict`, which fails, and deletes `dist/`, while any `[[TODO-OWNER: ...]]` marker or older placeholder sentence remains, or while the base URL is not `https://rulefiles.dev`. A preview build (`npm run build` with `SITE_URL` set) is not strict and is not affected. `RULEFILES_STRICT=1 npm run build` does the same. Output directory: `dist`. No install step is needed.

## Sitemap dates and headers

- `sitemap.xml` gives every URL a `lastmod` that is the date of its content, never the build date. Home, `/digest/`, the digest pages, `/data/digests.json` and `/digest/feed.xml` use the `verifiedOn` date of the digest they show. `/matrix/` and `/data/matrix.json` use the matrix `lastReviewed` date. A content page uses `updated` from its front matter. A page made by code (`/generator/`, `/newsletter/`) and `/about/` take their date from `pageUpdated` in `site.config.json`. Change that date in the pull request that changes the page. The two code-made pages and `/about/` carry 2026-10-16, the launch day, because the history of this repository was rewritten that day and git dates tell nothing earlier. `/data/*.json` and the feed are in the sitemap so that crawlers find them.
- The Atom feed gives each entry `<published>` and `<updated>`. Both are the `verifiedOn` date of the digest, the same date as `datePublished` in the page's Article data. The digest files hold no separate publication date.
- Structured data: `/digest/` carries a `Dataset` for `/data/digests.json` next to its `CollectionPage`. The Organization (publisher, author and creator) has a `logo`, which is the site mark `/favicon.svg`. The mark is the only logo-like file in the project (see `docs/DESIGN.md`). If the owner does not want it to count as a logo, remove the `logo` line in `publisher()` of `scripts/lib/render.mjs`.
- Every page has `twitter:card`, `twitter:title` and `twitter:description`. There is no `twitter:site` and no `twitter:creator`, because the project has no account on X.
- `_headers` sets `Strict-Transport-Security: max-age=15552000` (180 days) for `https://rulefiles.dev/*` only. Why it is set this way: the Cloudflare Pages `_headers` file accepts an absolute `https` URL as a rule (https://developers.cloudflare.com/pages/configuration/headers/, read 2026-10-16), so the header goes to the apex host only. `www.rulefiles.dev` answered 200 on 2026-10-16 with the same files, so it is a second host of the same Pages project, and it does not get the header. There is no `includeSubDomains` and no `preload`: both would bind every subdomain of `rulefiles.dev`, including any added later for mail or tools, to HTTPS for months, and preload cannot be undone quickly. The build writes the rule only when `baseUrl` is the release address, so a preview on `*.pages.dev` never carries it. HSTS is sticky: a browser that has seen it refuses plain HTTP and certificate errors for 180 days. Both hosts answered over HTTPS on 2026-10-16. To raise the duration, change `HSTS` in `scripts/lib/render.mjs`. To turn it off, set `max-age=0` for one deployment, then remove the rule. Cloudflare's own HSTS setting (SSL/TLS, Edge Certificates) is the other way to do it. Do not turn on both with different values.

## Web Analytics

Visits are counted with Cloudflare Web Analytics, in the automatic setup of the zone. Account: see the connector, zone `rulefiles.dev` `d8b4efd6ab5f552f89a886da8dd789df`. Cloudflare adds the beacon `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/v..." integrity="sha512-..." crossorigin="anonymous" data-cf-beacon=...>` to the HTML at the edge, as it is served, and the beacon posts to `/cdn-cgi/rum` on the same host. Nothing is added to the templates and no Cloudflare token is in the repository, so `dist/` never contains the tag and the tests on `dist/` cannot see it. The `site_tag` comes from the activation call, which is made after the deployment that carries the CSP below.

- CSP dependency. The policy in `csp()` of `scripts/lib/render.mjs` (meta tag and `_headers`) allows `script-src 'self' https://static.cloudflareinsights.com` and `connect-src 'self'`. The host alone is used on purpose: the injected path is versioned (`/beacon.min.js/v...`), and the source `.../beacon.min.js` given in Cloudflare's FAQ is an exact path in CSP3, so it would not match. With the old `script-src 'self'` and `connect-src 'none'` the browser blocks both the script and the post. Deploy the CSP before turning the setup on.
- `Referrer-Policy: same-origin`. Cloudflare's FAQ says the Referer header is required for the beacon post, and a visit is a page view whose referrer is another site. With `same-origin` the referrer goes to `rulefiles.dev` only, and links to other sites still receive nothing.
- Never set `Cache-Control: no-transform` on HTML: Cloudflare then stops adding the beacon. A test fails if `_headers` contains it.
- The zone is on the Free plan, so the beacon goes to every proxied host of the zone, `www.rulefiles.dev` included. `rulefiles.pages.dev` is outside the zone and gets none. Do not also turn on the Pages toggle (Metrics, Web Analytics): that would add a second snippet.
- Rollback: `PUT /accounts/{account_id}/rum/site_info/{site_tag}` (account id: see the connector) with `{"zone_tag": "d8b4efd6ab5f552f89a886da8dd789df", "auto_install": true, "enabled": false}`, or `DELETE` on the same path. The wider CSP can stay in place. If Web Analytics is removed for good, change `content/privacy.md`, `content/sponsors.md`, the footer and `llms.txt` in the same pull request.

## Newsletter

The form is on while `newsletter.formAction` holds an https form endpoint (since 2026-10-16 it is the Buttondown embed endpoint of the `rulefiles` newsletter), and off when it is empty. To close it again, empty `newsletter.formAction`. A build with `NEWSLETTER_FORM_ACTION` set to an empty value closes it too, which is what the tests use. To change the endpoint, set `newsletter.formAction` in `site.config.json`, or the `NEWSLETTER_FORM_ACTION` variable at build time, then add any provider-specific hidden fields under `newsletter.hiddenFields`. The CSP then allows that one form origin, for `form-action` only. If the provider changes, change `content/privacy.md` in the same pull request, since it names the provider and its sub-processors.

## IndexNow

IndexNow is a protocol that tells the participating search engines which URLs of a site changed. The protocol is described at https://www.indexnow.org/documentation (read on 2026-10-16). Facts taken from it:

- The key has 8 to 128 characters: lowercase and uppercase letters, digits and dashes.
- Ownership is proved by a UTF-8 text file `{key}.txt` at the root of the host, containing the key. The documentation says the search engines crawl that file after a submission and keep using the key until it changes.
- A set of URLs goes in one POST with `Content-Type: application/json; charset=utf-8` and the body `{"host": ..., "key": ..., "urlList": [...]}`, up to 10,000 URLs per request. The URLs must belong to the host.
- HTTP 200 means the URLs were received, 202 means received with the key validation pending. 400 is an invalid format and 429 is too many requests (possible spam). The table also lists a case for a key that is not valid (key file not found, or found without the key) and a 422 for URLs that do not belong to the host or a key that does not match the protocol schema. Any code other than 200 and 202 makes the script fail.
- The documentation says that engines which adopt the protocol share the submissions with the other participating engines. The list of participating engines is at https://www.indexnow.org/searchengines.json (on 2026-10-16: Bing, Yandex, Seznam, Naver, Yep, Internet Archive, Amazonbot). Google is not on that list, so this does not notify Google. Google Search Console and the sitemap are the way to reach Google.

What the repository does:

- `site.config.json` holds `indexNowKey`, a random 32-character hex string made for this site, with no link to a person. The build writes `dist/<key>.txt` with the key in it. The key is public by design, so it is not a secret and no secret is stored anywhere.
- `scripts/indexnow.mjs` (`npm run indexnow -- ...`) reads `dist/sitemap.xml` and posts the chosen URLs to `https://api.indexnow.org/indexnow`. It sends nothing unless `--send` is given. The endpoint is the shared one named in the brief of this change. The documentation page read says only "the URL provided by the search engine", so check it against the engines' pages if a request is refused, and change it with `--endpoint`.
- The tests use a mocked `fetch`. No test and no CI step calls IndexNow.

Where the ping runs. The site is deployed to Cloudflare Pages by uploading the build, and no workflow in this repository deploys it, so no workflow can say "after the deployment". The ping is a manual step after the new build answers on https://rulefiles.dev:

1. Check that `https://rulefiles.dev/<key>.txt` answers 200 with the key (`curl -s https://rulefiles.dev/<key>.txt`).
2. `npm run build:strict`, then `npm run indexnow -- --since YYYY-MM-DD` with the date of the previous deployment. It lists the URLs and sends nothing. A URL without `lastmod` in the sitemap is listed as well, since its date is unknown.
3. Add `--send` to post them. Expect `IndexNow answered HTTP 200` or `202`.

Do it once per deployment, not more: the documentation asks to submit when content is added, updated or deleted, and a 429 means too many requests. If the deployment later moves to a GitHub workflow, add a step after the deploy step that runs the same command with `--send`. It needs no secret.

## CI

- `.github/workflows/ci.yml` runs on pushes and pull requests: `npm ci`, validate, build, test, check links, on Node 20 and 22. The only dev dependency is `yaml`, used by the generator tests to parse the frontmatter that the generator writes.
- `.github/workflows/weekly-watch.yml` runs every Monday at 06:17 UTC and on demand, with a 15 minute timeout. It runs the watch script, validates the drafts, then runs `scripts/open-watch-pr.sh`, which commits on a new branch and opens a draft pull request. It never deploys. The checkout does not keep credentials. The push passes the token for that one command only. The branch name holds the date, the run id and the attempt number, so a second run on the same day does not collide with the first. The repository setting "Allow GitHub Actions to create and approve pull requests" must be on for the pull request step.
- A manual run has a `dry_run` input (boolean, off by default). With it on, the workflow fetches the feeds, validates the drafts and makes the commit on the runner, then stops before the push and before `gh pr create`. The log of the last step shows the branch name and the files of the commit.
- A pull request opened with `GITHUB_TOKEN` does not start other workflows, so CI does not run on the watch pull request by itself. A person can close and reopen it, or push a commit from their own account, and CI then runs. This was not tested here.
- One test reads the commit messages of `origin/main..HEAD` to keep the owner's name out of them (`tests/launch.test.mjs`). The CI checkout fetches one commit and has no `origin/main`, and on `main` itself the range is empty, so there the test is reported as skipped with its reason, not passed. It runs in a full clone before a push: `git fetch origin && npm test`.
- Actions are pinned to commit SHAs. The workflows use the built-in `GITHUB_TOKEN` and no other secret.

## Testing the weekly watch

Done locally on 2026-10-16, with no write to GitHub:

- `actionlint` 1.7.12 (checksum compared with the release's checksums file) finds nothing in the two workflows, and `shellcheck` 0.11.0 finds nothing in `scripts/open-watch-pr.sh`. `act` needs Docker, which was not installed on the machine used for the checks, so it was not run.
- `node scripts/watch.mjs` ran against the four real feeds with the polite fetcher: 10 requests the first time (robots.txt files and feeds), 4 cache hits and 0 requests the second time, 230 entries parsed, 15 new changes since 2026-10-06, two draft files written, `npm run validate` passed on them.
- `scripts/open-watch-pr.sh` ran in a scratch clone whose remote was a local bare repository and whose `gh` was a stub. A dry run left the remote untouched and called nothing. A real run pushed `watch/2026-10-16-555-2`, called `gh pr create --draft --base main --head watch/2026-10-16-555-2`, and left no token and no extraheader in `.git/config`.
- `tests/watch-workflow.test.mjs` repeats those cases in CI with a stub `gh`: nothing to commit, dry run, real run, three runs on one day, and a missing run id or token.

Still to check on GitHub, once, with Actions > Weekly watch > Run workflow:

1. Run with `dry_run` on. The run must be green, and the last step must print "Dry run" and the branch it would push. This checks the checkout, Node setup, network access to the feeds from the runner and the validation step.
2. Turn on "Allow GitHub Actions to create and approve pull requests" in the repository settings, then run with `dry_run` off. This checks that the push with the extraheader is accepted, that `gh pr create --draft` works with `GITHUB_TOKEN`, and that the branch rules let `watch/*` branches be created.
3. Check that CI does not start on the new pull request by itself, and that closing and reopening it starts CI. The first half is documented by GitHub, the second half has not been seen here.
4. Check that the schedule fires on its own on the next Monday. A `cron` trigger cannot be tried by hand.

## Recommended protection for main

`docs/ruleset-main.json` is a repository ruleset for the default branch. It requires a pull request, with squash merges only and conversations resolved, requires the two CI checks `test (20)` and `test (22)` to pass on an up to date branch, blocks force pushes and blocks deleting the branch. It asks for no approving review (`required_approving_review_count` is 0) because the repository has one owner. Raise that number if a second reviewer joins. The ruleset has no bypass actor.

It has not been applied. On 2026-10-16 GitHub refused it on this repository with the message "Upgrade to GitHub Pro or make this repository public": rulesets are not available on a private repository on the free plan. Apply it as soon as the repository is public, for example with `gh api --method POST repos/darlol/rulefiles/rulesets --input docs/ruleset-main.json`, or by pasting the same values in Settings, Rules, Rulesets. The names of the checks come from the job name and the Node versions in `.github/workflows/ci.yml`, and a test fails if the two drift apart. The `test (20)` and `test (22)` checks only exist after CI has run once on the repository.

Until then nothing blocks a direct push, a force push or the deletion of `main`, so the owner merges through pull requests by habit. Already set on 2026-10-16, as reported by the owner: squash merges only, "Allow GitHub Actions to create and approve pull requests" on, and the two GitHub email settings ("Keep my email addresses private" and "Block command line pushes that expose my email") on.

The weekly watch pushes branches named `watch/...` and opens a pull request, so it fits this ruleset as long as the repository setting for creating pull requests with Actions is on. A pull request opened that way does not start CI by itself, so the required checks stay pending until someone closes and reopens it.

## Launch checklist

1. Settle every item in [LAUNCH-BLOCKERS.md](LAUNCH-BLOCKERS.md): license, publisher identity and legal notice, host, domain, contacts, newsletter list, sponsorship, repository settings. [LAUNCH.md](LAUNCH.md) says what the strict build reports today and what to do before the go.
2. Run `npm run build:strict`. It must succeed, which means no marker and no placeholder sentence is left and the base URL is `https://rulefiles.dev`. Use the same command as the release build on the host.
3. Re-verify every matrix cell dated more than 30 days ago.
4. Read the terms of use of each source again before publishing.

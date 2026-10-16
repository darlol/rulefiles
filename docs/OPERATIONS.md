# Operations

The GitHub repository is still called `darlol/agent-diffs`, from the project's first name. The owner may rename it later; GitHub redirects the old address, but the links in this file, the checks in the branch ruleset and any clone remote then need a look. Nothing in the code depends on the repository name.

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

## Newsletter

The form stays off until an https form endpoint is set. Set `newsletter.formAction` in `site.config.json`, or the `NEWSLETTER_FORM_ACTION` variable at build time, then add any provider-specific hidden fields under `newsletter.hiddenFields`. The CSP then allows that one form origin. Before enabling it, name the provider and the responsible person on the privacy page (`content/privacy.md`) and turn on double opt-in at the provider.

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

It has not been applied. The owner applies it, for example with `gh api --method POST repos/darlol/agent-diffs/rulesets --input docs/ruleset-main.json`, or by pasting the same values in Settings, Rules, Rulesets. The names of the checks come from the job name and the Node versions in `.github/workflows/ci.yml`, and a test fails if the two drift apart. GitHub's documentation says rulesets are available in public repositories on GitHub Free, and in private repositories on GitHub Pro, Team and Enterprise Cloud. The repository is private and the owner's plan is not known here, so it is not checked whether the ruleset can be enabled today.

The weekly watch pushes branches named `watch/...` and opens a pull request, so it fits this ruleset as long as the repository setting for creating pull requests with Actions is on. A pull request opened that way does not start CI by itself, so the required checks stay pending until someone closes and reopens it.

## Launch checklist

1. Settle every item in [LAUNCH-BLOCKERS.md](LAUNCH-BLOCKERS.md): license, publisher identity and legal notice, host, domain, contacts, newsletter list, sponsorship, repository settings. [LAUNCH.md](LAUNCH.md) says what the strict build reports today and what to do before the go.
2. Run `npm run build:strict`. It must succeed, which means no marker and no placeholder sentence is left and the base URL is `https://rulefiles.dev`. Use the same command as the release build on the host.
3. Re-verify every matrix cell dated more than 30 days ago.
4. Read the terms of use of each source again before publishing.

# Operations

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

Build command for either provider: `npm run build`. Output directory: `dist`. No install step is needed.

## Newsletter

The form stays off until an https form endpoint is set. Set `newsletter.formAction` in `site.config.json`, or the `NEWSLETTER_FORM_ACTION` variable at build time, then add any provider-specific hidden fields under `newsletter.hiddenFields`. The CSP then allows that one form origin. Before enabling it, name the provider and the responsible person on the privacy page (`content/privacy.md`) and turn on double opt-in at the provider.

## CI

- `.github/workflows/ci.yml` runs on pushes and pull requests: `npm ci`, validate, build, test, check links, on Node 20 and 22. The only dev dependency is `yaml`, used by the generator tests to parse the frontmatter that the generator writes.
- `.github/workflows/weekly-watch.yml` runs every Monday at 06:17 UTC and on demand, with a 15 minute timeout. It runs the watch script and opens a draft pull request, never a deployment. The checkout does not keep credentials. The push passes the token for that one command only. The branch name holds the date, the run id and the attempt number, so a second run on the same day does not collide with the first. The repository setting "Allow GitHub Actions to create and approve pull requests" must be on for the pull request step.
- A pull request opened with `GITHUB_TOKEN` does not start other workflows, so CI does not run on the watch pull request by itself. A person can close and reopen it, or push a commit from their own account, and CI then runs. This was not tested here.
- Actions are pinned to commit SHAs. The workflows use the built-in `GITHUB_TOKEN` and no other secret.

## Launch checklist

1. Settle every item in [LAUNCH-BLOCKERS.md](LAUNCH-BLOCKERS.md): license, publisher identity and legal notice, host, domain, contacts, newsletter list, sponsorship, repository settings.
2. Run `npm run build` and check that it prints no `LAUNCH WARNING`. Each warning is a placeholder sentence or the placeholder domain.
3. Re-verify every matrix cell dated more than 30 days ago.
4. Read the terms of use of each source again before publishing.

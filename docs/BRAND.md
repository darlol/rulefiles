# Brand names and domains

The first check was on 2026-10-15. The names, domains, handles, trademark databases, prices and fees were checked again on 2026-10-16, and the details are in `docs/BRAND-CLEARANCE.md`. Nothing was bought, filed or reserved.

## Where things stand

- The name in use is "Agent Diffs", set in `site.config.json`. The owner retained it on 2026-10-16.
- The 2026-10-16 checks found at least four software projects that already use "Agent Diff" or "AgentDiff" in the AI agent field, and an X account called `@agentdiffs` with a bio in the same field. The first check, which looked for the exact plural name only, did not see them. See `docs/BRAND-CLEARANCE.md` for the list and what each check could not establish.
- `agentdiffs.dev`, `.app`, `.org`, `.net` and `.ai` looked unregistered on 2026-10-16. `agentdiffs.com` is registered.

## How the domains were checked

For each name, the registry's RDAP server (found through the IANA bootstrap file at https://data.iana.org/rdap/dns.json) was queried, then Cloudflare DNS over HTTPS was queried for the NS record. A 404 from RDAP together with NXDOMAIN means the name looks unregistered. A 200 from RDAP means it is registered.

These checks do not prove that a name can be bought. A registry can reserve a name, a registrar can price it as premium, and a name can be released or taken between the check and a purchase.

## Fallback name

"Rulefiles" is the fallback if the owner drops "Agent Diffs". It was checked on 2026-10-16: `rulefiles.dev`, `.app`, `.net` and `.ai` look unregistered, `.com` and `.org` are registered, and no project of that name turned up in TMview or in the package registries. It fits the matrix and the generator better than the weekly digest. The INPI and WIPO databases could not be searched automatically.

## Names looked at and dropped

- Agent Changelog: pages and repositories already use the name, for example https://worldneedsai.com/en/agent-changelog and https://github.com/alloevil/agent-changelog.
- Agent Delta: a Python package called agentdelta exists on PyPI (https://pypi.org/project/agentdelta/), so the name is taken in the same developer audience.
- Context Diff: several products use ContextDiff (for example https://context-diff.vercel.app/).
- agentbrief.dev, diffwatch.dev, changeloop.dev, agentnotes.dev, agentmatrix.dev: registered on 2026-10-15.

## Related projects seen while searching

- https://thediff-news.github.io/ describes itself as AI dev news, only what is verified.
- https://worldneedsai.com/en/agent-changelog tracks agent changelogs.

Neither was reviewed in depth.

## Decision

The choice of name belongs to the project owner. Before any purchase or filing, `docs/BRAND-CLEARANCE.md` lists the manual trademark searches to run, the attorney search to ask for, and the same-day domain check.

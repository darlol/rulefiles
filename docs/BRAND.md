# Brand names and domains

Checked on 2026-10-15. Nothing was bought or reserved. The domains and name searches have not been repeated since.

## How the domains were checked

For each name, the registry's RDAP server (found through the IANA bootstrap file at https://data.iana.org/rdap/dns.json) was queried, then Cloudflare DNS over HTTPS was queried for the NS record. A 404 from RDAP together with NXDOMAIN means the name looks unregistered. A 200 from RDAP means it is registered.

These checks do not prove that a name can be bought. A registry can reserve a name, a registrar can price it as premium, and a name can be released or taken between this check and a purchase. Trademark databases were not searched. The name search below used a handful of web searches and can miss things.

## Candidates

| Name | Domains that looked unregistered | Registered | Conflicts found | Notes |
| --- | --- | --- | --- | --- |
| Agent Diffs | agentdiffs.dev, agentdiffs.app, agentdiffs.org, agentdiffs.net, agentdiffs.ai | agentdiffs.com | No project with the exact name in the searches | Placeholder used in `site.config.json`. Describes both the digest and the matrix. |
| Rulefiles | rulefiles.dev, rulefiles.app | rulefiles.com, rulefiles.org | No direct conflict in the searches | Fits the matrix and generator well, less so a weekly digest of releases. |
| Agent Changelog | agentchangelog.dev, agentchangelog.app, agentchangelog.org | agentchangelog.com | Yes. Pages and repositories already use the name, for example https://worldneedsai.com/en/agent-changelog and https://github.com/alloevil/agent-changelog | Not recommended. |

## Names looked at and dropped

- Agent Delta: agentdelta.dev and agentdelta.app look unregistered, but a Python package called agentdelta exists on PyPI (https://pypi.org/project/agentdelta/), so the name is taken in the same developer audience.
- Context Diff: contextdiff.dev looks unregistered, but several products use ContextDiff (for example https://context-diff.vercel.app/).
- agentbrief.dev, diffwatch.dev, changeloop.dev, agentnotes.dev, agentmatrix.dev: registered.

## Related projects seen while searching

These cover nearby ground and are worth reading before the project commits to the idea:

- https://thediff-news.github.io/ describes itself as AI dev news, only what is verified.
- https://worldneedsai.com/en/agent-changelog tracks agent changelogs.

Neither was reviewed in depth.

## Recommendation

Agent Diffs, on agentdiffs.dev. It had no exact-name conflict in the searches and the .dev domain looked free. Before any purchase, a trademark search in the EUIPO and USPTO databases and a repeat of the RDAP check on the same day are still needed. The choice of name belongs to the project owner.

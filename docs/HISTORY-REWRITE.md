# Plan: remove the personal email address from the commit history

Status: written on 2026-10-16. Option A was carried out the same day (see "Result of option A"). The steps below stay as the plan and as the record of how it was done. No force-push was made.

This file holds no personal address. Commands read the old and the new address from the git configuration at run time, so the plan can be committed to a public repository.

## Result of option A, 2026-10-16

- The backup bundle of all refs was created and verified before anything else. It is stored outside the repository, in a private folder with restricted rights, and holds the old address by design. The owner decides when to delete it.
- The rewrite ran on a fresh mirror clone with `git-filter-repo` 2.47.0, with the pull request refs deleted first, the mailmap for the noreply address and the replacement of the old marker name.
- `main` went from 16 commits to 16 commits. After the rewrite the authors and committers are the owner's GitHub login with its noreply address, and `GitHub <noreply@github.com>` for the squash merges. The personal address has 0 hit in `git log --all -S`, in `git grep` over every revision and in the raw commit objects. The old marker name has 0 hit in the messages and in the files of every revision. No `refs/pull` ref, tag or note was kept, and `git fsck --full` is clean. The GitHub signatures are gone, as expected.
- Nine commits had a tree difference. In each one, the files that differ are exactly the files that held the old marker name, and the new file is the old file with that name replaced, with as many lines added as removed. Nothing else changed.
- The new private repository `darlol/rulefiles` received `main` only, and CI is green on it. The old repository was deleted on 2026-10-18.
- The ruleset could not be applied that day, since GitHub refuses rulesets on a private repository on the free plan. It was applied on 2026-10-18 (see `docs/OPERATIONS.md`).
- Left as it was: the owner's first name remains in two lines of an old revision of a brand note, which the plan does not cover. The name is published on the legal pages anyway.

## What was found

At commit `2d07358` (`origin/main` after pull request #11, checked on 2026-10-16), `git rev-list --count origin/main` gives 15 commits, and `git log origin/main --format='%an <%ae> | %cn <%ce>' | sort | uniq -c` gives three identities. The branches of pull requests #8 to #11 were deleted after the squash merges. Once every pull request branch is deleted, `origin/main` is the only remote branch and `git log --remotes` gives the same 15 commits. While another branch exists, it gives more: 25 on 2026-10-16, with the 10 commits of `origin/fix/launch-nits`. The numbers grow with each new commit, so count again before the rewrite:

| Commits | Author | Committer |
| --- | --- | --- |
| 4 | the owner, with the GitHub noreply address (`<id>+<login>@users.noreply.github.com`) | the same |
| 4 | the owner, with the GitHub noreply address | `GitHub <noreply@github.com>`, squash merges of pull requests #8 to #11, signed by GitHub |
| 7 | the owner, with the personal address | `GitHub <noreply@github.com>`, squash merges of pull requests #1 to #7, signed by GitHub |

The seven in the last row are the squash merges of pull requests #1 to #7, made on github.com. The four squash merges of #8 to #11 carry the noreply address, because the GitHub setting was on when they were merged (`git log origin/main -4 --format='%ae | %ce'`, 2026-10-16). The personal address appears nowhere else: `git log --all -S'<personal address>'` and `git grep` over every revision (`git grep -I -i -F "$OLD_EMAIL" $(git rev-list --all)`) find nothing in file contents or commit messages. The messages of the squash merges on `main` also carry the old name of the placeholder marker, which was built on the owner's first name, and so do earlier versions of the files. The rewrite has to replace it too (step 4). There are no tags, notes or stashes. Any later squash merge adds one more commit with the noreply address only if the GitHub setting stays on.

## Preconditions

1. Done on 2026-10-16 (reported by the owner): the two settings are on, in GitHub under Settings, Emails: "Keep my email addresses private" and "Block command line pushes that expose my email". Keep both on while the launch pull requests are merged, so no new commit carries the personal address. After a merge, check it: `git fetch && git log -1 --format='%ae' origin/main`.
2. Pull requests #8 to #11 are merged (done on 2026-10-16). Any pull request opened later is merged first, or dropped. A rewrite changes every commit id after the first rewritten one, so open branches have to be rebased or recreated afterwards.
3. The owner has validated one of the two publication options below. The second one needs the owner's explicit approval and is run by the owner only.
4. The noreply address to use is the one in the local git configuration: `git config user.email` must end with `@users.noreply.github.com`.
5. The author and committer names are checked too (`git log --all --format='%an%n%cn' | sort -u`) and the name in `git config user.name` is the name the owner accepts to publish. The plan removes the address, not the name. The login in the noreply address (`<id>+<login>@...`) stays visible. Checked on 2026-10-16 on all refs of the working clone: there is one author name, the same in every commit, and it is the GitHub login, not a civil name. The committer name is that login, or `GitHub` for the squash merges made on github.com. The owner's civil name is now published on the legal notice and the privacy page, as publisher of the newsletter and data controller. The history no longer has to hide it, but a reader can now link the login to the civil name. The owner accepts that by publishing both. Option A, a new clean repository with the noreply address, stays the recommended path.

## Common steps, run outside the repository

All paths below are examples. The tool and the working copy stay out of the repository.

1. Variables, read at run time:

```
OLD_EMAIL=$(git -C <repo> log --all --format=%ae | sort -u | grep -v 'noreply')
OLD_MARKER=$(git -C <repo> log --all --format=%B | grep -o 'TODO-[A-Z][A-Z]*' | sort -u | grep -v 'TODO-OWNER')
NEW_NAME=$(git -C <repo> config user.name)
NEW_EMAIL=$(git -C <repo> config user.email)
test "$(printf '%s\n' "$OLD_EMAIL" | wc -l)" = 1 && case "$NEW_EMAIL" in *@users.noreply.github.com) ;; *) false ;; esac
```

2. Backup before anything else. A bundle holds every ref and keeps the old address, so store it somewhere private and delete it when the rewrite is verified and no longer needed:

```
git -C <repo> bundle create /safe/place/rulefiles-before-rewrite.bundle --all
git bundle verify /safe/place/rulefiles-before-rewrite.bundle
```

3. Install `git filter-repo` outside the repository, pinned to a version, for example `pip install --target /tmp/tools git-filter-repo==<version>` and run `/tmp/tools/bin/git-filter-repo`. It is a separate tool. It is not a dependency of the project, and `package.json` does not change.
4. Rewrite a fresh clone, not the working repository. Drop the hidden GitHub pull request refs first, since GitHub refuses pushes to them:

```
git clone --mirror <repo-url-or-path> /tmp/rewrite/repo.git
cd /tmp/rewrite/repo.git
git for-each-ref --format='%(refname)' refs/pull | xargs -r -n1 git update-ref -d
printf '%s <%s> <%s>\n' "$NEW_NAME" "$NEW_EMAIL" "$OLD_EMAIL" > /tmp/rewrite/mailmap
printf 'literal:%s==>TODO-OWNER\n' "$OLD_MARKER" > /tmp/rewrite/replacements
/tmp/tools/bin/git-filter-repo --mailmap /tmp/rewrite/mailmap --replace-message /tmp/rewrite/replacements --replace-text /tmp/rewrite/replacements
```

The mailmap changes the author and the committer when they match the old address. The replacements file turns the old marker name into `TODO-OWNER` in commit messages and in file contents of every revision. `$OLD_MARKER` is empty when the history holds no old marker. In that case leave out the two `--replace-*` options and the two extra verification commands below, since an empty literal would match everything or fail. The committer `GitHub <noreply@github.com>` is not personal and stays. `git filter-repo` also writes `filter-repo/commit-map` in the clone, which lists each old and new commit id.
5. Verify, in the rewritten clone:

```
git log --all --format='%an <%ae> | %cn <%ce>' | sort | uniq -c     # no line with the old address
git log --all -p -S"$OLD_EMAIL" | wc -l                              # 0
git grep -I -i -F "$OLD_EMAIL" $(git rev-list --all)                 # no output
git log --all --format=%B | grep -c "$OLD_MARKER"                    # 0
git grep -I -F "$OLD_MARKER" $(git rev-list --all)                   # no output
```

Then compare trees. Only metadata changed, except for the old marker name in the files that held it, so every new commit must have the same tree as its old commit unless the old commit held that name:

```
tail -n +2 filter-repo/commit-map | while read old new; do
  test "$(git -C <repo> rev-parse $old^{tree})" = "$(git rev-parse $new^{tree})" || echo "TREE DIFFERS $old"
done
```

A `TREE DIFFERS` line may appear only for a commit whose files held the old marker name. For each one, `git diff <old> <new>` must show that line and nothing else. Run `npm ci && npm run ci` in a checkout of the rewritten `main`. Run `gitleaks git -v` on it too.
6. Known side effect: all eleven squash commits (#1 to #11) carry a signature made by GitHub (checked with `git cat-file -p` on 2026-10-16). A signature depends on the commit id, so a rewrite invalidates it. The GitHub page cited under option B says `git-filter-repo` removes signatures, including on commits before the first changed one unless `--refs` limits the rewrite. Expect the "Verified" badge to go.

## Option A, without force-push: a new private repository (recommended)

1. Create a new private repository under the owner's account, with the final public name. The old repository is named `agent-diffs`, the dropped name, so the new one is also the moment to use `rulefiles`. The owner creates it.
2. From the rewritten clone, push branches only: `git push <new-repo-url> --all`. Do not push with `--mirror`, since that would send the pull request refs deleted above.
3. Recreate the settings on the new repository: the ruleset in `docs/ruleset-main.json`, "Allow GitHub Actions to create and approve pull requests" for the weekly watch, Actions secrets if any, and the merge method.
4. Point the working copies at the new URL, or clone again. Delete the old working copies, `git reflog expire --expire=now --all && git gc --prune=now` in any copy kept, only after the bundle of step 2 is verified, since this destroys the unreferenced objects of that copy for good.
5. Keep the old repository private as an archive, then delete it once the new one is checked. Deleting a repository is destructive and is the owner's call.

Consequences:

- Pull requests #1 to #11 and their review comments stayed in the old repository, which was deleted on 2026-10-18. The new repository starts at pull request #1, so the "(#N)" at the end of the squash commit titles then points at different pull requests, or at none. The titles can be left as they are, or rewritten in step 4 with a message callback. Both are acceptable.
- Issues, if any, do not move.
- Links to the old repository stopped working when it was deleted on 2026-10-18. None is in the site. `repoUrl` in `site.config.json` points to the new repository.
- Cloudflare Pages: the preview project was created from an uploaded zip, so it is not linked to the repository. If a Git integration is added later, it uses the new repository.
- The new repository holds no pull request refs and none of the old unreachable objects, so the old address does not travel with it. This is the main advantage over option B.

## Option B, with force-push on main (needs the owner's explicit approval)

1. Do the common steps. In the rewritten clone, `main` has the same content with new commit ids.
2. In the repository settings, relax the rule that blocks non-fast-forward updates of `main` (the `non_fast_forward` rule in `docs/ruleset-main.json`) for the duration of the push, for the owner only.
3. Push with a lease so that an unexpected change is not overwritten: `git push --force-with-lease=main:<old-main-sha> origin main`. Delete or rebase every other branch first.
4. Restore the rule. Reclone everywhere.

Risks:

- It rewrites history that every clone and every open branch is based on. Anything not rebased reintroduces the old commits at the next push.
- Pull requests #1 to #11 stay in place and keep pointing at the old commits. GitHub can keep those commits reachable by their id, and keeps the hidden `refs/pull/*` refs. The old address can stay readable in them, and the repository can still hold it after the push. This cannot be checked from here.
- It can only be undone from the bundle of step 2.
- GitHub's page on removing sensitive data (https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository, read on 2026-10-16) says that after a rewrite and force-push the old commits may still be reachable in clones and forks, directly by their SHA in cached views on GitHub, and through pull requests that reference them. Only GitHub Support can remove cached views and pull request references, and the page says Support only helps with sensitive data where the risk cannot be reduced by rotating credentials. An email address is not a credential, so Support may decline. That is why option A is the safer one: an address that cannot be purged from the old repository has to be left behind with it.

## Where the address can remain after either option

- GitHub: `refs/pull/*/head` and `refs/pull/*/merge` of the old repository, commits that stay fetchable by id after a force-push or a branch deletion, the pull request pages that show the old merge commits, and the workflow run data (the runs API returns the head commit's author name and email). Delete the old runs if the old repository is kept.
- Forks, if any. There should be none while the repository is private.
- Local copies: every clone, worktree and reflog on the owner's machines and on any other machine used for the work, and the editor's or tool's caches.
- The backup bundle, by design.
- Third-party mirrors and archives, if the repository ever became public before the rewrite.
- Other places that log commit metadata: CI logs and notifications already sent by email.

## Order of work

1. Owner: turn on the two GitHub email settings.
2. Done on 2026-10-16: pull requests #8 to #11 are merged. Merge any later pull request before the rewrite.
3. Owner: choose option A or B.
4. Run the common steps, then the chosen option.
5. Verify again on the published repository with the three verification commands, before it becomes public.

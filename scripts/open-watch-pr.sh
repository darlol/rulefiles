#!/usr/bin/env bash
# Commits the new watch drafts on a unique branch and opens a draft pull request.
# Used by .github/workflows/weekly-watch.yml, and runnable by hand in a clone.
#
# Environment:
#   GH_TOKEN            token for the push and for gh (the workflow passes GITHUB_TOKEN)
#   GITHUB_RUN_ID       run number, part of the branch name
#   GITHUB_RUN_ATTEMPT  attempt number, part of the branch name
#   DRY_RUN             "true" commits locally and stops before the push and the pull request
set -euo pipefail

DRY_RUN="${DRY_RUN:-false}"

if [ -z "$(git status --porcelain data/)" ]; then
  echo "No new changes detected."
  exit 0
fi

# The date plus the run id and attempt keep the branch name unique, so a second run on the same day does not fail.
stamp="$(date -u +%Y-%m-%d)"
branch="watch/${stamp}-${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}-${GITHUB_RUN_ATTEMPT:?GITHUB_RUN_ATTEMPT is required}"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git checkout -b "$branch"
git add data/drafts data/watch-state.json
git commit -m "Add watch draft for ${stamp}"

if [ "$DRY_RUN" = "true" ]; then
  echo "Dry run: nothing is pushed and no pull request is opened."
  echo "Branch that would be pushed: ${branch}"
  git show --stat --format='Commit that would be pushed: %h %s' HEAD
  exit 0
fi

# checkout ran with persist-credentials: false, so the token is passed for this one push only and is not stored in .git/config.
auth="$(printf 'x-access-token:%s' "${GH_TOKEN:?GH_TOKEN is required}" | base64 -w0)"
echo "::add-mask::${auth}"
git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic ${auth}" push origin "$branch"

gh pr create --draft --base main --head "$branch" \
  --title "Watch draft ${stamp}" \
  --body "Changes listed by scripts/watch.mjs from the official feeds. Each item quotes its source. Review each item against its link, then move kept items into data/digest/ with status published. This pull request does not publish anything. It was opened with GITHUB_TOKEN, so CI does not run on it until a person closes and reopens it or pushes a commit."

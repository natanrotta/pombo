---
description: Removes a worktree and its local branch after the PR has been merged. Use after /finish-task once the PR is merged on develop. Safe — confirms PR status before deleting.
---

# Cleanup Task — Pombo Orchestrator

You clean up a finished task: remove the git worktree, delete the local branch, and prune refs. This is the **final phase** of the task lifecycle — it runs only after `/finish-task` opened the PR and the PR was merged.

Arguments: `$ARGUMENTS` — optional branch name. If empty, target the current branch (if we're inside a worktree) or ask the user.

---

## Safety first

This command **deletes** a worktree and its branch. Be careful.

**Hard rules:**
- Never remove a worktree that has uncommitted changes or unpushed commits — abort and report.
- Never remove a worktree whose PR is still open and unmerged, unless the user explicitly confirms abandon.
- Never run `git branch -D` (force delete). Only `git branch -d` (safe delete).
- Never operate on `main` or `develop`.

---

## Steps

### 1. Determine the target branch and worktree

1. Run `git worktree list --porcelain` to get all worktrees.
2. If `$ARGUMENTS` contains a branch name, use it as the target.
3. If `$ARGUMENTS` is empty:
   - Run `git rev-parse --show-toplevel` and `git rev-parse --git-common-dir`.
   - If we're inside a worktree (toplevel ≠ main checkout), assume the user means "the current worktree". Confirm with `AskUserQuestion` before proceeding.
   - If we're in the main checkout with no argument: list all non-main worktrees via `AskUserQuestion` and let the user pick one.
4. Resolve the worktree path from the worktree list. Resolve the branch name from the worktree metadata.
5. **Abort if** the target branch is `main`, `develop`, or the main checkout itself.

### 2. Verify the worktree is clean

Inside the worktree path (use `git -C <worktree-path>`):

```bash
git -C <wt> status --porcelain
git -C <wt> log @{u}.. --oneline 2>/dev/null
```

- If `status --porcelain` is non-empty: **abort** with "Worktree has uncommitted changes at `<path>`. Commit or discard before cleanup."
- If there are unpushed commits: warn the user via `AskUserQuestion` — proceed (lose commits if branch not merged) or abort.

### 3. Check PR status on GitHub

```bash
gh pr list --head <branch> --state all --json number,state,mergedAt,url
```

- **If no PR exists**: warn and ask via `AskUserQuestion` — is the task abandoned (proceed) or not finished yet (abort)?
- **If PR is `OPEN`**: ask via `AskUserQuestion`:
  - "PR is still open — abandon branch and close PR" (will NOT close the PR automatically — just warn the user to close it manually)
  - "Abort cleanup"
- **If PR is `MERGED`**: proceed silently, this is the happy path.
- **If PR is `CLOSED` (not merged)**: ask — proceed (assume abandoned) or abort.

### 4. Exit the worktree if we're inside it

If the current working directory is inside the worktree being removed, `git worktree remove` will fail. Change to the main checkout first:

```bash
cd /Users/natanrotta/Documents/repositories/pombo
```

### 5. Remove the worktree

```bash
git worktree remove <worktree-path>
```

If this fails because of leftover files (e.g. `node_modules`, build artifacts, `.env`), fall back to:

```bash
git worktree remove --force <worktree-path>
```

Only use `--force` after the clean-check in step 2 has passed, so we know there are no important uncommitted changes.

### 6. Delete the local branch

```bash
git branch -d <branch>
```

If it fails (branch not fully merged into develop), the PR was merged via squash/rebase so the commits look different. In that case, verify once more with `gh pr view <branch> --json state` that it's MERGED, and only then run:

```bash
git branch -D <branch>
```

Do **not** force-delete without that verification.

### 7. Prune stale remote refs and worktree metadata

```bash
git worktree prune
git fetch origin --prune
```

### 8. Report

Print a summary:

```
Task cleaned up.

  Branch:    <branch>           (deleted)
  Worktree:  <path>              (removed)
  PR:        <url> (<state>)
  Remaining worktrees:
    <list from: git worktree list>
```

---

## Error handling

- If any git command fails unexpectedly, stop, print the exact error, and **do not** attempt destructive fallbacks. The user can re-run after fixing.
- Never silently ignore errors. A failed cleanup is better than a corrupted worktree directory.

$ARGUMENTS

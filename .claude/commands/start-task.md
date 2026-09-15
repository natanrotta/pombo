---
description: Starts a new task by creating a git worktree + branch from develop, then immediately continues the work in the SAME Claude Code session (no new editor window). Invoked ONLY when the user explicitly asks for a worktree (e.g. "crie um worktree", "nova worktree", "abre uma branch nova", "/start-task"). Without an explicit request, the assistant stays on the current branch in inline mode.
---

# Start Task — Pombo Orchestrator

You start a new task in **worktree mode**. Your job is **Phase 0** of the task lifecycle: create an isolated git worktree + branch from `develop`, prepare it for work (env files + deps), and then **continue the entire task in the current Claude Code session** with the worktree as the working directory. Do NOT open a new editor window. Do NOT write a handoff file. There is no handoff — it's the same conversation from `/start-task` all the way to the PR.

**Important:** this command should only run when the user explicitly asked for a new worktree/branch. If the user just described a change without asking for a worktree, the orchestrator stays in inline mode (current branch, no PR) and does NOT call `/start-task`. See `CLAUDE.md` → "Zero-friction mode" for the situation table.

Arguments: `$ARGUMENTS` — can be:
- A full task description in natural language (multi-sentence, Portuguese or English) — **preferred, this is the zero-friction path**
- A Jira ID alone (e.g. `DEVEL-1234`)
- A Jira ID + short description (e.g. `DEVEL-1234 fix webhook retry`)
- Empty — ask the user

---

## Steps

### 1. Confirm we are on the main checkout, not inside a worktree

Run `git rev-parse --show-toplevel` and `git rev-parse --git-common-dir`.

- The main checkout is at `/Users/natanrotta/Documents/repositories/pombo`.
- If `show-toplevel` is NOT the main checkout: the user is already inside a worktree. Abort with:
  > "You are already in a worktree at `<path>`. Run `/start-task` from the main checkout at `~/Documents/repositories/pombo`."

### 2. Fetch latest develop

```bash
git fetch origin develop --prune
```

Do **not** check out develop — we will branch from `origin/develop` directly, which leaves the user's current branch alone.

### 3. Resolve branch name

Parse `$ARGUMENTS`. Keep the **full original text** as the `TASK_BRIEF` variable — you will keep it in conversation context (no disk persistence needed).

- **If it contains a Jira ID** (regex: `[A-Z]+-\d+`):
  - Extract the Jira ID.
  - Use the rest of the text (if any) as the short description. If empty, derive a 3–6 word English summary from the `TASK_BRIEF` (translate Portuguese to English if needed).
  - Branch name: `feature/<jira-id>-<slug>` where `<slug>` = description lowercased, spaces → hyphens, stripped of non-alphanumerics.

- **If there is no Jira ID in `$ARGUMENTS`**:
  - **Do not ask.** Derive a 3–6 word English slug from the `TASK_BRIEF` and use branch = `<prefix>/<slug>` (no ticket ID). If the user cared about Jira they would have mentioned it.

- **If `$ARGUMENTS` is empty entirely**:
  - Only in this case, ask the user for a one-sentence description of the task, then follow the rules above. Set `TASK_BRIEF` to that description.

**Prefix inference (decide, don't ask):**
- If the `TASK_BRIEF` mentions "bug", "fix", "regressão", "quebrado", "não funciona", "erro", use `fix/`.
- If it mentions "refactor", "limpar", "simplificar", use `refactor/`.
- If it mentions "chore", "upgrade", "dependência", "configurar", use `chore/`.
- Otherwise default to `feature/`.
- **Never ask the user to disambiguate the prefix.** Pick one and move on — renaming a branch is trivial.

### 4. Create the worktree

Worktree path convention (fixed):
```
~/Documents/repositories/pombo-worktrees/<branch-name-sanitized>
```

Where `<branch-name-sanitized>` replaces `/` with `+` (e.g. `feature/DEVEL-1234-foo` → `feature+DEVEL-1234-foo`).

Create the parent directory if it doesn't exist:
```bash
mkdir -p ~/Documents/repositories/pombo-worktrees
```

Create the worktree with a **new branch** based on `origin/develop`:
```bash
git worktree add ~/Documents/repositories/pombo-worktrees/<sanitized> -b <branch> origin/develop
```

If `git worktree add` fails because the branch already exists, report the error and ask the user whether to:
- Reuse the existing branch (use `git worktree add <path> <branch>` without `-b`), or
- Abort.

### 5. Copy environment files (if they exist)

The worktree starts with a fresh working tree but `.env` files are not tracked. Copy them from the main checkout so the worktree is usable immediately:

```bash
MAIN=/Users/natanrotta/Documents/repositories/pombo
WT=<worktree-path>
for f in .env apps/api/.env apps/web/.env apps/api/.env.local apps/web/.env.local; do
  if [ -f "$MAIN/$f" ]; then mkdir -p "$(dirname "$WT/$f")"; cp "$MAIN/$f" "$WT/$f"; fi
done
```

Skip silently any file that doesn't exist.

### 6. Install dependencies in the worktree

Worktrees share `.git` but NOT `node_modules`. Run:
```bash
cd <worktree-path> && yarn install --frozen-lockfile
```

This can take a minute. Run in foreground so the user sees progress. If it fails, report the error and let the user decide whether to continue.

### 7. Announce the handoff — to YOURSELF, in the same session

Print a short summary:

```
Worktree ready:
  Branch:    <branch-name>
  Path:      <worktree-path>
  Based on:  origin/develop @ <short-sha>

Continuing in this session. All subsequent file reads, edits, and commands
will target the worktree path above. After implementation I'll run /finish-task,
and after the PR is merged you can run /cleanup-task.
```

### 8. Proceed with the task IN THIS SESSION

**Critical:** Do NOT stop. Do NOT open a new editor window (`code`, `cursor`, etc. are forbidden). Do NOT write a `.claude/active-task.local.md` handoff file — there is no handoff.

Instead, immediately continue with the task lifecycle in the current conversation (the worktree-mode protocol in `CLAUDE.md`):

1. **Invoke `/triage`** via the `Skill` tool with the `TASK_BRIEF` — it runs the three perspectives in parallel, batches questions into ONE `AskUserQuestion`, and persists the **Task Spec** to `.claude/specs/<slug>.md`. Skip `/triage` only for trivial fixes; go straight to `/architect` for L-sized / High-risk features (it persists the spec at Gate 2).
2. **Invoke the recommended specialist** via the `Skill` tool, passing the spec path + content as `$ARGUMENTS`.
3. **All tool calls from this point on must target the worktree path**, not the main checkout:
   - Absolute paths rooted at the worktree (preferred for `Read`, `Edit`, `Write`, `Glob`, `Grep`).
   - `cd <worktree-path> && …` for `Bash` commands that must run with the worktree as cwd (tests, yarn scripts, git commands).
   - Never edit files in `/Users/natanrotta/Documents/repositories/pombo/**` — that's the main checkout and would corrupt it.
4. After implementation, invoke `/finish-task` from the worktree directory.
5. After the PR is merged, the user runs `/cleanup-task` from anywhere.

---

## Notes

- This command focuses purely on the worktree + local branch creation — fast and offline-capable. The PR is opened at the end by `/finish-task` Phase 7.
- Worktrees are cheap — don't hesitate to create one per small task. Cleanup via `/cleanup-task` after the PR is merged.
- **Forbidden commands in this skill:** `code <path>`, `cursor <path>`, any editor-launch command. The user rejected the "new window per task" workflow.

$ARGUMENTS

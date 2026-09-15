#!/usr/bin/env bash
# PostToolUse hook for Edit/Write on backend files.
# Reads the tool input from stdin (JSON), greps the touched file for
# obvious anti-patterns, and writes warnings to stderr (non-blocking).
#
# Wire-up: see .claude/settings.json → hooks.PostToolUse.
# Spec: https://docs.anthropic.com/en/docs/claude-code/hooks

set -uo pipefail

# Read the entire stdin payload
payload="$(cat || true)"
[ -z "$payload" ] && exit 0

# Extract file path. Try jq first; fall back to a simple grep.
file=""
if command -v jq >/dev/null 2>&1; then
  file="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
fi
if [ -z "$file" ]; then
  file="$(printf '%s' "$payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
fi

# Only run on backend source files
case "$file" in
  *apps/api/src/*.ts) ;;
  *) exit 0 ;;
esac

# Skip test files — different rules apply
case "$file" in
  *.spec.ts|*.test.ts|*__tests__*) exit 0 ;;
esac

[ -f "$file" ] || exit 0

# --------------------------------------------------------------------
# Lightweight anti-pattern checks. Keep these fast — pure bash + grep.
# All warnings go to stderr; we never exit non-zero (advisory only).
# --------------------------------------------------------------------

warn() {
  printf '⚠️  [backend-hook] %s\n' "$1" >&2
}

# B-C4: throw new Error(...) outside infrastructure
case "$file" in
  */modules/*/domain/*|*/modules/*/application/*)
    if grep -nE 'throw[[:space:]]+new[[:space:]]+Error\(' "$file" >/dev/null; then
      lines="$(grep -nE 'throw[[:space:]]+new[[:space:]]+Error\(' "$file" | head -3)"
      warn "B-C4: 'throw new Error(...)' detected — use AppError subclasses with ErrorCodes (see patterns/backend.md § Error handling). Lines: $lines"
    fi
    ;;
esac

# B-H12: console.log / console.error / console.warn in API source
if grep -nE '\bconsole\.(log|error|warn|info|debug)\b' "$file" >/dev/null; then
  lines="$(grep -nE '\bconsole\.' "$file" | head -3)"
  warn "B-H12: console.* detected — use ILoggerProvider (Pino) instead. Lines: $lines"
fi

# B-C13: Direct LLM API calls (must go through the ILlmProvider port — R23)
if grep -nE '(api\.openai\.com|api\.anthropic\.com|fetch\(.*openai|fetch\(.*anthropic|from "openai"|from "@anthropic-ai/)' "$file" >/dev/null; then
  if ! echo "$file" | grep -qE 'core/provider/llm/'; then
    warn "B-C13: direct LLM API/SDK usage detected — go through the ILlmProvider port (impl lives in core/provider/llm/; see /ai-backend)."
  fi
fi

# B-C7: Raw SQL with string interpolation
if grep -nE '\$queryRawUnsafe\(' "$file" >/dev/null; then
  warn "B-C7: \$queryRawUnsafe detected — sanitize via parameterized \$queryRaw\`...\` with template literal placeholders."
fi

# B-H3: Prisma catch block likely missing mapPrismaError
# Heuristic: file uses prisma.<model>.<verb>( and has a catch block but no mapPrismaError reference.
if grep -nE '\bprisma\.[a-zA-Z]+\.(find|create|update|delete|upsert|count|aggregate|groupBy)\(' "$file" >/dev/null; then
  if grep -nE '\}[[:space:]]*catch[[:space:]]*\(' "$file" >/dev/null; then
    if ! grep -q 'mapPrismaError' "$file"; then
      warn "B-H3: Prisma operation with a catch block but no mapPrismaError(...) — wrap rethrow with mapPrismaError (see patterns/backend.md § Prisma Repository)."
    fi
  fi
fi

# B-C9: Use case method receiving Request/Response
case "$file" in
  *.use-case.ts)
    if grep -nE '\b(req|request|res|response)[[:space:]]*:[[:space:]]*(Request|Response)\b' "$file" >/dev/null; then
      warn "B-C9: use case appears to take Express Request/Response — use cases must receive DTOs and return DTOs."
    fi
    ;;
esac

# B-C10: domain/application importing infrastructure
case "$file" in
  */modules/*/domain/*|*/modules/*/application/*)
    if grep -nE 'from[[:space:]]+["'\''](\.\./)*infrastructure/|from[[:space:]]+["'\'']@core/(provider|database|service)/|from[[:space:]]+["'\'']@modules/[^"'\'']*/infrastructure/' "$file" >/dev/null; then
      warn "B-C10: domain/application file imports an infrastructure impl (own infrastructure/, @core/{provider,database,service}, or another module's infrastructure/) — invert the dependency (port in domain/shared, impl in core/infrastructure)."
    fi
    ;;
esac

# B-H8: list/findMany without skip/take in repository implementations
case "$file" in
  *prisma-*-repository.ts)
    if grep -nE '\.findMany\(' "$file" >/dev/null; then
      # crude: check that at least one findMany call sits within ~6 lines of "skip" or "take"
      if ! awk '/\.findMany\(/{flag=6} flag>0 {print; flag--}' "$file" | grep -qE '\b(skip|take)\b'; then
        warn "B-H8: findMany without obvious skip/take — list endpoints must paginate."
      fi
    fi
    ;;
esac

exit 0

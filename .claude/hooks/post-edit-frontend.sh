#!/usr/bin/env bash
# PostToolUse hook for Edit/Write on frontend files.
# Greps for project-specific anti-patterns: yellow/orange tones,
# hardcoded hex, raw inputs, hardcoded routes, color-mode conditionals.
# All warnings go to stderr; advisory only (never blocking).

set -uo pipefail

payload="$(cat || true)"
[ -z "$payload" ] && exit 0

file=""
if command -v jq >/dev/null 2>&1; then
  file="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
fi
if [ -z "$file" ]; then
  file="$(printf '%s' "$payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
fi

# Only frontend source files
case "$file" in
  *apps/web/src/*.ts|*apps/web/src/*.tsx) ;;
  *) exit 0 ;;
esac

# Skip the theme itself — it's allowed to define raw hex
case "$file" in
  *apps/web/src/app/theme/*) exit 0 ;;
esac

[ -f "$file" ] || exit 0

warn() {
  printf '⚠️  [frontend-hook] %s\n' "$1" >&2
}

# F-C3: yellow / orange / amber tones — hard project rule
if grep -nEi '\b(yellow|orange|amber|gold)\.[0-9]{2,3}|#(ff[a-f0-9]{2}00|ffd700|ffa500|ff8c00)\b' "$file" >/dev/null; then
  lines="$(grep -nEi '\b(yellow|orange|amber|gold)\.[0-9]{2,3}|#(ff[a-f0-9]{2}00|ffd700|ffa500|ff8c00)\b' "$file" | head -3)"
  warn "F-C3: yellow/orange/amber/gold detected — project rule forbids these. Use 'purple' for warnings, 'red' for errors, 'accent' (green) for success. Lines: $lines"
fi

# F-C2: hardcoded hex outside theme
if grep -nE '#[0-9a-fA-F]{3,8}\b' "$file" | grep -vE '(//|/\*|\*)' >/dev/null; then
  lines="$(grep -nE '#[0-9a-fA-F]{3,8}\b' "$file" | grep -vE '(//|/\*|\*)' | head -3)"
  warn "F-C2: hardcoded hex color detected — use semantic tokens (bg.*, text.*, border.*, status.*). Lines: $lines"
fi

# F-C7: hardcoded API path
if grep -nE 'fetch\(["'\''][^"'\'']*\/api\/|axios\.(get|post|put|delete|patch)\(["'\''][^"'\'']*\/api\/' "$file" >/dev/null; then
  warn "F-C7: hardcoded API path / direct fetch — go through repositories.<entity>.<method>() (see patterns/frontend.md § HTTP Client)."
fi

# F-C9: hardcoded route literals (heuristic: navigate("/...") or to="/..."
if grep -nE 'navigate\(["'\'']/[a-zA-Z]' "$file" >/dev/null; then
  lines="$(grep -nE 'navigate\(["'\'']/[a-zA-Z]' "$file" | head -3)"
  warn "F-C9: hardcoded route in navigate(...) — use ROUTE_PATHS.<key>.replace(':id', id). Lines: $lines"
fi

# F-H16: useColorMode() conditional
if grep -nE 'useColorMode\(' "$file" >/dev/null; then
  warn "F-H16: useColorMode() detected — prefer semantic tokens with _dark variants instead of color-mode conditionals."
fi

# F-H6: raw Chakra Input/Textarea/Select in feature folders (allowed in shared/components/forms/)
case "$file" in
  *apps/web/src/shared/components/forms/*) ;;
  *)
    if grep -nE '<(Input|Textarea|Select)[[:space:]>]' "$file" >/dev/null; then
      warn "F-H6: raw Chakra <Input>/<Textarea>/<Select> outside shared/forms — use FormField / TextAreaField / SelectField (see patterns/frontend.md § Forms)."
    fi
    ;;
esac

# F-C8: hardcoded user-visible strings (very crude — only flag obvious cases of "title=" or button text)
# We skip aria-label and a few common attributes that are sometimes okay literal.
if grep -nE '<Button[^>]*>[A-Za-zÀ-ÿ]{3,}' "$file" >/dev/null; then
  if ! grep -q 'useTranslation' "$file" && ! grep -q '\bt(' "$file"; then
    warn "F-C8: literal text in JSX without useTranslation — every user-visible string must go through i18n (3 locales)."
  fi
fi

# F-C20: kitchen-sink hook detection — feature hook with >2 useQuery calls
# Heuristic: only flag hooks under modules/*/presentation/hooks (not shared/).
case "$file" in
  *apps/web/src/modules/*/presentation/hooks/*.ts)
    use_query_count="$(grep -cE '\buseQuery\s*\(' "$file" 2>/dev/null || echo 0)"
    if [ "${use_query_count:-0}" -gt 2 ] 2>/dev/null; then
      warn "F-C20: $use_query_count useQuery calls in a feature hook — likely kitchen-sink. Split into focused hooks (one principal query + mutations). See patterns/frontend.md § Data-fetching scope."
    fi
    ;;
esac

# F-H20: staleTime literal numérico (ex: `staleTime: 60_000` ou `5 * 60_000`).
# `staleTime: 0` é intencional (polling) — escape.
case "$file" in
  *apps/web/src/core/query/queryClient.ts|*apps/web/src/core/query/staleTimes.ts) ;;
  *apps/web/src/test/*) ;;
  *)
    if grep -nE 'staleTime:[[:space:]]+[1-9]' "$file" >/dev/null; then
      lines="$(grep -nE 'staleTime:[[:space:]]+[1-9]' "$file" | head -3)"
      warn "F-H20: staleTime literal detectado — importar STALE_TIMES (default|reference|volatile|subscription) de core/query/staleTimes.ts. Lines: $lines"
    fi
    ;;
esac

# F-H21: queryKey montado via spread inline `[...queryKeys.X.Y(), ...]`.
# Sintoma: factory que não aceita params, callsite estende manualmente.
case "$file" in
  *apps/web/src/core/query/queryKeys.ts) ;;
  *)
    if grep -nE '\[\.\.\.queryKeys\.[a-zA-Z]+\.[a-zA-Z]+\(\),' "$file" >/dev/null; then
      lines="$(grep -nE '\[\.\.\.queryKeys\.[a-zA-Z]+\.[a-zA-Z]+\(\),' "$file" | head -3)"
      warn "F-H21: queryKey via spread inline — params devem ir na assinatura do factory. Lines: $lines"
    fi
    ;;
esac

# F-C6 (reinforce): `queryKeys.X.all` em invalidateQueries — invalidação ampla
# (refetch de TODOS os shards). Use sub-keys (.detail(id), .list(params), .linked*(id)).
if grep -nE 'invalidateQueries\s*\(\s*\{\s*queryKey:\s*queryKeys\.[a-zA-Z]+\.all' "$file" >/dev/null; then
  lines="$(grep -nE 'invalidateQueries\s*\(\s*\{\s*queryKey:\s*queryKeys\.[a-zA-Z]+\.all' "$file" | head -3)"
  warn "F-C6: invalidateQueries(queryKeys.X.all) — invalidação ampla. Preferir sub-key cirúrgico (.detail(id), .list(params)). Lines: $lines"
fi

exit 0

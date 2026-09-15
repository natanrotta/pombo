#!/usr/bin/env bash
# check-contract-sync.sh
#
# Best-effort BE↔FE contract sync gate. Compares HTTP routes declared by the
# Express API with httpClient.* calls in FE repositories. Flags the two
# recurring drift patterns surfaced in .claude/learning/violations.md:
#
#   1. BE accepts a route the FE never calls    → dead-API surface (X-H1)
#   2. FE calls a route the BE doesn't expose   → broken call / removed route
#
# Scope-limited to files touched in the current diff (vs origin/develop) so
# we don't scream about pre-existing drift. Advisory: exit 0 = clean,
# exit 2 = candidates found (printed to stderr).
#
# Known gap (by design): side 3b only inspects changed *Repository.ts files —
# an httpClient call added directly inside a hook/component is not checked
# (that placement is itself an F-C1/F-C7 violation the auditor catches first).
#
# Project conventions assumed (see real files for examples):
#   BE routes index : apps/api/src/core/http/routes/index.ts
#                     router.use("/<base>", <name>Routes)
#   BE route files  : apps/api/src/modules/*/infrastructure/route/*.routes.ts
#                     <name>Routes.<verb>("<rel>", ...)
#   FE repos        : apps/web/src/**/repositories/Http*.ts
#                     httpClient.<verb><...>("<path>", ...)
#                     httpClient.<verb><...>(`<path>/${var}`, ...)

set -uo pipefail

# NOTE: -e (not -d) — in a git worktree, .git is a FILE pointing at the common
# dir. A -d test made this hook silently self-skip in every worktree task.
REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
if [[ -z "${REPO_ROOT}" || ! -e "${REPO_ROOT}/.git" ]]; then
  echo "[contract-sync] not in a git repo — skipping" >&2
  exit 0
fi
cd "${REPO_ROOT}" || exit 0

BASE_REF="${BASE_REF:-origin/develop}"
# Post module-first refactor: the route aggregator lives in the http chassis
# (core), the per-feature *.routes.ts files live in each module's infrastructure.
ROUTES_INDEX="apps/api/src/core/http/routes/index.ts"
ROUTES_DIR="apps/api/src/modules"
ROUTES_GLOB="apps/api/src/modules/*/infrastructure/route/*.routes.ts"
FE_REPO_GLOB="apps/web/src"

if [[ ! -f "${ROUTES_INDEX}" ]]; then
  echo "[contract-sync] routes index not found at ${ROUTES_INDEX} — skipping" >&2
  exit 0
fi

# Capture both committed-vs-base AND uncommitted working-tree changes so the
# gate works mid-BABYSIT (before /finish-task commits) and post-commit.
CHANGED_COMMITTED="$(git diff --name-only "${BASE_REF}"...HEAD 2>/dev/null || true)"
CHANGED_WORKING="$(git diff --name-only "${BASE_REF}" 2>/dev/null || true)"
CHANGED_FILES="$(printf '%s\n%s\n' "${CHANGED_COMMITTED}" "${CHANGED_WORKING}" | sort -u | sed '/^$/d')"
if [[ -z "${CHANGED_FILES}" ]]; then
  echo "[contract-sync] no diff vs ${BASE_REF} — skipping" >&2
  exit 0
fi

CHANGED_BE_ROUTES="$(echo "${CHANGED_FILES}" | grep -E "^apps/api/src/modules/[^/]+/infrastructure/route/.*\.routes\.ts$" || true)"
CHANGED_FE_REPOS="$(echo "${CHANGED_FILES}" | grep -E "^${FE_REPO_GLOB}/.*[Rr]epository\.ts$" || true)"

if [[ -z "${CHANGED_BE_ROUTES}" && -z "${CHANGED_FE_REPOS}" ]]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# 1. Build the full BE route table: <verb> <full-path-template>
#    Reads the routes index for base-path mounts, then walks each route file.
# ---------------------------------------------------------------------------
TMPDIR_LOCAL="$(mktemp -d)"
trap 'rm -rf "${TMPDIR_LOCAL}"' EXIT
BE_ROUTES_FILE="${TMPDIR_LOCAL}/be-routes.txt"
: > "${BE_ROUTES_FILE}"

# Parse: router.use("/<base>", <name>Routes)
# Map file (routerVar<TAB>basePath). bash-3.2 compatible on purpose: macOS ships
# bash 3.2 (no associative arrays, no ${var^^}) and this hook must run on the
# default shell. Regexes live in single-quoted variables — escaped quotes or
# backticks inline in [[ =~ ]] are a parse error on 3.2.
BASE_MAP="${TMPDIR_LOCAL}/base-map.txt"
: > "${BASE_MAP}"
mount_re='router\.use\("([^"]+)",[[:space:]]*([a-zA-Z0-9_]+)'
while IFS= read -r line; do
  # Match: router.use("/foo", barRoutes)
  if [[ "${line}" =~ ${mount_re} ]]; then
    printf '%s\t%s\n' "${BASH_REMATCH[2]}" "${BASH_REMATCH[1]}" >> "${BASE_MAP}"
  fi
done < "${ROUTES_INDEX}"

# Walk each *.routes.ts and extract <name>Routes.<verb>("<rel>",
# Prettier formats most declarations multi-line (`userRoutes.get(` ends the
# line, the "/path" lands on the next one) — ~87% of routes in this repo. The
# awk pass joins those two lines so the single-line regex sees the full call.
route_re='([a-zA-Z0-9_]+)Routes\.(get|post|put|patch|delete)\([[:space:]]*"([^"]*)"'
for rf in ${ROUTES_GLOB}; do
  [[ -f "${rf}" ]] || continue
  # Find variable name(s) exported / used in this file (one or more)
  while IFS= read -r match; do
    # match like: userRoutes.get("/:id"
    if [[ "${match}" =~ ${route_re} ]]; then
      raw_var="${BASH_REMATCH[1]}Routes"
      verb="${BASH_REMATCH[2]}"
      rel="${BASH_REMATCH[3]}"
      base="$(awk -F'\t' -v v="${raw_var}" '$1==v {print $2; exit}' "${BASE_MAP}")"
      if [[ -z "${base}" ]]; then
        continue
      fi
      # Normalize: strip trailing slash from base, leading slash from rel
      base="${base%/}"
      [[ "${rel}" != "/" && "${rel}" != "" ]] && rel="${rel#/}"
      [[ "${rel}" == "/" ]] && rel=""
      full="/api${base}/${rel}"
      full="${full%/}"
      [[ -z "${full}" ]] && full="/api"
      # Normalize :id-style params to a single token shape for compare
      norm="$(echo "${full}" | sed -E 's#:[a-zA-Z_]+#:param#g')"
      echo "${verb} ${norm} ${rf}" >> "${BE_ROUTES_FILE}"
    fi
  done < <(awk '
    joined { print prev $0; joined=0; prev=""; next }
    /Routes\.(get|post|put|patch|delete)\([[:space:]]*$/ { prev=$0; joined=1; next }
    { print }
  ' "${rf}" | grep -E "Routes\.(get|post|put|patch|delete)\(")
done

# ---------------------------------------------------------------------------
# 2. Build the FE call table: <verb> <path-template>
# ---------------------------------------------------------------------------
FE_CALLS_FILE="${TMPDIR_LOCAL}/fe-calls.txt"
: > "${FE_CALLS_FILE}"

# Two FE call conventions coexist in this repo:
#   (a) httpClient.<verb><T>("/path")            — e.g. HttpDeviceRepository
#   (b) destructured helpers get/post/put/patch/del<T>("/path") — e.g. HttpUserRepository
# Both are often multi-line (path on the next line) — the awk pass joins them.
# For (b), requiring the first arg to start with "/" kills generic false hits.
fe_call_re='httpClient\.(get|post|put|patch|delete)[^(]*\([[:space:]]*[`"]([^`"]+)[`"]'
fe_helper_re='(^|[^a-zA-Z0-9_.])(get|post|put|patch|del|typedGet|typedPost|typedPut|typedPatch|typedDelete)(<[^>]*>)?\([[:space:]]*[`"](/[^`"]*)[`"]'
while IFS= read -r line; do
  # The file path is line-prefixed
  file="${line%%:*}"
  match="${line#*:}"
  verb=""
  path=""
  if [[ "${match}" =~ ${fe_call_re} ]]; then
    verb="${BASH_REMATCH[1]}"
    path="${BASH_REMATCH[2]}"
  elif [[ "${match}" =~ ${fe_helper_re} ]]; then
    verb="${BASH_REMATCH[2]}"
    path="${BASH_REMATCH[4]}"
    case "${verb}" in
      typedGet) verb="get";;
      typedPost) verb="post";;
      typedPut) verb="put";;
      typedPatch) verb="patch";;
      typedDelete|del) verb="delete";;
    esac
  fi
  if [[ -n "${verb}" ]]; then
    # Drop trailing query strings
    path="${path%%\?*}"
    # ${var} → :param
    norm="$(echo "${path}" | sed -E 's#\$\{[^}]+\}#:param#g; s#:[a-zA-Z_]+#:param#g')"
    # Prefix /api if not present (FE uses /api prefix via httpClient baseURL but
    # the literal path may or may not include it depending on the project)
    case "${norm}" in
      /api/*) full="${norm}";;
      /api)   full="${norm}";;
      /*)     full="/api${norm}";;
      *)      full="/api/${norm}";;
    esac
    full="${full%/}"
    echo "${verb} ${full} ${file}" >> "${FE_CALLS_FILE}"
  fi
done < <(
  grep -rlE "(httpClient\.(get|post|put|patch|delete)|from ['\"]@/core/http/)" "${FE_REPO_GLOB}" --include="*.ts" --include="*.tsx" 2>/dev/null |
  while IFS= read -r f; do
    awk -v FILE="${f}" '
      joined { print FILE ":" prev $0; joined=0; prev=""; next }
      /httpClient\.(get|post|put|patch|delete)[^(]*\([[:space:]]*$/ { prev=$0; joined=1; next }
      /(^|[^a-zA-Z0-9_.])(get|post|put|patch|del|typedGet|typedPost|typedPut|typedPatch|typedDelete)(<[^>]*>)?\([[:space:]]*$/ { prev=$0; joined=1; next }
      /httpClient\.(get|post|put|patch|delete)/ { print FILE ":" $0; next }
      /(^|[^a-zA-Z0-9_.])(get|post|put|patch|del|typedGet|typedPost|typedPut|typedPatch|typedDelete)(<[^>]*>)?\([[:space:]]*[`"]\// { print FILE ":" $0 }
    ' "${f}"
  done
)

# ---------------------------------------------------------------------------
# 3. Compare diffs: only flag routes/calls touched in this PR
# ---------------------------------------------------------------------------
DEAD_API_FILE="${TMPDIR_LOCAL}/dead-api.txt"
BROKEN_FE_FILE="${TMPDIR_LOCAL}/broken-fe.txt"
: > "${DEAD_API_FILE}"
: > "${BROKEN_FE_FILE}"

# 3a. For each route in a CHANGED BE file, check if ANY FE call matches.
while IFS= read -r rline; do
  [[ -z "${rline}" ]] && continue
  verb="$(echo "${rline}" | awk '{print $1}')"
  path="$(echo "${rline}" | awk '{print $2}')"
  src="$(echo "${rline}" | awk '{print $3}')"
  # Only consider routes from files we actually changed
  if ! echo "${CHANGED_BE_ROUTES}" | grep -Fxq "${src}"; then
    continue
  fi
  # Exclude well-known public surfaces (heuristic: skip webhooks/health/dev)
  case "${path}" in
    */webhooks/*|*/health|*/dev/*|*/billing/webhook*) continue;;
  esac
  # Look for FE match
  if ! awk -v v="${verb}" -v p="${path}" '$1==v && $2==p {found=1} END{exit !found}' "${FE_CALLS_FILE}"; then
    verb_uc="$(printf '%s' "${verb}" | tr '[:lower:]' '[:upper:]')"
    echo "  ${verb_uc} ${path}  (from ${src})" >> "${DEAD_API_FILE}"
  fi
done < "${BE_ROUTES_FILE}"

# 3b. For each call in a CHANGED FE repo file, check if ANY BE route matches.
while IFS= read -r cline; do
  [[ -z "${cline}" ]] && continue
  verb="$(echo "${cline}" | awk '{print $1}')"
  path="$(echo "${cline}" | awk '{print $2}')"
  # Field 3 is the bare file path (no :line suffix — see FE_CALLS_FILE writer).
  src="$(echo "${cline}" | awk '{print $3}')"
  # Only consider calls from files we actually changed
  if ! echo "${CHANGED_FE_REPOS}" | grep -Fxq "${src}"; then
    continue
  fi
  if ! awk -v v="${verb}" -v p="${path}" '$1==v && $2==p {found=1} END{exit !found}' "${BE_ROUTES_FILE}"; then
    verb_uc="$(printf '%s' "${verb}" | tr '[:lower:]' '[:upper:]')"
    echo "  ${verb_uc} ${path}  (from ${src})" >> "${BROKEN_FE_FILE}"
  fi
done < "${FE_CALLS_FILE}"

# ---------------------------------------------------------------------------
# 4. Emit report
# ---------------------------------------------------------------------------
DEAD_COUNT="$(wc -l < "${DEAD_API_FILE}" | tr -d ' ')"
BROKEN_COUNT="$(wc -l < "${BROKEN_FE_FILE}" | tr -d ' ')"

if [[ "${DEAD_COUNT}" -eq 0 && "${BROKEN_COUNT}" -eq 0 ]]; then
  echo "[contract-sync] OK — BE↔FE contract aligned for the changed surface." >&2
  exit 0
fi

{
  echo ""
  echo "============================================================"
  echo "[contract-sync] candidate BE↔FE drift — advisory"
  echo "============================================================"
  if [[ "${DEAD_COUNT}" -gt 0 ]]; then
    echo ""
    echo "Routes BE expõe mas nenhum repositório FE chama (X-H1 candidato):"
    cat "${DEAD_API_FILE}"
    echo ""
    echo "  → Ou adicione a chamada no FE no mesmo PR, ou remova a rota do BE,"
    echo "    ou documente no corpo do PR por que ela é pública / interna."
  fi
  if [[ "${BROKEN_COUNT}" -gt 0 ]]; then
    echo ""
    echo "Chamadas FE sem rota BE correspondente (potencialmente quebradas):"
    cat "${BROKEN_FE_FILE}"
    echo ""
    echo "  → Ou a rota foi renomeada/removida e a chamada FE está stale,"
    echo "    ou o matcher de path desta heurística não encontrou (template"
    echo "    literal exótico, prefix /api duplicado, etc). Verifique."
  fi
  echo ""
  echo "Notas:"
  echo "  - heurística best-effort: webhooks/health/dev são ignorados."
  echo "  - paths com :id/:param são normalizados antes do compare."
  echo "  - false-positives possíveis em chamadas com URL construída dinamicamente."
  echo "============================================================"
} >&2

exit 2

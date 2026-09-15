#!/usr/bin/env bash
# ============================================================================
# bugsnag.sh — thin CLI over the Bugsnag Data Access API for Claude Code.
#
# The `/bugsnag` skill and the `bugsnag-analyst` agent call this script. It is
# the "MCP-equivalent" layer: a read-mostly bridge to the account that keeps
# the personal auth token out of the model context (sourced from a gitignored
# env file, never passed as an argument).
#
# Usage:
#   bugsnag.sh whoami                      # org + token sanity check
#   bugsnag.sh projects                    # all projects: name | key | stages
#   bugsnag.sh errors  <project> [since]   # top open errors (since: 1d/7d/30d, default 7d)
#   bugsnag.sh error   <project> <errorId> # one error: detail + latest event
#   bugsnag.sh trends  <project> [buckets] # event-count buckets over time (default 14)
#   bugsnag.sh stability <project>         # session/user stability timeline (the dash metric)
#   bugsnag.sh monitor [since]             # live one-screen monitor for ALL projects
#   bugsnag.sh raw     <path>              # GET an arbitrary Data Access API path
#
# <project> matches by case-insensitive substring of the project name
# ("api prod"), by exact api_key, or by project id.
#
# Read-only by design. Stability-target writes are a PATCH /projects/{id} that
# is intentionally NOT implemented here — use `bugsnag raw` for read-back and
# the Bugsnag UI (or an explicit curl) for the write. Requires: bash, curl, python3.
# ============================================================================
set -euo pipefail

API="https://api.bugsnag.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# repo-root/.claude/.secrets/bugsnag.env  (scripts live in .claude/scripts/bugsnag)
SECRET_FILE="${BUGSNAG_ENV_FILE:-$SCRIPT_DIR/../../.secrets/bugsnag.env}"

die() { echo "bugsnag: $*" >&2; exit 1; }

load_secrets() {
  [ -f "$SECRET_FILE" ] || die "secret file not found: $SECRET_FILE
  → cp .claude/.secrets/bugsnag.env.example .claude/.secrets/bugsnag.env and add your token."
  # shellcheck disable=SC1090
  set -a; . "$SECRET_FILE"; set +a
  [ -n "${BUGSNAG_AUTH_TOKEN:-}" ] || die "BUGSNAG_AUTH_TOKEN is empty in $SECRET_FILE"
}

# GET <path> [query] → raw JSON on stdout. Fails loudly on non-2xx.
bs_get() {
  local path="$1"; shift || true
  local url="$API$path"
  local body http
  # --globoff: error filters use [bracket] syntax; without it curl treats
  # [...] as a URL glob range. Filtered calls pass params via -G/--data-urlencode
  # (appended as the query string) so brackets never live in the URL template.
  body="$(curl -sS --globoff -w $'\n%{http_code}' \
    -H "Authorization: token $BUGSNAG_AUTH_TOKEN" \
    -H "X-Version: 2" \
    -H "Content-Type: application/json" \
    "$url" "$@")" || die "curl failed for $url"
  http="${body##*$'\n'}"
  body="${body%$'\n'*}"
  case "$http" in
    2*) printf '%s' "$body" ;;
    401|403) die "auth rejected ($http) — token invalid or lacking scope. Rotate/check it in the Bugsnag UI." ;;
    404) die "not found ($http): $path" ;;
    *) die "HTTP $http for $path: $(printf '%s' "$body" | head -c 300)" ;;
  esac
}

org_id() {
  if [ -n "${BUGSNAG_ORG_ID:-}" ]; then printf '%s' "$BUGSNAG_ORG_ID"; return; fi
  bs_get "/user/organizations" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d[0]["id"] if d else "")'
}

# Cache projects JSON once per invocation in a temp file.
PROJECTS_CACHE=""
projects_json() {
  if [ -z "$PROJECTS_CACHE" ]; then
    PROJECTS_CACHE="$(bs_get "/organizations/$(org_id)/projects?per_page=100")"
  fi
  printf '%s' "$PROJECTS_CACHE"
}

# Resolve a <project> selector → project id (exits on miss/ambiguity).
resolve_project() {
  local sel="$1"
  # NB: read projects from the pipe (stdin) and the selector from argv. Do NOT
  # use a heredoc here — a heredoc would rebind stdin and starve json.load.
  projects_json | python3 -c '
import sys, json
sel = sys.argv[1].strip().lower()
projects = json.load(sys.stdin)
# An exact match on id / api_key / FULL name wins. Use the full name, the
# api_key, or the id for unambiguous targeting; a partial-name substring that
# matches more than one project (e.g. "pombo api" hits both "Pombo API LOCAL"
# and "Pombo API PROD") is rejected as ambiguous below.
exact = [p for p in projects if sel in (p.get("id","").lower(), p.get("api_key","").lower(), p.get("name","").lower())]
if len(exact) == 1:
    print(exact[0]["id"]); sys.exit(0)
def match(p):
    return sel in p.get("name","").lower()
hits = [p for p in projects if match(p)]
if not hits:
    sys.stderr.write("bugsnag: no project matches [%s]. Known: %s\n" % (sel, ", ".join(p["name"] for p in projects)))
    sys.exit(3)
if len(hits) > 1:
    sys.stderr.write("bugsnag: [%s] is ambiguous: %s\n" % (sel, ", ".join(p["name"] for p in hits)))
    sys.exit(3)
print(hits[0]["id"])
' "$sel"
}

cmd_whoami() {
  bs_get "/user/organizations" | python3 -c '
import sys,json
d=json.load(sys.stdin)
for o in d:
    print("org:", o.get("name"), "| id:", o.get("id"), "| slug:", o.get("slug"))
print("token: OK (read access confirmed)")
'
}

cmd_projects() {
  projects_json | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("%-22s %-9s %-34s %s" % ("PROJECT","TYPE","NOTIFIER_API_KEY","RELEASE_STAGES_SEEN"))
print("-"*92)
for p in d:
    stages = p.get("release_stages") or []
    flag = "" if stages else "   ⚠ no events yet"
    print("%-22s %-9s %-34s %s%s" % (p.get("name",""), p.get("type",""), p.get("api_key",""), stages, flag))
'
}

cmd_errors() {
  local pid since
  pid="$(resolve_project "${1:?usage: errors <project> [since]}")"
  since="${2:-7d}"
  bs_get "/projects/$pid/errors" -G \
    --data-urlencode "per_page=15" \
    --data-urlencode "sort=events" \
    --data-urlencode "direction=desc" \
    --data-urlencode "filters[event.since][][type]=eq" \
    --data-urlencode "filters[event.since][][value]=$since" \
    --data-urlencode "filters[error.status][][type]=eq" \
    --data-urlencode "filters[error.status][][value]=open" \
    | python3 -c '
import sys,json
d=json.load(sys.stdin)
if not isinstance(d,list) or not d:
    print("No open errors in window."); sys.exit(0)
print("%-40s %-7s %-7s %-10s %s" % ("ERROR","EVENTS","USERS","SEVERITY","LAST_SEEN"))
print("-"*100)
for e in d:
    cls=(e.get("error_class") or "")[:24]
    msg=(e.get("message") or "")[:14]
    name=("%s: %s"%(cls,msg))[:40]
    print("%-40s %-7s %-7s %-10s %s" % (name, e.get("events",0), e.get("users",0), e.get("severity",""), e.get("last_seen","")))
print()
print("ids:")
for e in d[:10]:
    print(" ", e.get("id"), "|", (e.get("error_class") or "")[:60])
'
}

cmd_error() {
  local pid eid
  pid="$(resolve_project "${1:?usage: error <project> <errorId>}")"
  eid="${2:?usage: error <project> <errorId>}"
  echo "── error ──"
  bs_get "/projects/$pid/errors/$eid" | python3 -c '
import sys,json
e=json.load(sys.stdin)
for k in ("error_class","message","context","severity","status","events","users","first_seen","last_seen","release_stages"):
    print("%-14s %s" % (k+":", e.get(k)))
'
  echo "── latest event ──"
  bs_get "/projects/$pid/errors/$eid/latest_event" | python3 -c '
import sys,json
ev=json.load(sys.stdin)
print("app:", (ev.get("app") or {}).get("release_stage"), "| version:", (ev.get("app") or {}).get("version"))
exs=ev.get("exceptions") or []
for ex in exs[:1]:
    print("exception:", ex.get("error_class"), "-", ex.get("message"))
    for f in (ex.get("stacktrace") or [])[:6]:
        print("   at %s (%s:%s)" % (f.get("method"), f.get("file"), f.get("line_number")))
' || echo "(no latest event)"
}

cmd_trends() {
  local pid buckets out
  pid="$(resolve_project "${1:?usage: trends <project> [buckets]}")"
  buckets="${2:-14}"
  out="$(bs_get "/projects/$pid/trend?buckets_count=$buckets" 2>/dev/null)" \
    || { echo "Event trend not available for this project."; return 0; }
  printf '%s' "$out" | python3 -c '
import sys,json
try: d=json.load(sys.stdin)
except Exception: print("No trend data."); sys.exit(0)
buckets=d if isinstance(d,list) else d.get("buckets",[])
if not buckets: print("No trend data."); sys.exit(0)
mx=max((b.get("events_count",0) for b in buckets), default=1) or 1
print("event volume per bucket:")
for b in buckets:
    n=b.get("events_count",0)
    bar="#"*int(40*n/mx)
    print("%-22s %5d %s" % (b.get("from",""), n, bar))
'
}

cmd_stability() {
  local pid out
  pid="$(resolve_project "${1:?usage: stability <project>}")"
  out="$(bs_get "/projects/$pid/stability_trend" 2>/dev/null)" \
    || { echo "No stability data (the project has no sessions yet)."; return 0; }
  [ -n "$out" ] || { echo "No stability data (the project has no sessions yet)."; return 0; }
  printf '%s' "$out" | python3 -c '
import sys,json
try: d=json.load(sys.stdin)
except Exception: print("No stability data (no sessions yet)."); sys.exit(0)
pts=d.get("timeline_points",[]) if isinstance(d,dict) else []
pts=[p for p in pts if p.get("total_sessions_count",0) or p.get("users_seen",0)]
if not pts: print("No sessions in the window — stability is undefined until traffic arrives."); sys.exit(0)
print("stage: %s" % d.get("release_stage_name"))
print("%-12s %-9s %-13s %s" % ("DATE","SESSIONS","SESSION_STAB","USER_STAB"))
for p in pts[-14:]:
    s=p.get("total_sessions_count",0)
    sess=100.0*(1-p.get("unhandled_rate",0.0))
    usr=100.0*(1-p.get("unhandled_user_rate",0.0))
    print("%-12s %-9d %-13s %s" % (p.get("bucket_start","")[:10], s, "%.3f%%"%sess, "%.3f%%"%usr))
'
}

cmd_monitor() {
  local since="${1:-7d}" tmp
  echo "=================  POMBO · BUGSNAG MONITOR  (window: $since)  ================="
  echo
  # mktemp (not a fixed /tmp name) so two concurrent monitors never clobber each
  # other. The heredoc below reads this FILE (not stdin), so it is safe — unlike
  # a piped reader, which a heredoc would starve. Cleaned up inline: a `RETURN`
  # trap would persist and re-fire when main() returns, tripping `set -u` on the
  # now-out-of-scope local `tmp` (the "tmp: unbound variable" bug).
  tmp="$(mktemp "${TMPDIR:-/tmp}/bs_mon.XXXXXX")"
  projects_json > "$tmp"
  python3 - "$since" "$tmp" <<'PY'
import sys, json, subprocess, os
since, projects_file = sys.argv[1], sys.argv[2]
projects = json.load(open(projects_file))
script = os.environ.get("BUGSNAG_SELF")
if not script:
    sys.stderr.write("bugsnag: BUGSNAG_SELF unset — call monitor via the CLI entrypoint, not by sourcing.\n")
    sys.exit(1)
for p in projects:
    name, pid = p.get("name"), p.get("id")
    stages = p.get("release_stages") or []
    receiving = "RECEIVING" if stages else "⚠ NO EVENTS EVER — check the notifier api_key in this env"
    print("● %-20s [%s]  %s" % (name, p.get("type"), receiving))
    print("  api_key: %s  stages: %s" % (p.get("api_key"), stages or "[]"))
    try:
        out = subprocess.run([script, "errors", pid, since], capture_output=True, text=True, timeout=40)
        if out.returncode != 0:
            print("  (could not load errors: %s)" % (out.stderr.strip() or "exit %d" % out.returncode))
            print()
            continue
        lines = [l for l in out.stdout.splitlines() if l.strip()]
        # print the first few error rows (skip header underline)
        body = [l for l in lines if not l.startswith("-") and not l.startswith("ids:") and not l.startswith("ERROR")]
        if not body or body[0].startswith("No open errors"):
            print("  top errors: none open")
        else:
            print("  top errors:")
            for l in body[:5]:
                if l.startswith(" "):  # id lines
                    continue
                print("    " + l)
    except Exception as ex:
        print("  (could not load errors: %s)" % ex)
    print()
PY
  rm -f "$tmp"
}

cmd_raw() {
  # Fetch once; pretty-print if it is JSON, otherwise echo the raw body — never
  # re-issue the request (a second GET would double the load and the side effects).
  local out
  out="$(bs_get "${1:?usage: raw <path>}")"
  printf '%s' "$out" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$out"
}

main() {
  local cmd="${1:-}"; shift || true
  [ -n "$cmd" ] || { grep '^#   ' "$0" | sed 's/^#   //'; exit 0; }
  load_secrets
  export BUGSNAG_SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  case "$cmd" in
    whoami)   cmd_whoami ;;
    projects) cmd_projects ;;
    errors)    cmd_errors "$@" ;;
    error)     cmd_error "$@" ;;
    trends)    cmd_trends "$@" ;;
    stability) cmd_stability "$@" ;;
    monitor)   cmd_monitor "$@" ;;
    raw)      cmd_raw "$@" ;;
    *) die "unknown command '$cmd'. Run with no args for usage." ;;
  esac
}

main "$@"

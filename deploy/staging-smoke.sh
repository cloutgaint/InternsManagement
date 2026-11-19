#!/usr/bin/env bash
# Read-only staging smoke test. Does not authenticate, migrate, or modify data.
set -euo pipefail
BASE_URL="${1:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "Usage: bash deploy/staging-smoke.sh https://staging.example.com" >&2
  exit 2
fi
if [[ ! "$BASE_URL" =~ ^https://[^/]+/?$ ]]; then
  echo "Use a staging HTTPS origin only (no path, query, or credentials)." >&2
  exit 2
fi
BASE_URL="${BASE_URL%/}"
echo "Read-only smoke test: $BASE_URL"
failures=0
for route in / /login /register /admin /intern /mentor /college-coordinator; do
  code=$(curl --silent --show-error --location --max-redirs 3 --max-time 15 --output /dev/null --write-out '%{http_code}' "$BASE_URL$route") || code="000"
  echo "$route => HTTP $code"
  if [[ "$code" != 200 ]]; then failures=$((failures+1)); fi
done
health=$(curl --silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}' "$BASE_URL/api/health") || health="000"
echo "/api/health => HTTP $health"
if [[ "$health" != 200 ]]; then failures=$((failures+1)); fi
for route in /api/admin/dashboard /api/intern/dashboard /api/mentor/dashboard /api/college-coordinator/dashboard; do
  code=$(curl --silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}' "$BASE_URL$route") || code="000"
  echo "$route (anonymous) => HTTP $code"
  if [[ "$code" != 401 ]]; then failures=$((failures+1)); fi
done
hsts=$(curl --silent --show-error --head --max-time 15 "$BASE_URL/" | tr -d '\r' | grep -i '^strict-transport-security:' || true)
if [[ -z "$hsts" ]]; then
  echo "Missing Strict-Transport-Security header"
  failures=$((failures+1))
else
  echo "$hsts"
fi
if (( failures > 0 )); then
  echo "FAIL: $failures staging smoke check(s) failed" >&2
  exit 1
fi
echo "PASS: read-only staging smoke checks. Authenticated browser and device acceptance still required."

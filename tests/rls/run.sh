#!/usr/bin/env bash
#
# Run the Row Level Security policy tests against a real Postgres.
#
# The unit suite checks that supabase-setup.sql *says* the right thing. This
# checks that Postgres actually *behaves* the right way when the script runs:
# anon reads nothing, one account cannot touch another account's rows, and an
# unqualified DELETE cannot empty someone else's vault.
#
# Requires: psql, and a Postgres you can create a database on.
#
#   ./tests/rls/run.sh
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=secret ./tests/rls/run.sh
#
# Made with love by Pink Pixel.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PGHOST="${PGHOST:-localhost}"
PGUSER="${PGUSER:-postgres}"
TEST_DB="${KEYPER_RLS_TEST_DB:-keyper_rls_test}"

export PGHOST PGUSER

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install the Postgres client to run these tests." >&2
  exit 127
fi

if ! psql -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
  echo "Could not connect to Postgres at ${PGUSER}@${PGHOST}." >&2
  echo "Set PGHOST/PGUSER/PGPASSWORD, or start Postgres, then retry." >&2
  exit 1
fi

cleanup() {
  psql -d postgres -q -c "DROP DATABASE IF EXISTS ${TEST_DB};" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Creating throwaway database ${TEST_DB}"
psql -d postgres -q -c "DROP DATABASE IF EXISTS ${TEST_DB};"
psql -d postgres -q -c "CREATE DATABASE ${TEST_DB};"

echo "==> Installing Supabase auth shim (auth.uid, anon/authenticated roles)"
psql -d "${TEST_DB}" -v ON_ERROR_STOP=1 -q -f "${SCRIPT_DIR}/00-supabase-shim.sql"

echo "==> Applying the real supabase-setup.sql"
psql -d "${TEST_DB}" -v ON_ERROR_STOP=1 -q -f "${REPO_ROOT}/supabase-setup.sql" >/dev/null

echo "==> Running policy assertions"

# Capture psql's real exit status rather than the pipeline's, so a failed
# assertion cannot be masked by the filter that prettifies the output.
set +e
assertion_output="$(psql -d "${TEST_DB}" -v ON_ERROR_STOP=1 -f "${SCRIPT_DIR}/01-policy-assertions.sql" 2>&1)"
assertion_status=$?
set -e

echo "${assertion_output}" | grep -E 'NOTICE:|ERROR:|ALL RLS' || true

if [ "${assertion_status}" -ne 0 ]; then
  echo ""
  echo "❌ RLS policy tests FAILED" >&2
  exit 1
fi

echo ""
echo "✅ RLS policy tests passed"

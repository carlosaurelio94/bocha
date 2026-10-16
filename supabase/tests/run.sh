#!/usr/bin/env bash
# Corre schema.sql + migraciones + tests SQL en una base Postgres descartable.
# Uso: PGHOST=... PGPORT=... PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB="bocha_test_$$"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "CREATE DATABASE $DB"
trap 'psql -q -d postgres -c "DROP DATABASE IF EXISTS $DB" >/dev/null' EXIT

run() { psql -v ON_ERROR_STOP=1 -q -X -d "$DB" -f "$1"; }

run tests/00_supabase_stubs.sql
run schema.sql
for m in migrations/*.sql; do run "$m"; done
# Las migraciones son idempotentes: correrlas dos veces no debe fallar
for m in migrations/*.sql; do run "$m"; done
for t in tests/[1-9]*_test.sql; do run "$t"; done

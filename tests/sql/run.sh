#!/usr/bin/env bash
# Teste l'isolation des données sur une base PostgreSQL locale jetable.
# Usage : PGHOST=... PGPORT=... PGUSER=postgres bash tests/sql/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=zenoa_iso_test
psql -q -v ON_ERROR_STOP=1 -c "drop database if exists $DB" -c "create database $DB" postgres
export PGDATABASE=$DB
psql -q -v ON_ERROR_STOP=1 -f tests/sql/stub-auth.sql
psql -q -v ON_ERROR_STOP=1 -c "insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'TON_EMAIL@exemple.fr')"
psql -q -v ON_ERROR_STOP=1 -f espace.sql 2>&1 | grep -v "NOTICE" || true
psql -q -v ON_ERROR_STOP=1 -f securite.sql 2>&1 | grep -v "NOTICE" || true
psql -q -v ON_ERROR_STOP=1 -f prospection.sql 2>&1 | grep -v "NOTICE" || true
psql -q -v ON_ERROR_STOP=1 -f audits.sql 2>&1 | grep -v "NOTICE" || true
psql -q -v ON_ERROR_STOP=1 -f tests/sql/isolation.sql

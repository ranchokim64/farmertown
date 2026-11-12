#!/usr/bin/env bash
# 로컬 Postgres 에서 마이그레이션 + API 테스트 실행
#   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres npm run test:db
# 테스트용 데이터베이스(ft_test)를 새로 만들고 Supabase 의 anon/authenticated 역할을 흉내 냅니다.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${TEST_DATABASE_URL:?TEST_DATABASE_URL 을 지정하세요 (예: postgres://postgres@127.0.0.1:5432/postgres)}"
DB="${TEST_DATABASE_URL%/*}/ft_test"

psql "$TEST_DATABASE_URL" -qX -v ON_ERROR_STOP=1 <<'SQL'
drop database if exists ft_test;
create database ft_test encoding 'UTF8' template template0;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
SQL
# Supabase 와 같은 기본 권한 (새 테이블/함수에 공개 역할 권한이 자동으로 붙는 상황에서도 막히는지 확인)
psql "$DB" -qX -v ON_ERROR_STOP=1 -c "grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  create schema if not exists extensions;"

for f in migrations/*.sql; do
  for i in 1 2; do # 두 번 실행해도 안전한지
    psql "$DB" -qX -v ON_ERROR_STOP=1 -f "$f" 2>&1 | grep -v 'already exists, skipping' || true
  done
done
psql "$DB" -qX -v ON_ERROR_STOP=1 -f tests/api_test.sql
bash tests/lock_test.sh "$DB"

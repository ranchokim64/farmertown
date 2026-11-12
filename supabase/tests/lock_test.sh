#!/usr/bin/env bash
# 동시성 테스트 (2026-11-11 장애 재발 방지)
# 같은 학교(같은 IP)의 다른 요청이 IP 행을 잡고 있어도, 순위 조회·캐시된 학교 검색은
# 기다리지 않고 Supabase anon 의 3초 시간 제한 안에 응답해야 함.
set -euo pipefail
DB="$1"
H='{"x-forwarded-for": "198.51.100.7, 10.0.0.1"}'
psql "$DB" -qX -c "select ft_api_search_schools('햇살')" >/dev/null # 캐시 채우기
# A: 같은 학교 요청이 IP 행을 잠근 채 4초 머묾
psql "$DB" -qX -c "begin; set local request.headers = '$H'; select ft_limited('ip:198.51.100.7', 1200); select pg_sleep(4); commit;" >/dev/null &
A=$!
sleep 0.5
check() { # 이름, SQL
  local t0 t1
  t0=$(date +%s%N)
  psql "$DB" -qX -v ON_ERROR_STOP=1 -c "set statement_timeout = '3s'; set request.headers = '$H'; set role anon; $2" >/dev/null
  t1=$(date +%s%N)
  local ms=$(( (t1 - t0) / 1000000 ))
  if (( ms > 1000 )); then echo "❌ $1: ${ms}ms (잠금 대기)"; exit 1; fi
  echo "✔ $1: ${ms}ms (기다리지 않음)"
}
check '같은 학교 잠금 중 순위 조회' "select ft_api_leaderboard(5, 'demo:haetsal');"
check '같은 학교 잠금 중 학교 검색(캐시)' "select ft_api_search_schools('햇살');"
wait $A
echo '✅ 동시성 테스트 통과'

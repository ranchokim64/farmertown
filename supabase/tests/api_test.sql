-- Supabase API 함수 테스트: 브라우저와 같은 anon 역할로, 실제처럼 호출마다 별도 트랜잭션으로 실행합니다.
-- 하나라도 실패하면 ERROR 로 멈춥니다.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
update ft_config set value = '0' where key = 'min_ms_per_quest';
update ft_config set value = '200' where key = 'quest_cooldown_ms';
create function pg_temp.ok(cond boolean, msg text) returns text language plpgsql as $$
begin
  if cond is not true then raise exception '❌ %', msg; end if;
  return '✔ ' || msg;
end $$;
select gen_random_uuid() as sid, gen_random_uuid() as sid2, gen_random_uuid() as nosid \gset
set request.headers = '{"x-forwarded-for": "203.0.113.9, 10.0.0.1"}';
set role anon;

-- 테이블/내부 함수 직접 접근 차단
\echo '(아래 permission denied 오류 3개는 정상: 직접 접근이 막히는지 확인하는 것)'
\set ON_ERROR_STOP 0
\set QUIET 1
select count(*) from ft_sessions;
select ft_complete_quest(:'sid', 'soil', 9999, false);
select ft_rate_hit('x', 1, 1000);
\set ON_ERROR_STOP 1
select pg_temp.ok(not has_table_privilege('anon', 'ft_sessions', 'select'), 'anon 은 테이블을 읽을 수 없음');
select pg_temp.ok(not has_function_privilege('anon', 'ft_complete_quest(uuid,text,int,boolean)', 'execute'), 'anon 은 내부 함수를 호출할 수 없음');
select pg_temp.ok(has_function_privilege('anon', 'ft_api_complete(text,text)', 'execute'), 'anon 은 API 함수를 호출할 수 있음');

-- 학교 검색 (NEIS 접속 불가 시 예시 목록)
select pg_temp.ok(jsonb_array_length(ft_api_search_schools('햇살') -> 'schools') >= 1, '학교 검색');

-- 입력 검증
select pg_temp.ok(ft_api_create_session('nope', '농부', '', '우리초') ->> 'status' = '400', '잘못된 세션 ID 거부');
select pg_temp.ok(ft_api_create_session(:'sid', '씨 1 발', '', '우리초') ->> 'error' = 'BAD_NICKNAME', '비속어 우회 표현 거부');
select pg_temp.ok(ft_api_create_session(:'sid', '가', '', '우리초') ->> 'error' = 'BAD_NICKNAME', '짧은 닉네임 거부');
select pg_temp.ok(ft_api_create_session(:'sid', '농부', '', '시발초') ->> 'error' = 'BAD_SCHOOL', '비속어 학교명 거부');
select pg_temp.ok(ft_api_get_session(:'nosid') ->> 'status' = '404', '없는 세션 404');

-- 세션 생성: 예시 학교는 공식 이름으로 고정, 같은 UUID 는 복구
select pg_temp.ok(ft_api_create_session(:'sid', '꼬마 농부', 'demo:haetsal', '가짜이름') -> 'school' ->> 'name' = '햇살초등학교', '학교 이름 위조 방지');
select pg_temp.ok(ft_api_create_session(:'sid', '다른이름', '', '다른학교') ->> 'nickname' = '꼬마 농부', '세션 복구');

-- 퀘스트
select pg_temp.ok(ft_api_complete(:'sid', 'final') ->> 'status' = '409', '리본 5개 전 최종 퀘스트 거부');
select pg_temp.ok(ft_api_complete(:'sid', 'hack') ->> 'status' = '400', '알 수 없는 퀘스트 거부');
select pg_temp.ok(ft_api_complete(:'sid', 'soil') ->> 'added' = '10', '퀘스트 +10점');
select pg_temp.ok(ft_api_complete(:'sid', 'snail') ->> 'status' = '429', '연속 요청 쿨타임');
select pg_sleep(0.25) \g /dev/null
select pg_temp.ok(ft_api_complete(:'sid', 'snail') ->> 'added' = '10', 'snail');
select pg_sleep(0.25) \g /dev/null
select pg_temp.ok(ft_api_complete(:'sid', 'soil') ->> 'added' = '0', '중복 완료는 0점');
select pg_sleep(0.25) \g /dev/null
select pg_temp.ok(ft_api_complete(:'sid', 'scarecrow') ->> 'added' = '10', 'scarecrow');
select pg_sleep(0.25) \g /dev/null
select pg_temp.ok(ft_api_complete(:'sid', 'tteok') ->> 'added' = '10', 'tteok');
select pg_sleep(0.25) \g /dev/null
select pg_temp.ok(ft_api_complete(:'sid', 'smartfarm') ->> 'added' = '10', 'smartfarm');
select pg_sleep(0.25) \g /dev/null
select ft_api_complete(:'sid', 'final') as fin \gset
select pg_temp.ok((:'fin'::jsonb) ->> 'added' = '50' and (:'fin'::jsonb) ->> 'score' = '100', '최종 +50점, 총 100점');
select pg_temp.ok(((:'fin'::jsonb) ->> 'speedRank')::int >= 1 and ((:'fin'::jsonb) ->> 'clearTimeMs')::int >= 0, '클리어 기록과 순위');

-- 랭킹
select ft_api_leaderboard(5, 'demo:haetsal') as lb \gset
select pg_temp.ok(((:'lb'::jsonb) -> 'mySchool' ->> 'score')::int >= 100, '학교 점수 합산');
select pg_temp.ok(exists (select 1 from jsonb_array_elements((:'lb'::jsonb) -> 'speedrun') e where e ->> 'nickname' = '꼬마 농부'), '명예의 전당');

-- 최소 소요 시간 (매크로 방지)
reset role;
update ft_config set value = '60000' where key = 'min_ms_per_quest';
set role anon;
select ft_api_create_session(:'sid2', '매크로', '', '우리초등학교') \g /dev/null
select ft_api_complete(:'sid2', 'soil') as fast \gset
select pg_temp.ok((:'fast'::jsonb) ->> 'status' = '429' and ((:'fast'::jsonb) ->> 'retryAfterMs')::int > 50000, '너무 빠른 완료 거부');

-- IP 기록 (Supabase 가 넘겨 주는 X-Forwarded-For 의 첫 번째 주소)
reset role;
select pg_temp.ok(exists (select 1 from ft_rate_limits where key = 'rl:create:203.0.113.9'), '학생 IP 기준 제한');
update ft_config set value = '8000' where key = 'min_ms_per_quest';
update ft_config set value = '3000' where key = 'quest_cooldown_ms';
\echo '✅ 모든 API 테스트 통과'

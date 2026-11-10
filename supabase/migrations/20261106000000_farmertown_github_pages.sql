-- 가래떡 마을의 황금 들판 · Supabase(Postgres) 백엔드
--
-- GitHub Pages(정적 사이트)에는 서버가 없으므로, 게임 서버가 하던 일을 모두 이 SQL 함수들이 합니다.
-- 브라우저는 Supabase 공개 키(publishable/anon)로 ft_api_* 함수 5개만 호출할 수 있습니다.
--
--   ft_api_search_schools(p_q)                         학교 검색 (NEIS 프록시 + 캐시)
--   ft_api_create_session(p_session, p_nickname, ...)  세션 생성/복구 (닉네임 비속어 필터)
--   ft_api_get_session(p_session)                      세션 조회
--   ft_api_complete(p_session, p_quest)                퀘스트 완료 → 학교 점수 합산
--   ft_api_leaderboard(p_limit, p_school)              학교 TOP N, 스피드런 TOP 10, 내 학교 순위
--
-- 보안: 모든 테이블은 RLS 를 켜고 공개 역할 권한을 뺐습니다(직접 읽기/쓰기 불가).
--       API 함수는 SECURITY DEFINER 로 실행되며 입력 검증, Rate Limit, 쿨타임, 최소 소요 시간을 직접 검사합니다.
--
-- 사용법: Supabase 대시보드 → SQL Editor 에 통째로 붙여 넣고 Run. (여러 번 실행해도 안전, 데이터 유지)

-- http 확장: DB 안에서 나이스(NEIS) 학교 검색 API 호출용 (없으면 예시 학교 목록으로 대체)
do $$
begin
  create extension if not exists http with schema extensions;
exception when others then
  raise notice 'http 확장을 켤 수 없어 학교 검색은 예시 목록만 사용합니다: %', sqlerrm;
end $$;

-- ── 테이블 ─────────────────────────────────────────────
create table if not exists ft_sessions (
  id uuid primary key,                    -- 브라우저 LocalStorage 의 임시 UUID
  nickname text not null,
  school_code text not null,
  school_name text not null,
  started_at timestamptz not null default now(),
  score integer not null default 0,
  clear_time_ms integer                   -- 최종 클리어 기록 (서버가 계산)
);
create index if not exists ft_sessions_clear_idx on ft_sessions (clear_time_ms) where clear_time_ms is not null;

create table if not exists ft_session_quests (
  session_id uuid not null references ft_sessions (id) on delete cascade,
  quest_id text not null,
  completed_at timestamptz not null default now(),
  primary key (session_id, quest_id)      -- 같은 퀘스트 중복 점수 방지
);

create table if not exists ft_schools (
  code text primary key,                  -- NEIS 코드(B10:7010057) / custom:학교명 / demo:*
  name text not null,
  score bigint not null default 0,        -- 학교 대항전 누적 점수
  updated_at timestamptz not null default now()
);
create index if not exists ft_schools_score_idx on ft_schools (score desc) where score > 0;

create table if not exists ft_rate_limits (
  key text primary key,
  count integer not null,
  reset_at timestamptz not null
);

create table if not exists ft_cache (       -- 학교 검색 결과 캐시
  key text primary key,
  value jsonb not null,
  expires_at timestamptz not null
);

alter table ft_sessions enable row level security;
alter table ft_session_quests enable row level security;
alter table ft_schools enable row level security;
alter table ft_rate_limits enable row level security;
alter table ft_cache enable row level security;

-- Supabase 의 공개 역할(anon, authenticated)에서 권한 제거 (일반 Postgres 에서는 건너뜀)
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on ft_sessions, ft_session_quests, ft_schools, ft_rate_limits, ft_cache from anon, authenticated;
  end if;
end $$;

-- ── 함수 ───────────────────────────────────────────────
-- 고정 윈도 Rate Limit: 윈도 안에서 호출 수를 세고 허용 여부 반환
create or replace function ft_rate_hit(p_key text, p_limit int, p_window_ms int)
returns table (allowed boolean, retry_after_ms int)
language plpgsql as $$
#variable_conflict use_column
declare
  r ft_rate_limits;
begin
  insert into ft_rate_limits as t (key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_ms / 1000.0))
  on conflict (key) do update set
    count = case when t.reset_at <= now() then 1 else t.count + 1 end,
    reset_at = case when t.reset_at <= now() then excluded.reset_at else t.reset_at end
  returning t.* into r;

  -- 가끔 만료된 행 정리
  if random() < 0.01 then
    delete from ft_rate_limits where reset_at < now() - interval '10 minutes';
    delete from ft_cache where expires_at < now();
  end if;

  allowed := r.count <= p_limit;
  retry_after_ms := greatest(0, (extract(epoch from (r.reset_at - now())) * 1000)::int);
  return next;
end $$;

-- 쿨타임: p_ms 동안 1번만 허용
create or replace function ft_cooldown(p_key text, p_ms int)
returns table (allowed boolean, retry_after_ms int)
language plpgsql as $$
#variable_conflict use_column
begin
  insert into ft_rate_limits as t (key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_ms / 1000.0))
  on conflict (key) do update set count = 1, reset_at = excluded.reset_at
    where t.reset_at <= now();

  if found then
    allowed := true;
    retry_after_ms := 0;
  else
    allowed := false;
    select greatest(0, (extract(epoch from (reset_at - now())) * 1000)::int) into retry_after_ms
      from ft_rate_limits where key = p_key;
  end if;
  return next;
end $$;

-- 퀘스트 완료: 중복이면 added=false, 아니면 개인/학교 점수 합산 (최종이면 클리어 시간 기록)
create or replace function ft_complete_quest(p_session uuid, p_quest text, p_points int, p_final boolean)
returns table (added boolean, clear_time_ms int)
language plpgsql as $$
#variable_conflict use_column
declare
  v_code text;
  v_name text;
  v_clear int;
begin
  insert into ft_session_quests (session_id, quest_id) values (p_session, p_quest)
  on conflict do nothing;
  if not found then
    added := false;
    clear_time_ms := null;
    return next;
    return;
  end if;

  update ft_sessions s set
    score = s.score + p_points,
    clear_time_ms = case when p_final then (extract(epoch from (now() - s.started_at)) * 1000)::int else s.clear_time_ms end
  where s.id = p_session
  returning s.school_code, s.school_name, s.clear_time_ms into v_code, v_name, v_clear;

  insert into ft_schools as sc (code, name, score) values (v_code, v_name, p_points)
  on conflict (code) do update set score = sc.score + excluded.score, updated_at = now();

  added := true;
  clear_time_ms := case when p_final then v_clear else null end;
  return next;
end $$;

create table if not exists ft_config (     -- 운영 설정 (점수, 제한 값, NEIS 키)
  key text primary key,
  value text not null
);
alter table ft_config enable row level security;

insert into ft_config (key, value) values
  ('points_quest', '10'),               -- 퀘스트 1개당 학교 점수
  ('points_final', '50'),               -- 최종 엔딩 점수
  ('points_quiz', '20'),                -- 최종 보너스 퀴즈(5문제 모두 정답) 점수
  ('quest_cooldown_ms', '3000'),        -- 같은 세션의 퀘스트 완료 요청 최소 간격
  ('min_ms_per_quest', '8000'),         -- n번째 퀘스트는 시작 후 n × 이 값 이후에만 인정 (매크로 방지)
  ('rl_ip_per_min', '1200'),            -- IP 당 분당 API 호출 (학교는 IP 하나를 공유하므로 넉넉하게)
  ('rl_session_create_per_min', '120'), -- IP 당 분당 세션 생성
  ('rl_session_per_min', '60'),         -- 세션 당 분당 호출
  ('neis_api_key', '')                  -- 나이스 교육정보 개방 포털 인증키 (선택)
on conflict (key) do nothing;

-- ── 내부 도우미 (공개 역할은 호출 불가) ────────────────
create or replace function ft_cfg(p_key text) returns text
language sql stable as $$ select value from ft_config where key = p_key $$;

create or replace function ft_cfg_int(p_key text, p_default int) returns int
language sql stable as $$ select coalesce((select nullif(value, '')::int from ft_config where key = p_key), p_default) $$;

-- 요청한 학생의 IP (Supabase 게이트웨이가 넘겨 주는 헤더)
create or replace function ft_client_ip() returns text
language plpgsql stable as $$
declare
  h json := nullif(current_setting('request.headers', true), '')::json;
begin
  return coalesce(
    nullif(btrim(h ->> 'cf-connecting-ip'), ''),
    nullif(btrim(split_part(h ->> 'x-forwarded-for', ',', 1)), ''),
    'unknown'
  );
end $$;

create or replace function ft_err(p_status int, p_error text, p_message text, p_retry_after_ms int default null) returns jsonb
language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object('status', p_status, 'error', p_error, 'message', p_message, 'retryAfterMs', p_retry_after_ms))
$$;

-- Rate Limit 초과면 429 응답(jsonb), 아니면 null
create or replace function ft_limited(p_key text, p_limit int, p_window_ms int default 60000) returns jsonb
language plpgsql as $$
declare
  r record;
begin
  select * into r from ft_rate_hit('rl:' || p_key, p_limit, p_window_ms);
  if r.allowed then
    return null;
  end if;
  return ft_err(429, 'RATE_LIMITED', '조금만 천천히! 잠시 후 다시 시도해 주세요.', r.retry_after_ms);
end $$;

-- 비속어 필터: 공백·숫자·기호를 지운 뒤 검사 ("시 1 발", "씨.발", "ㅅㅂ" 우회 차단)
create or replace function ft_has_profanity(p_text text) returns boolean
language sql immutable as $$
  select exists (
    select 1
    from unnest(array[
    '시발', '씨발', '씨빨', '시빨', '씨바', '쌍년', '쌍놈', '썅',
    '씹', '좆', '존나', '졸라', '조낸', '병신', '븅신', '빙신',
    '지랄', '염병', '엠창', '니미', '느금', '니애미', '니에미', '애미',
    '애비', '개새', '개색', '개세끼', '개쉐', '새끼', '쌔끼', '미친년',
    '미친놈', '미친새', '꺼져', '닥쳐', '뒤져', '뒈져', '등신', '또라이',
    '찐따', '장애인', '틀딱', '한남', '김치녀', '보지', '자지', '섹스',
    '야동', '변태', '창녀', '걸레', '호구', '멍청이', '바보새', 'ㅅㅂ',
    'ㅆㅂ', 'ㅂㅅ', 'ㅈㄹ', 'ㅈㄴ', 'ㄲㅈ', 'ㄷㅊ', 'ㅁㅊ', 'ㅅㄲ',
    'ㄱㅅㄲ', 'ㅄ', 'fuck', 'shit', 'bitch', 'sex', 'porn', 'dick',
    'pussy', 'asshole', 'bastard', 'nigger', 'nigga', 'fck', 'sibal', 'ssibal',
    '관리자', '운영자', 'admin', '선생님공지'
    ]) as w
    where position(w in regexp_replace(lower(normalize(coalesce(p_text, ''), NFC)), '[[:space:][:digit:][:punct:]]', '', 'g')) > 0
  )
$$;

create or replace function ft_sample_schools() returns jsonb
language sql immutable as $$
  select '[
    {"code": "demo:garaetteok", "name": "가래떡초등학교", "region": "예시"},
    {"code": "demo:hwanggeum", "name": "황금들판초등학교", "region": "예시"},
    {"code": "demo:haetsal", "name": "햇살초등학교", "region": "예시"},
    {"code": "demo:baramgae", "name": "바람개비초등학교", "region": "예시"},
    {"code": "demo:ureong", "name": "우렁이초등학교", "region": "예시"},
    {"code": "demo:heoosu", "name": "허수아비초등학교", "region": "예시"},
    {"code": "demo:dangsan", "name": "당산나무초등학교", "region": "예시"},
    {"code": "demo:smartfarm", "name": "스마트팜초등학교", "region": "예시"}
  ]'::jsonb
$$;

create or replace function ft_session_json(p_id uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'sessionId', s.id,
    'nickname', s.nickname,
    'school', jsonb_build_object('code', s.school_code, 'name', s.school_name),
    'startedAt', (extract(epoch from s.started_at) * 1000)::bigint,
    'score', s.score,
    'clearTimeMs', s.clear_time_ms,
    'completed', coalesce((
      select jsonb_agg(q.quest_id order by array_position(array['soil', 'snail', 'scarecrow', 'tteok', 'smartfarm', 'final', 'quiz'], q.quest_id))
      from ft_session_quests q where q.session_id = s.id
    ), '[]'::jsonb)
  )
  from ft_sessions s where s.id = p_id
$$;

-- ── 공개 API (브라우저에서 호출) ───────────────────────
-- 오류는 HTTP 오류 대신 {"status": 400|404|409|429, "error", "message", "retryAfterMs"} 로 돌려줍니다.

create or replace function ft_api_search_schools(p_q text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_q text := left(btrim(coalesce(p_q, '')), 20);
  v_lim jsonb;
  v_res jsonb;
  v_body jsonb;
  v_rows jsonb;
  v_key text;
begin
  v_lim := ft_limited('ip:' || ft_client_ip(), ft_cfg_int('rl_ip_per_min', 1200));
  if v_lim is not null then return v_lim; end if;
  if v_q = '' then
    return jsonb_build_object('source', 'none', 'schools', '[]'::jsonb);
  end if;

  select value into v_res from ft_cache where key = 'schoolq:' || v_q and expires_at > now();
  if v_res is not null then return v_res; end if;

  begin
    v_key := coalesce(ft_cfg('neis_api_key'), '');
    perform http_set_curlopt('CURLOPT_TIMEOUT_MS', '3000');
    select content::jsonb into v_body from http_get(
      'https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=15'
      || '&SCHUL_KND_SC_NM=' || urlencode('초등학교')
      || '&SCHUL_NM=' || urlencode(v_q)
      || case when v_key <> '' then '&KEY=' || urlencode(v_key) else '' end
    );
    if v_body ? 'schoolInfo' then
      select e -> 'row' into v_rows from jsonb_array_elements(v_body -> 'schoolInfo') e where e ? 'row' limit 1;
    elsif coalesce(v_body -> 'RESULT' ->> 'CODE', '') <> 'INFO-200' then  -- INFO-200: 검색 결과 없음
      raise exception 'NEIS 오류: %', v_body -> 'RESULT';
    end if;
    v_res := jsonb_build_object('source', 'neis', 'schools', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', (x ->> 'ATPT_OFCDC_SC_CODE') || ':' || (x ->> 'SD_SCHUL_CODE'),
        'name', x ->> 'SCHUL_NM',
        'region', concat_ws(' ', x ->> 'LCTN_SC_NM', nullif(split_part(coalesce(x ->> 'ORG_RDNMA', ''), ' ', 2), ''))
      ))
      from jsonb_array_elements(coalesce(v_rows, '[]'::jsonb)) x
    ), '[]'::jsonb));
    -- 세션 생성 때 학교 이름 위조를 막기 위해 공식 이름 기억
    insert into ft_schools (code, name)
      select s ->> 'code', s ->> 'name' from jsonb_array_elements(v_res -> 'schools') s
    on conflict (code) do nothing;
    insert into ft_cache (key, value, expires_at) values ('schoolq:' || v_q, v_res, now() + interval '1 day')
    on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at;
  exception when others then
    v_res := jsonb_build_object('source', 'sample', 'schools', coalesce((
      select jsonb_agg(s) from jsonb_array_elements(ft_sample_schools()) s where position(v_q in s ->> 'name') > 0
    ), '[]'::jsonb));
  end;
  return v_res;
end $$;

create or replace function ft_api_create_session(p_session text, p_nickname text, p_school_code text, p_school_name text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ip text := ft_client_ip();
  v_lim jsonb;
  v_id uuid;
  v_existing jsonb;
  v_nick text;
  v_name text;
  v_code text;
  v_known text;
begin
  v_lim := ft_limited('ip:' || v_ip, ft_cfg_int('rl_ip_per_min', 1200));
  if v_lim is not null then return v_lim; end if;
  if coalesce(p_session, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return ft_err(400, 'BAD_SESSION_ID', '잘못된 세션입니다.');
  end if;
  v_id := p_session::uuid;

  -- 세션 복구: 이미 있으면 처음 정한 닉네임/학교 그대로
  v_existing := ft_session_json(v_id);
  if v_existing is not null then return v_existing; end if;

  v_lim := ft_limited('create:' || v_ip, ft_cfg_int('rl_session_create_per_min', 120));
  if v_lim is not null then return v_lim; end if;

  v_nick := regexp_replace(btrim(coalesce(p_nickname, '')), '\s+', ' ', 'g');
  if v_nick !~ '^[가-힣a-zA-Z0-9 ]{2,10}$' then
    return ft_err(400, 'BAD_NICKNAME', '닉네임은 한글·영문·숫자 2~10자로 지어 주세요.');
  end if;
  if ft_has_profanity(v_nick) then
    return ft_err(400, 'BAD_NICKNAME', '바르고 고운 말로 닉네임을 지어 주세요!');
  end if;

  v_name := btrim(coalesce(p_school_name, ''));
  if v_name = '' or char_length(v_name) > 20 or ft_has_profanity(v_name) then
    return ft_err(400, 'BAD_SCHOOL', '학교 이름을 다시 확인해 주세요.');
  end if;
  v_code := coalesce(p_school_code, '');
  if v_code = '' or v_code like 'custom:%' then
    v_code := 'custom:' || regexp_replace(v_name, '\s+', '', 'g');
  end if;
  if v_code !~ '^([A-Z][0-9]{2}:[0-9]{7}|demo:[a-z]+|custom:[가-힣a-zA-Z0-9]{2,20})$' then
    return ft_err(400, 'BAD_SCHOOL', '학교 정보를 다시 선택해 주세요.');
  end if;
  -- NEIS/예시 학교는 서버가 아는 공식 이름으로 고정
  if v_code not like 'custom:%' then
    select name into v_known from ft_schools where code = v_code;
    v_known := coalesce(v_known, (select s ->> 'name' from jsonb_array_elements(ft_sample_schools()) s where s ->> 'code' = v_code));
    v_name := coalesce(v_known, v_name);
  end if;

  insert into ft_schools (code, name) values (v_code, v_name) on conflict (code) do nothing;
  insert into ft_sessions (id, nickname, school_code, school_name) values (v_id, v_nick, v_code, v_name)
  on conflict (id) do nothing;
  return ft_session_json(v_id);
end $$;

create or replace function ft_api_get_session(p_session text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_lim jsonb;
  v jsonb;
begin
  v_lim := ft_limited('ip:' || ft_client_ip(), ft_cfg_int('rl_ip_per_min', 1200));
  if v_lim is not null then return v_lim; end if;
  if coalesce(p_session, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return ft_err(404, 'NO_SESSION', '세션을 찾을 수 없어요.');
  end if;
  v_lim := ft_limited('sess:' || p_session, ft_cfg_int('rl_session_per_min', 60));
  if v_lim is not null then return v_lim; end if;
  v := ft_session_json(p_session::uuid);
  return coalesce(v, ft_err(404, 'NO_SESSION', '세션을 찾을 수 없어요.'));
end $$;

create or replace function ft_api_complete(p_session text, p_quest text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_lim jsonb;
  v_id uuid;
  s jsonb;
  v_done jsonb;
  v_final boolean;
  v_nth int;
  v_min int;
  v_elapsed bigint;
  v_points int;
  r record;
  v_res jsonb;
begin
  v_lim := ft_limited('ip:' || ft_client_ip(), ft_cfg_int('rl_ip_per_min', 1200));
  if v_lim is not null then return v_lim; end if;
  if coalesce(p_session, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return ft_err(404, 'NO_SESSION', '세션을 찾을 수 없어요.');
  end if;
  v_id := p_session::uuid;
  v_lim := ft_limited('sess:' || p_session, ft_cfg_int('rl_session_per_min', 60));
  if v_lim is not null then return v_lim; end if;
  if p_quest is null or not (p_quest = any (array['soil', 'snail', 'scarecrow', 'tteok', 'smartfarm', 'final'])) then
    return ft_err(400, 'BAD_QUEST', '알 수 없는 퀘스트예요.');
  end if;

  s := ft_session_json(v_id);
  if s is null then return ft_err(404, 'NO_SESSION', '세션을 찾을 수 없어요.'); end if;
  v_done := s -> 'completed';
  if v_done ? p_quest then return s || jsonb_build_object('added', 0); end if; -- 멱등 처리

  v_final := p_quest = 'final';
  if v_final and not (v_done ?& array['soil', 'snail', 'scarecrow', 'tteok', 'smartfarm']) then
    return ft_err(409, 'NOT_READY', '감사 리본 5개를 모두 모아야 해요.');
  end if;

  -- 플레이 시간 기준 최소 소요 시간 (n번째 퀘스트는 n × min_ms_per_quest 이후)
  v_nth := jsonb_array_length(v_done) + 1;
  v_min := ft_cfg_int('min_ms_per_quest', 8000);
  v_elapsed := (extract(epoch from now()) * 1000)::bigint - (s ->> 'startedAt')::bigint;
  if v_elapsed < v_nth * v_min then
    return ft_err(429, 'RATE_LIMITED', '너무 빨라요! 마을을 조금 더 둘러보세요.', (v_nth * v_min - v_elapsed)::int);
  end if;

  select * into r from ft_cooldown('cd:quest:' || v_id, ft_cfg_int('quest_cooldown_ms', 3000));
  if not r.allowed then
    return ft_err(429, 'RATE_LIMITED', '조금만 천천히! 잠시 후 다시 시도해 주세요.', r.retry_after_ms);
  end if;

  v_points := case when v_final then ft_cfg_int('points_final', 50) else ft_cfg_int('points_quest', 10) end;
  select * into r from ft_complete_quest(v_id, p_quest, v_points, v_final);
  v_res := ft_session_json(v_id) || jsonb_build_object('added', case when r.added then v_points else 0 end);
  if r.added and v_final then
    v_res := v_res || jsonb_build_object('speedRank', (
      select count(*) + 1 from ft_sessions
      where clear_time_ms < (select clear_time_ms from ft_sessions where id = v_id)
    ));
  end if;
  return v_res;
end $$;

-- 최종 보너스 퀴즈: 5문제 정답 키가 맞으면 학교 점수 +points_quiz (세션당 1번, 'quiz' 완료 기록으로 멱등)
-- 정답 키는 client/src/game/data/story.js 의 QUIZ.final 정답 순서(FINAL_QUIZ_KEY)와 같아야 합니다.
create or replace function ft_api_final_quiz(p_session text, p_answers text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  c_key constant text := '12120';
  v_lim jsonb;
  v_id uuid;
  s jsonb;
  v_points int;
  r record;
begin
  v_lim := ft_limited('ip:' || ft_client_ip(), ft_cfg_int('rl_ip_per_min', 1200));
  if v_lim is not null then return v_lim; end if;
  if coalesce(p_session, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return ft_err(404, 'NO_SESSION', '세션을 찾을 수 없어요.');
  end if;
  v_id := p_session::uuid;
  v_lim := ft_limited('sess:' || p_session, ft_cfg_int('rl_session_per_min', 60));
  if v_lim is not null then return v_lim; end if;

  s := ft_session_json(v_id);
  if s is null then return ft_err(404, 'NO_SESSION', '세션을 찾을 수 없어요.'); end if;
  if not (s -> 'completed' ? 'final') then
    return ft_err(409, 'NOT_READY', '최종 미션을 먼저 끝내야 해요.');
  end if;
  if coalesce(p_answers, '') <> c_key then
    return s || jsonb_build_object('added', 0, 'passed', false);
  end if;
  if s -> 'completed' ? 'quiz' then return s || jsonb_build_object('added', 0, 'passed', true); end if; -- 멱등 처리

  select * into r from ft_cooldown('cd:quest:' || v_id, ft_cfg_int('quest_cooldown_ms', 3000));
  if not r.allowed then
    return ft_err(429, 'RATE_LIMITED', '조금만 천천히! 잠시 후 다시 시도해 주세요.', r.retry_after_ms);
  end if;

  v_points := ft_cfg_int('points_quiz', 20);
  select * into r from ft_complete_quest(v_id, 'quiz', v_points, false);
  return ft_session_json(v_id) || jsonb_build_object('added', case when r.added then v_points else 0 end, 'passed', true);
end $$;

create or replace function ft_api_leaderboard(p_limit int default 5, p_school text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_lim jsonb;
  v_limit int := least(greatest(coalesce(p_limit, 5), 1), 20);
  v_my jsonb;
  v_score int;
  v_rank int;
begin
  v_lim := ft_limited('ip:' || ft_client_ip(), ft_cfg_int('rl_ip_per_min', 1200));
  if v_lim is not null then return v_lim; end if;

  if p_school ~ '^([A-Z][0-9]{2}:[0-9]{7}|demo:[a-z]+|custom:[가-힣a-zA-Z0-9]{2,20})$' then
    select score::int into v_score from ft_schools where code = p_school;
    if coalesce(v_score, 0) > 0 then
      select count(*) + 1 into v_rank from ft_schools where score > v_score;
    else
      v_score := 0;
    end if;
    v_my := jsonb_build_object('code', p_school, 'rank', v_rank, 'score', v_score);
  end if;

  return jsonb_build_object(
    'schools', coalesce((
      select jsonb_agg(jsonb_build_object('rank', t.rn, 'code', t.code, 'name', t.name, 'score', t.score) order by t.rn)
      from (
        select row_number() over (order by score desc, updated_at) as rn, code, name, score::int as score
        from ft_schools where score > 0 order by score desc, updated_at limit v_limit
      ) t
    ), '[]'::jsonb),
    'speedrun', coalesce((
      select jsonb_agg(jsonb_build_object('rank', t.rn, 'nickname', t.nickname, 'schoolName', t.school_name, 'timeMs', t.clear_time_ms) order by t.rn)
      from (
        select row_number() over (order by clear_time_ms, started_at) as rn, nickname, school_name, clear_time_ms
        from ft_sessions where clear_time_ms is not null order by clear_time_ms, started_at limit 10
      ) t
    ), '[]'::jsonb),
    'mySchool', v_my,
    'updatedAt', (extract(epoch from now()) * 1000)::bigint
  );
end $$;

-- ── 권한 ──────────────────────────────────────────────
-- 내부 함수와 테이블은 누구도 직접 못 쓰게, API 함수 6개만 공개
revoke all on ft_sessions, ft_session_quests, ft_schools, ft_rate_limits, ft_cache, ft_config from public;
revoke execute on function
  ft_rate_hit(text, int, int), ft_cooldown(text, int), ft_complete_quest(uuid, text, int, boolean),
  ft_cfg(text), ft_cfg_int(text, int), ft_client_ip(), ft_err(int, text, text, int), ft_limited(text, int, int),
  ft_has_profanity(text), ft_sample_schools(), ft_session_json(uuid),
  ft_api_search_schools(text), ft_api_create_session(text, text, text, text), ft_api_get_session(text),
  ft_api_complete(text, text), ft_api_final_quiz(text, text), ft_api_leaderboard(int, text)
from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on ft_sessions, ft_session_quests, ft_schools, ft_rate_limits, ft_cache, ft_config from anon, authenticated;
    revoke execute on function
      ft_rate_hit(text, int, int), ft_cooldown(text, int), ft_complete_quest(uuid, text, int, boolean),
      ft_cfg(text), ft_cfg_int(text, int), ft_client_ip(), ft_err(int, text, text, int), ft_limited(text, int, int),
      ft_has_profanity(text), ft_sample_schools(), ft_session_json(uuid)
    from anon, authenticated;
    grant execute on function
      ft_api_search_schools(text), ft_api_create_session(text, text, text, text), ft_api_get_session(text),
      ft_api_complete(text, text), ft_api_final_quiz(text, text), ft_api_leaderboard(int, text)
    to anon, authenticated;
  end if;
end $$;

-- Supabase API 가 새 함수를 바로 인식하도록
notify pgrst, 'reload schema';

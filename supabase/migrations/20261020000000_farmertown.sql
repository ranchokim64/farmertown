-- 가래떡 마을의 황금 들판 · Supabase(Postgres) 스키마
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여 넣고 Run 하면 됩니다. (여러 번 실행해도 안전)
--
-- 보안: 모든 테이블에 RLS 를 켜고 정책을 만들지 않습니다.
--       → 브라우저용 anon 키로는 아무것도 읽거나 쓸 수 없고, Vercel 서버(DATABASE_URL)만 접근합니다.

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

-- 함수도 공개 역할에서는 호출 불가
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function ft_rate_hit(text, int, int), ft_cooldown(text, int), ft_complete_quest(uuid, text, int, boolean)
      from public, anon, authenticated;
  end if;
end $$;

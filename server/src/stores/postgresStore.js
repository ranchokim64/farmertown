// Postgres 저장소 (Supabase · Vercel 배포용).
// 스키마와 함수는 supabase/migrations/*.sql 참고. 원자적 처리는 SQL 함수(ft_*)가 담당합니다.
import postgres from 'postgres';

export function createPostgresStore(url, { max = 3 } = {}) {
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || url.includes('host=/');
  const sql = postgres(url, {
    prepare: false, // Supabase 커넥션 풀러(트랜잭션 모드, 6543 포트)에서 필요
    max,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: local ? false : 'require',
  });
  return postgresStore((text, params = []) => sql.unsafe(text, params), () => sql.end({ timeout: 5 }));
}

export function postgresStore(q, close = async () => {}) {
  const one = async (text, params) => (await q(text, params))[0];
  return {
    kind: 'postgres',

    async rateHit(key, limit, windowMs) {
      const r = await one('select * from ft_rate_hit($1, $2, $3)', [`rl:${key}`, limit, windowMs]);
      return { allowed: r.allowed, retryAfterMs: r.retry_after_ms };
    },

    async cooldown(key, ms) {
      const r = await one('select * from ft_cooldown($1, $2)', [`cd:${key}`, ms]);
      return { allowed: r.allowed, retryAfterMs: r.retry_after_ms };
    },

    async getSession(id) {
      const r = await one(
        `select nickname, school_code, school_name, score, clear_time_ms,
                (extract(epoch from started_at) * 1000)::bigint as started_ms,
                coalesce((select array_agg(quest_id) from ft_session_quests where session_id = s.id), '{}') as completed
           from ft_sessions s where id = $1`,
        [id],
      );
      if (!r) return null;
      return {
        nickname: r.nickname,
        schoolCode: r.school_code,
        schoolName: r.school_name,
        startedAt: Number(r.started_ms),
        score: Number(r.score),
        clearTimeMs: r.clear_time_ms === null ? null : Number(r.clear_time_ms),
        completed: r.completed,
      };
    },

    async createSession(id, { nickname, schoolCode, schoolName }) {
      await q('insert into ft_schools (code, name) values ($1, $2) on conflict (code) do nothing', [schoolCode, schoolName]);
      await q(
        'insert into ft_sessions (id, nickname, school_code, school_name) values ($1, $2, $3, $4) on conflict (id) do nothing',
        [id, nickname, schoolCode, schoolName],
      );
    },

    async knownSchoolName(code) {
      return (await one('select name from ft_schools where code = $1', [code]))?.name ?? null;
    },

    async rememberSchools(list) {
      if (!list.length) return;
      await q(
        'insert into ft_schools (code, name) select * from unnest($1::text[], $2::text[]) on conflict (code) do nothing',
        [list.map((s) => s.code), list.map((s) => s.name)],
      );
    },

    async completeQuest(id, questId, points, isFinal) {
      const r = await one('select * from ft_complete_quest($1, $2, $3, $4)', [id, questId, points, isFinal]);
      return { added: r.added, clearTimeMs: r.clear_time_ms === null ? null : Number(r.clear_time_ms) };
    },

    async speedRank(id) {
      const r = await one(
        `select count(*)::int + 1 as rank from ft_sessions
          where clear_time_ms < (select clear_time_ms from ft_sessions where id = $1)`,
        [id],
      );
      return r.rank;
    },

    async topSchools(limit) {
      const rows = await q(
        'select code, name, score::int as score from ft_schools where score > 0 order by score desc, updated_at asc limit $1',
        [limit],
      );
      return rows.map((r) => ({ code: r.code, name: r.name, score: r.score }));
    },

    async topSpeedrun(limit) {
      const rows = await q(
        `select nickname, school_name, clear_time_ms from ft_sessions
          where clear_time_ms is not null order by clear_time_ms, started_at limit $1`,
        [limit],
      );
      return rows.map((r) => ({ nickname: r.nickname, schoolName: r.school_name, timeMs: Number(r.clear_time_ms) }));
    },

    async schoolStanding(code) {
      const r = await one(
        `select s.score::int as score,
                (select count(*)::int + 1 from ft_schools o where o.score > s.score) as rank
           from ft_schools s where s.code = $1`,
        [code],
      );
      if (!r || r.score <= 0) return { rank: null, score: 0 };
      return { rank: r.rank, score: r.score };
    },

    async cacheGet(key) {
      return (await one('select value from ft_cache where key = $1 and expires_at > now()', [key]))?.value ?? null;
    },

    async cacheSet(key, value, ttlSec) {
      await q(
        `insert into ft_cache (key, value, expires_at) values ($1, $2::jsonb, now() + make_interval(secs => $3))
         on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at`,
        [key, JSON.stringify(value), ttlSec],
      );
    },

    close,
  };
}

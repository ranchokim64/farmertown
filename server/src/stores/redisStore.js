// Redis 저장소 (로컬 개발 · Docker 배포용). 개발 시 REDIS_URL 이 없으면 ioredis-mock.
import { ALL_QUESTS } from '../config.js';

const K = {
  sess: (id) => `sess:${id}`,
  done: (id) => `sess:${id}:done`,
  schoolNames: 'school:names',
  lbSchools: 'lb:schools',
  lbSpeed: 'lb:speed',
};

export async function createRedisStore(url, { sessionTtlSec = 60 * 60 * 24 * 30 } = {}) {
  let redis;
  if (url) {
    const { default: Redis } = await import('ioredis');
    redis = new Redis(url, { maxRetriesPerRequest: 2 });
    redis.on('error', (err) => console.error('[redis]', err.message));
  } else {
    const { default: RedisMock } = await import('ioredis-mock');
    console.warn('[store] DATABASE_URL/REDIS_URL 이 없어 인메모리 Mock 을 사용합니다 (개발 전용, 재시작 시 초기화).');
    redis = new RedisMock();
  }
  return redisStore(redis, { sessionTtlSec, kind: url ? 'redis' : 'memory' });
}

export function redisStore(redis, { sessionTtlSec = 60 * 60 * 24 * 30, kind = 'redis' } = {}) {
  return {
    kind,

    async rateHit(key, limit, windowMs) {
      const k = `rl:${key}:${Math.floor(Date.now() / windowMs)}`;
      const [[, count]] = await redis.multi().incr(k).pexpire(k, windowMs).exec();
      return { allowed: count <= limit, retryAfterMs: windowMs - (Date.now() % windowMs) };
    },

    async cooldown(key, ms) {
      const k = `cd:${key}`;
      if (await redis.set(k, '1', 'PX', ms, 'NX')) return { allowed: true, retryAfterMs: 0 };
      return { allowed: false, retryAfterMs: Math.max(await redis.pttl(k), 0) };
    },

    async getSession(id) {
      const s = await redis.hgetall(K.sess(id));
      if (!s?.nickname) return null;
      const done = await redis.smembers(K.done(id));
      return {
        nickname: s.nickname,
        schoolCode: s.schoolCode,
        schoolName: s.schoolName,
        startedAt: Number(s.startedAt),
        score: Number(s.score || 0),
        clearTimeMs: s.clearTimeMs ? Number(s.clearTimeMs) : null,
        completed: ALL_QUESTS.filter((q) => done.includes(q)),
      };
    },

    async createSession(id, { nickname, schoolCode, schoolName }) {
      await redis.hsetnx(K.schoolNames, schoolCode, schoolName);
      await redis
        .multi()
        .hset(K.sess(id), { nickname, schoolCode, schoolName, startedAt: Date.now(), score: 0 })
        .expire(K.sess(id), sessionTtlSec)
        .exec();
    },

    knownSchoolName: (code) => redis.hget(K.schoolNames, code),

    async rememberSchools(list) {
      for (const s of list) await redis.hsetnx(K.schoolNames, s.code, s.name);
    },

    // 원자적으로 완료 기록 → 점수 합산. 이미 완료된 퀘스트면 added=false
    async completeQuest(id, questId, points, isFinal) {
      if (!(await redis.sadd(K.done(id), questId))) return { added: false, clearTimeMs: null };
      const s = await redis.hmget(K.sess(id), 'schoolCode', 'startedAt');
      const tx = redis
        .multi()
        .hincrby(K.sess(id), 'score', points)
        .zincrby(K.lbSchools, points, s[0])
        .expire(K.done(id), sessionTtlSec);
      let clearTimeMs = null;
      if (isFinal) {
        clearTimeMs = Date.now() - Number(s[1]);
        tx.hset(K.sess(id), 'clearTimeMs', clearTimeMs).persist(K.sess(id)).persist(K.done(id));
        tx.zadd(K.lbSpeed, clearTimeMs, id);
      }
      await tx.exec();
      return { added: true, clearTimeMs };
    },

    async speedRank(id) {
      const r = await redis.zrank(K.lbSpeed, id);
      return r === null ? null : r + 1;
    },

    async topSchools(limit) {
      const raw = await redis.zrevrange(K.lbSchools, 0, limit - 1, 'WITHSCORES');
      const codes = raw.filter((_, i) => i % 2 === 0);
      const names = codes.length ? await redis.hmget(K.schoolNames, ...codes) : [];
      return codes.map((code, i) => ({ code, name: names[i] ?? code, score: Number(raw[i * 2 + 1]) }));
    },

    async topSpeedrun(limit) {
      const raw = await redis.zrange(K.lbSpeed, 0, limit - 1, 'WITHSCORES');
      const out = [];
      for (let i = 0; i < raw.length; i += 2) {
        const [nickname, schoolName] = await redis.hmget(K.sess(raw[i]), 'nickname', 'schoolName');
        out.push({ nickname, schoolName, timeMs: Number(raw[i + 1]) });
      }
      return out;
    },

    async schoolStanding(code) {
      const [rank, score] = await Promise.all([redis.zrevrank(K.lbSchools, code), redis.zscore(K.lbSchools, code)]);
      return { rank: rank === null ? null : rank + 1, score: Number(score ?? 0) };
    },

    async cacheGet(key) {
      const v = await redis.get(`cache:${key}`);
      return v ? JSON.parse(v) : null;
    },
    cacheSet: (key, value, ttlSec) => redis.set(`cache:${key}`, JSON.stringify(value), 'EX', ttlSec),

    close: () => redis.quit(),
  };
}

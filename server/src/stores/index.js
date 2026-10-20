// 저장소 선택: DATABASE_URL(Supabase/Postgres) > REDIS_URL > 인메모리 Mock(개발용)
export async function createStore({ databaseUrl, redisUrl, sessionTtlSec } = {}) {
  if (databaseUrl) {
    const { createPostgresStore } = await import('./postgresStore.js');
    return createPostgresStore(databaseUrl);
  }
  const { createRedisStore } = await import('./redisStore.js');
  return createRedisStore(redisUrl, { sessionTtlSec });
}

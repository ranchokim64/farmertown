import Redis from 'ioredis';

export async function createRedis(url) {
  if (url) {
    const redis = new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: true });
    redis.on('error', (err) => console.error('[redis]', err.message));
    return redis;
  }
  const { default: RedisMock } = await import('ioredis-mock');
  console.warn('[redis] REDIS_URL 이 설정되지 않아 인메모리 Mock 을 사용합니다 (개발 전용, 재시작 시 데이터 초기화).');
  return new RedisMock();
}

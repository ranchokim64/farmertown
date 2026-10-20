// Redis 기반 Rate Limit 유틸
// - fixedWindow: N초 창 안에서 최대 호출 수 제한 (INCR + PEXPIRE)
// - cooldown: 동일 키에 대해 일정 시간 동안 1회만 허용 (SET NX PX)

export async function fixedWindow(redis, key, limit, windowMs) {
  const bucket = Math.floor(Date.now() / windowMs);
  const k = `rl:${key}:${bucket}`;
  const [[, count]] = await redis.multi().incr(k).pexpire(k, windowMs).exec();
  return { allowed: count <= limit, count, retryAfterMs: windowMs - (Date.now() % windowMs) };
}

export async function cooldown(redis, key, ms) {
  const k = `cd:${key}`;
  const ok = await redis.set(k, '1', 'PX', ms, 'NX');
  if (ok) return { allowed: true, retryAfterMs: 0 };
  const ttl = await redis.pttl(k);
  return { allowed: false, retryAfterMs: Math.max(ttl, 0) };
}

export function tooMany(res, retryAfterMs, message = '조금만 천천히! 잠시 후 다시 시도해 주세요.') {
  res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
  return res.status(429).json({ error: 'RATE_LIMITED', message, retryAfterMs });
}

// Express 미들웨어: IP 단위 전역 제한
export function ipLimiter(redis, { limit, windowMs = 60_000, scope = 'ip' }) {
  return async (req, res, next) => {
    try {
      const r = await fixedWindow(redis, `${scope}:${req.ip}`, limit, windowMs);
      if (!r.allowed) return tooMany(res, r.retryAfterMs);
      next();
    } catch (err) {
      next(err);
    }
  };
}

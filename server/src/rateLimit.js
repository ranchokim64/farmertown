// Rate Limit 유틸 (실제 카운팅은 저장소가 담당: Redis INCR / Postgres ft_rate_hit)

export function tooMany(res, retryAfterMs, message = '조금만 천천히! 잠시 후 다시 시도해 주세요.') {
  res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
  return res.status(429).json({ error: 'RATE_LIMITED', message, retryAfterMs });
}

// Express 미들웨어: IP 단위 전역 제한
export function ipLimiter(store, { limit, windowMs = 60_000, scope = 'ip' }) {
  return async (req, res, next) => {
    try {
      const r = await store.rateHit(`${scope}:${req.ip}`, limit, windowMs);
      if (!r.allowed) return tooMany(res, r.retryAfterMs);
      next();
    } catch (err) {
      next(err);
    }
  };
}

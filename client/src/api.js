// 서버 API 클라이언트. 서버가 꺼져 있어도 게임은 오프라인으로 계속 진행됩니다.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, timeout = 5000 } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
}

export const api = {
  searchSchools: (q) => request(`/schools?q=${encodeURIComponent(q)}`),
  createSession: (sessionId, nickname, school) => request('/session', { method: 'POST', body: { sessionId, nickname, school } }),
  getSession: (id) => request(`/session/${id}`),
  complete: (id, questId) => request(`/session/${id}/complete`, { method: 'POST', body: { questId } }),
  leaderboard: (schoolCode) => request(`/leaderboard?limit=5${schoolCode ? `&school=${encodeURIComponent(schoolCode)}` : ''}`),
};

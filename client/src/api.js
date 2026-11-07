// Supabase API 클라이언트: 브라우저가 Supabase 의 SQL 함수(ft_api_*)를 직접 호출합니다.
// 주소와 공개 키는 빌드할 때 환경 변수로 넣습니다 (client/.env.example 참고).
// 설정이 없거나 연결이 안 돼도 게임은 오프라인으로 계속 진행됩니다.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || '';

export const apiConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function rpc(fn, args, timeout = 6000) {
  if (!apiConfigured) throw new Error('Supabase 설정이 없어 오프라인으로 진행합니다.');
  const headers = { 'content-type': 'application/json', apikey: SUPABASE_KEY };
  // 예전 anon 키(JWT)는 Authorization 헤더도 필요, 새 publishable 키는 apikey 만으로 충분
  if (SUPABASE_KEY.startsWith('eyJ')) headers.authorization = `Bearer ${SUPABASE_KEY}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(timeout),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status >= 500 ? res.status : 503, json); // 설정/권한 문제는 재시도 가능한 오류로
  // SQL 함수는 오류를 {"status": 4xx, "error", "message"} 형태로 돌려줌
  if (json && typeof json.status === 'number' && json.status >= 400) throw new ApiError(json.status, json);
  return json;
}

export const api = {
  searchSchools: (q) => rpc('ft_api_search_schools', { p_q: q }),
  createSession: (sessionId, nickname, school) =>
    rpc('ft_api_create_session', {
      p_session: sessionId,
      p_nickname: nickname,
      p_school_code: school?.code ?? '',
      p_school_name: school?.name ?? '',
    }),
  getSession: (id) => rpc('ft_api_get_session', { p_session: id }),
  complete: (id, questId) => rpc('ft_api_complete', { p_session: id, p_quest: questId }),
  leaderboard: (schoolCode) => rpc('ft_api_leaderboard', { p_limit: 5, p_school: schoolCode || null }),
};

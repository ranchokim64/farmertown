// 모든 설정은 환경변수로 덮어쓸 수 있습니다.
const int = (v, d) => (v === undefined || v === '' ? d : Number.parseInt(v, 10));

export const config = {
  port: int(process.env.PORT, 3001),
  // 비어 있으면 개발용 인메모리 Redis(ioredis-mock)를 사용합니다.
  redisUrl: process.env.REDIS_URL || '',
  // 나이스(NEIS) 교육정보 개방 포털 API 키. 없으면 샘플 모드(최대 5건) → 실패 시 예시 학교 목록.
  neisApiKey: process.env.NEIS_API_KEY || '',
  // 리버스 프록시(nginx 등) 뒤에서 실행할 때 X-Forwarded-For 를 신뢰할 홉 수
  trustProxy: int(process.env.TRUST_PROXY, 0),
  // 클라이언트 빌드 결과물(정적 파일) 경로. 존재하면 함께 서빙합니다.
  staticDir: process.env.STATIC_DIR || new URL('../../client/dist', import.meta.url).pathname,

  sessionTtlSec: 60 * 60 * 24 * 30,

  points: { quest: 10, final: 50 },

  rateLimit: {
    // 학교는 보통 하나의 공인 IP(NAT)를 공유하므로 IP 제한은 넉넉하게,
    // 실제 점수 조작 방어는 세션 단위 쿨타임이 담당합니다.
    ipPerMinute: int(process.env.RL_IP_PER_MIN, 1200),
    sessionCreatePerIpPerMinute: int(process.env.RL_SESSION_CREATE_PER_MIN, 120),
    sessionPerMinute: int(process.env.RL_SESSION_PER_MIN, 60),
    // 같은 세션의 퀘스트 완료 API 호출 사이 최소 간격
    questCooldownMs: int(process.env.QUEST_COOLDOWN_MS, 3000),
    // n번째 퀘스트는 세션 시작 후 최소 n * minMsPerQuest 이후에만 인정 (매크로 방지)
    minMsPerQuest: int(process.env.MIN_MS_PER_QUEST, 8000),
  },
};

export const QUEST_IDS = ['soil', 'snail', 'scarecrow', 'tteok', 'smartfarm'];
export const FINAL_QUEST_ID = 'final';

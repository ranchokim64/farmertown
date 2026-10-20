// 학교 검색 (자동완성)
// 1) NEIS 교육정보 개방 포털 학교기본정보 API 를 프록시하고 결과를 Redis 에 하루 캐시합니다.
// 2) API 호출이 실패하면 예시 학교 목록에서 검색합니다. (클라이언트는 '직접 입력'도 허용)

const NEIS_URL = 'https://open.neis.go.kr/hub/schoolInfo';

export const SAMPLE_SCHOOLS = [
  { code: 'demo:garaetteok', name: '가래떡초등학교', region: '예시' },
  { code: 'demo:hwanggeum', name: '황금들판초등학교', region: '예시' },
  { code: 'demo:haetsal', name: '햇살초등학교', region: '예시' },
  { code: 'demo:baramgae', name: '바람개비초등학교', region: '예시' },
  { code: 'demo:ureong', name: '우렁이초등학교', region: '예시' },
  { code: 'demo:heoosu', name: '허수아비초등학교', region: '예시' },
  { code: 'demo:dangsan', name: '당산나무초등학교', region: '예시' },
  { code: 'demo:smartfarm', name: '스마트팜초등학교', region: '예시' },
];

export function customSchoolCode(name) {
  return `custom:${name.replace(/\s+/g, '')}`;
}

export function validSchoolCode(code) {
  return typeof code === 'string' && /^(?:[A-Z]\d{2}:\d{7}|demo:[a-z]+|custom:[가-힣a-zA-Z0-9]{2,20})$/.test(code);
}

async function searchNeis(q, apiKey) {
  const params = new URLSearchParams({
    Type: 'json',
    pIndex: '1',
    pSize: '15',
    SCHUL_NM: q,
    SCHUL_KND_SC_NM: '초등학교',
  });
  if (apiKey) params.set('KEY', apiKey);
  const res = await fetch(`${NEIS_URL}?${params}`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`NEIS ${res.status}`);
  const json = await res.json();
  if (!json.schoolInfo) return []; // INFO-200: 해당하는 데이터가 없음
  const rows = json.schoolInfo.find((part) => part.row)?.row ?? [];
  return rows.map((r) => ({
    code: `${r.ATPT_OFCDC_SC_CODE}:${r.SD_SCHUL_CODE}`,
    name: r.SCHUL_NM,
    region: [r.LCTN_SC_NM, (r.ORG_RDNMA || '').split(' ')[1]].filter(Boolean).join(' '),
  }));
}

export async function searchSchools(store, q, apiKey) {
  const query = String(q ?? '').trim().slice(0, 20);
  if (query.length < 1) return { source: 'none', schools: [] };

  const cacheKey = `schoolq:${query}`;
  const cached = await store.cacheGet(cacheKey);
  if (cached) return cached;

  let result;
  try {
    result = { source: 'neis', schools: await searchNeis(query, apiKey) };
    await store.rememberSchools(result.schools); // 세션 생성 시 학교 이름 위조 방지용
    await store.cacheSet(cacheKey, result, 60 * 60 * 24);
  } catch (err) {
    console.warn('[schools] NEIS 검색 실패, 예시 목록 사용:', err.message);
    result = { source: 'sample', schools: SAMPLE_SCHOOLS.filter((s) => s.name.includes(query)) };
  }
  return result;
}

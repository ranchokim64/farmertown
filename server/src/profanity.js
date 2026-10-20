// 닉네임/학교명 비속어 필터 (서버단 최종 판정)
// - 공백·숫자·특수문자를 제거한 뒤 검사하여 "시 1 발", "씨.발" 같은 우회를 막습니다.
// - 목록은 초등학생 대상 서비스 기준의 최소 목록이며, 운영하면서 BANNED_WORDS 에 추가하세요.

const BANNED_WORDS = [
  // 한국어 욕설 및 변형
  '시발', '씨발', '씨빨', '시빨', '씨바', '쌍년', '쌍놈', '썅', '씹', '좆', '존나', '졸라', '조낸',
  '병신', '븅신', '빙신', '지랄', '염병', '엠창', '니미', '느금', '니애미', '니에미', '애미', '애비',
  '개새', '개색', '개세끼', '개쉐', '새끼', '쌔끼', '미친년', '미친놈', '미친새', '꺼져', '닥쳐', '뒤져', '뒈져',
  '등신', '또라이', '찐따', '장애인', '틀딱', '한남', '김치녀', '보지', '자지', '섹스', '야동', '변태',
  '창녀', '걸레', '호구', '멍청이', '바보새',
  // 초성 욕설
  'ㅅㅂ', 'ㅆㅂ', 'ㅂㅅ', 'ㅈㄹ', 'ㅈㄴ', 'ㄲㅈ', 'ㄷㅊ', 'ㅁㅊ', 'ㅅㄲ', 'ㄱㅅㄲ', 'ㅄ',
  // 영어
  'fuck', 'shit', 'bitch', 'sex', 'porn', 'dick', 'pussy', 'asshole', 'bastard', 'nigger', 'nigga', 'fck', 'sibal', 'ssibal',
  // 사칭 방지
  '관리자', '운영자', 'admin', '선생님공지',
];

export function normalize(text) {
  return String(text)
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s\d_\-.,!?@#$%^&*()+=~`'"/\\|<>[\]{}:;]/g, '');
}

export function containsProfanity(text) {
  const n = normalize(text);
  return BANNED_WORDS.some((w) => n.includes(w));
}

// 닉네임 규칙: 2~10자, 한글/영문/숫자/공백만 허용
const NICK_RE = /^[가-힣a-zA-Z0-9 ]{2,10}$/;

export function validateNickname(raw) {
  const nickname = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!NICK_RE.test(nickname)) {
    return { ok: false, reason: '닉네임은 한글·영문·숫자 2~10자로 지어 주세요.' };
  }
  if (containsProfanity(nickname)) {
    return { ok: false, reason: '바르고 고운 말로 닉네임을 지어 주세요!' };
  }
  return { ok: true, nickname };
}

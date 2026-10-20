# 배포 가이드: Vercel + Supabase

```
브라우저 ──▶ Vercel ─┬─ 게임 화면 (client/dist, 정적 파일)
                     └─ /api/*  (api/index.js 서버리스 함수) ──▶ Supabase Postgres
```

- 게임 화면과 API 가 **같은 주소**에서 나가므로 CORS 설정이 필요 없습니다.
- 브라우저는 Supabase 에 직접 접속하지 않습니다. DB 주소는 Vercel 서버에만 있고, 모든 테이블은 RLS 로 잠겨 있어 anon 키로는 아무것도 할 수 없습니다.
- 서버리스 함수(서울 `icn1`)와 Supabase(서울 리전)를 가깝게 두어 응답이 빠릅니다.

---

## 1. Supabase (약 5분)

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
   - **Region**: `Northeast Asia (Seoul)`
   - **Database Password**: 새로 만들고 따로 적어 두세요 (2-3단계에서 필요)
2. 왼쪽 메뉴 **SQL Editor** → **New query** → 저장소의
   [`supabase/migrations/20261020000000_farmertown.sql`](../supabase/migrations/20261020000000_farmertown.sql)
   내용을 통째로 붙여 넣고 **Run** → `Success. No rows returned` 가 나오면 성공
   - **Table Editor** 에 `ft_sessions`, `ft_schools` 등 5개 테이블이 보이면 됩니다.
   - 여러 번 실행해도 안전합니다.
3. 화면 위쪽 **Connect** 버튼 → **Connection String** 탭 → **Transaction pooler** 의 주소를 복사
   - 모양: `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`
   - `[YOUR-PASSWORD]` 를 1단계의 비밀번호로 바꿉니다. 비밀번호에 `@ # / ? %` 같은 특수문자가 있으면
     URL 인코딩이 필요하니, 처음 만들 때 영문+숫자로만 만드는 것이 가장 편합니다.
   - **포트가 6543 인 Transaction pooler** 를 써야 합니다 (서버리스 함수에 맞는 방식).

## 2. Vercel (약 5분)

1. [vercel.com/new](https://vercel.com/new) → GitHub 의 `ranchokim64/farmertown` 저장소 **Import**
2. 설정 화면
   - **Framework Preset**: `Other` (빌드 설정은 저장소의 `vercel.json` 이 알아서 지정)
   - **Root Directory**: `./` 그대로
   - **Environment Variables**:

     | 이름 | 값 | 필수 |
     | --- | --- | --- |
     | `DATABASE_URL` | 1-3단계에서 만든 Transaction pooler 주소 | ✅ |
     | `NEIS_API_KEY` | 나이스 교육정보 개방 포털 인증키 (아래 4번) | 선택 |

3. **Deploy** → 1~2분 뒤 `https://farmertown-xxxx.vercel.app` 주소가 생깁니다.
4. 확인: 브라우저에서 `https://<주소>/api/health` 를 열어
   `{"ok":true,"store":"postgres"}` 가 나오면 DB 까지 연결 완료입니다.
   - `"store":"memory"` 가 나오면 `DATABASE_URL` 이 빠진 것입니다 → Vercel **Settings → Environment Variables** 에 넣고 **Deployments → Redeploy**.

이후에는 GitHub 의 기본 브랜치에 푸시할 때마다 자동으로 다시 배포됩니다.

## 3. 테스트 체크리스트

- [ ] `/api/health` → `"store":"postgres"`
- [ ] 학교 검색 → 닉네임 → 축제 참가하기 → 인트로 → 플레이
- [ ] 퀘스트 1개 완료 후 Supabase **Table Editor → ft_schools** 에 학교 점수 10점
- [ ] 새로고침(F5) → "이어서 축제 즐기기" 로 진행도 유지
- [ ] 다른 기기(태블릿/폰)로 같은 학교 입장 → 광장 전광판에 합산 점수
- [ ] 6개 퀘스트 클리어 → 명예의 전당에 기록

## 4. (선택) 실제 학교 검색: NEIS 인증키

키가 없으면 나이스 샘플 모드라 **검색 결과가 최대 5건**이고, 실패하면 예시 학교 목록이 나옵니다.

1. [open.neis.go.kr](https://open.neis.go.kr) 회원가입 → **인증키 신청** (활용 용도 간단히 작성, 보통 바로 발급)
2. Vercel **Settings → Environment Variables** 에 `NEIS_API_KEY` 추가 → **Redeploy**

## 5. 수업 전에 알아둘 점

- **Supabase 무료 프로젝트는 1주일 동안 사용이 없으면 일시 정지**됩니다. 수업 며칠 전에 대시보드에서
  프로젝트가 `Active` 인지 확인하고, 정지돼 있으면 **Restore** 를 누르세요 (복구에 몇 분 걸림).
- Vercel 함수는 처음 호출될 때 1~2초 정도 늦을 수 있습니다(콜드 스타트). 수업 직전에 한 번 접속해 두면 좋습니다.
- 학교 대항전 점수를 초기화하려면 SQL Editor 에서:
  ```sql
  truncate ft_sessions, ft_session_quests, ft_schools cascade;
  ```
- Vercel Hobby(무료) 플랜은 개인·비상업 용도 기준입니다. 학교/기관 공식 서비스로 운영한다면 Pro 플랜 약관을 확인하세요.
- 문제가 생기면 Vercel **Deployments → (배포) → Functions/Logs** 와 Supabase **Logs** 에서 오류를 볼 수 있습니다.

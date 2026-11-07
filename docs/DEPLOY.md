# 배포 가이드: GitHub Pages + Supabase

```
브라우저 ──▶ GitHub Pages   https://ranchokim64.github.io/farmertown/   (게임 화면, 정적 파일)
   └──────▶ Supabase        https://<프로젝트>.supabase.co/rest/v1/rpc/ft_api_*   (점수·랭킹·학교 검색)
```

- GitHub Pages 는 서버를 돌릴 수 없어서, 서버가 하던 일(닉네임 검사, 점수 합산, 연타 방지, 학교 검색)을
  **Supabase 안의 SQL 함수**가 합니다.
- 게임 화면에는 Supabase **공개 키(publishable key)** 만 들어갑니다. 원래 공개해도 되는 키이고,
  모든 테이블이 잠겨 있어 이 키로는 정해 둔 API 함수 5개만 부를 수 있습니다.
- 나이스(NEIS) 인증키는 DB 안에만 저장되어 브라우저에 드러나지 않습니다.

---

## 1. Supabase (약 5분)

> Vercel 때 만든 프로젝트가 있으면 그대로 쓰면 됩니다. 1-1 은 건너뛰세요.

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
   - **Region**: `Northeast Asia (Seoul)`
   - **Database Password**: 아무거나 (이번 방식에서는 쓰지 않음)
2. 왼쪽 메뉴 **SQL Editor** → **New query** → 저장소의
   [`supabase/migrations/20261106000000_farmertown_github_pages.sql`](../supabase/migrations/20261106000000_farmertown_github_pages.sql)
   내용을 통째로 붙여 넣고 **Run**
   - `Success. No rows returned` 가 나오면 성공입니다. 예전 SQL 을 이미 실행했어도 그대로 실행하면 됩니다 (데이터 유지).
   - **Table Editor** 에 `ft_sessions`, `ft_schools`, `ft_config` 등 6개 테이블이 보이면 됩니다.
3. 왼쪽 아래 **Project Settings** → **API Keys** (또는 화면 위 **Connect** 버튼)에서 두 값을 복사해 둡니다.
   - **Project URL**: `https://abcdefghijkl.supabase.co`
   - **Publishable key**: `sb_publishable_...` (없으면 Legacy API Keys 탭의 `anon` `public` 키 `eyJ...` 도 됩니다)
   - ⚠️ `secret` / `service_role` 키는 **절대** 쓰지 마세요. 게임 화면에 들어가면 누구나 볼 수 있습니다.

## 2. GitHub (약 3분)

저장소 [github.com/ranchokim64/farmertown](https://github.com/ranchokim64/farmertown) 에서:

1. **Settings → Pages** → Build and deployment 의 **Source** 를 `GitHub Actions` 로 선택
2. **Settings → Secrets and variables → Actions** → **Variables** 탭 → **New repository variable** 로 두 개 추가

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | 1-3 의 Project URL |
   | `SUPABASE_KEY` | 1-3 의 Publishable key |

   (Secrets 탭이 아니라 **Variables** 탭입니다. 공개 키라서 Variables 로 충분합니다.)
3. **Actions** 탭 → 왼쪽 **Deploy to GitHub Pages** → 오른쪽 **Run workflow** → **Run workflow**
   - 이 설정 전에 자동으로 돌았던 실행은 실패로 남아 있을 수 있습니다. 새로 실행하면 됩니다.
   - 2~3분 뒤 초록 체크가 뜨면 **https://ranchokim64.github.io/farmertown/** 로 접속하세요.

이후에는 **기본 브랜치에 푸시할 때마다 자동으로 다시 배포**됩니다
(지금 기본 브랜치는 `claude/modest-keller-uaiycr`. 나중에 `main` 을 기본 브랜치로 바꾸면 그쪽을 따라갑니다).

## 3. 테스트 체크리스트

- [ ] 게임 화면이 뜨고, 학교 검색 → 닉네임 → 축제 참가하기 → 인트로 → 플레이
- [ ] 오른쪽 위 닉네임 옆 점이 **초록색** (회색이면 Supabase 연결 안 됨 → 아래 문제 해결)
- [ ] 퀘스트 1개 완료 → 토스트 "🏫 ○○초등학교 +10점!" → Supabase **Table Editor → ft_schools** 에 10점
- [ ] 새로고침(F5) → "이어서 축제 즐기기" 로 진행도 유지
- [ ] 다른 기기(태블릿/폰)로 같은 학교 입장 → 광장 전광판에 합산 점수
- [ ] 6개 퀘스트 클리어 → 명예의 전당에 기록

## 4. (선택) 실제 학교 검색: 나이스 인증키

키가 없으면 나이스 샘플 모드라 **학교 검색 결과가 최대 5건**입니다.

1. [open.neis.go.kr](https://open.neis.go.kr) 회원가입 → **인증키 신청** (활용 용도 간단히 작성)
2. Supabase **SQL Editor** 에서 실행 (`발급받은키` 자리에 키 붙여 넣기):
   ```sql
   update ft_config set value = '발급받은키' where key = 'neis_api_key';
   delete from ft_cache;  -- 예전 검색 결과 지우기
   ```
3. 학교 검색에서 "예시" 학교만 나온다면 DB 의 `http` 확장이 꺼져 있는 것입니다.
   **Database → Extensions** 에서 `http` 를 검색해 켜 주세요 (SQL 실행 때 자동으로 켜지도록 해 두었지만 막힌 경우).

## 5. 문제 해결

| 증상 | 확인할 것 |
| --- | --- |
| 닉네임 옆 점이 회색, 점수판이 "점수판 연결 중…" | GitHub Variables 이름(`SUPABASE_URL`, `SUPABASE_KEY`)과 값 확인 → Actions 에서 다시 실행. 브라우저 개발자 도구(F12) Console 의 오류 확인 |
| Actions 의 deploy 단계 실패 | Settings → Pages 의 Source 가 `GitHub Actions` 인지 |
| 화면이 하얗게 나옴 | 주소 끝에 `/farmertown/` 이 붙어 있는지 (저장소 이름을 바꿨다면 새 이름으로) |
| 401 / `Invalid API key` | publishable(anon) 키를 넣었는지, 키를 잘못 복사하지 않았는지 |
| `Could not find the function` | SQL 을 실행했는지, 실행 후 1분 정도 기다렸는지 |

## 6. 수업 전에 알아둘 점

- **Supabase 무료 프로젝트는 1주일 동안 사용이 없으면 일시 정지**됩니다. 수업 며칠 전에 대시보드에서 `Active` 인지 확인하고,
  정지돼 있으면 **Restore** 를 누르세요 (몇 분 걸림). 정지돼 있어도 게임은 오프라인으로 진행되지만 점수는 쌓이지 않습니다.
- 학교 대항전 점수 초기화 (SQL Editor):
  ```sql
  truncate ft_sessions, ft_session_quests cascade;
  update ft_schools set score = 0;
  ```
- 점수·제한 값 바꾸기: `ft_config` 테이블 (예: 퀘스트 점수 `points_quest`, 매크로 방지 최소 시간 `min_ms_per_quest`).
- Vercel 에 프로젝트를 만들어 두었다면 이제 쓰지 않으니 Vercel 대시보드에서 삭제해도 됩니다.

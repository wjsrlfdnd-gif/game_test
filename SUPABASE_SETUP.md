# Supabase 백엔드 연동 가이드 (무료 Free 요금제 지원)

게임 본체(`random_character_defense.html`)와 운영자 콘솔(`admin.html`)은 **Supabase Auth + PostgreSQL + Realtime + RPC**로 바로 연동되도록 구성되어 있습니다.  
아래 4단계만 설정하면 무료 플랜에서도 클라우드 세이브 동기화, 실시간 라이브 공지/배율, 선착순/1인1회 DB 검증 쿠폰, 운영자 로그인을 사용할 수 있습니다.

---

## 1단계: Supabase 프로젝트 생성 및 DB 스키마 한 번에 실행
1. [Supabase Dashboard](https://supabase.com/dashboard) 접속 → **New Project** (Region: `Northeast Asia (Seoul)` 권장)
2. 좌측 메뉴 **SQL Editor → New query** 클릭
3. 저장소의 [`supabase.sql`](./supabase.sql) 파일 전체 내용을 붙여넣고 **Run** 실행
   - `admins`, `saves`, `live_config`, `coupons`, `coupon_claims` 테이블과 RLS 보안 정책, `redeem_coupon()` 원자적 쿠폰 함수, Realtime 구독이 한 번에 생성됩니다.

## 2단계: Authentication 설정
1. 좌측 메뉴 **Authentication → Sign In / Providers** (또는 User Signups)
   - **Allow anonymous sign-ins** 활성화 (필수 — 별도 가입 없이 접속 즉시 클라우드 세이브/쿠폰 사용)
   - **Email** 활성화 (권장: 테스트/게스트 즉시 연동을 위해 `Confirm email` 옵션은 끄셔도 됩니다)
   - *(선택)* **Google** 활성화 (구글 원클릭 연동 시 사용)
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://wjsrlfdnd-gif.github.io/game_test/`
   - **Redirect URLs**: `https://wjsrlfdnd-gif.github.io/game_test/**`, `http://localhost:**` 추가

## 3단계: 운영자 계정 등록
1. **Authentication → Users → Add user → Create new user** 로 운영자 이메일/비밀번호 생성 후 **UID** 복사
2. **SQL Editor**에서 아래 1줄 실행(복사한 UID 입력):
   ```sql
   insert into public.admins (user_id, email)
   values ('복사한-운영자-UID', 'admin@example.com')
   on conflict (user_id) do nothing;
   ```
   > **팁**: `admin.html`에서 이메일로 먼저 로그인하면 화면에 `admins` 등록용 SQL이 자동으로 생성되어 **1클릭 복사**할 수 있습니다.

## 4단계: `supabase-config.js`에 URL · Anon Key 반영
1. Supabase 대시보드 **Project Settings (⚙️) → API** (또는 Data API / API Keys)에서:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public key** (`eyJ...`) 복사
2. [`supabase-config.js`](./supabase-config.js)의 `DEFAULT_CONFIG`에 입력하고 `main` 브랜치에 커밋·푸시합니다.
   - 또는 `admin.html` → **[마스터 데이터·보안 설정]** 탭에서 URL/Key를 붙여넣고 **`📄 supabase-config.js 저장`** 버튼으로 파일을 내려받아 교체할 수도 있습니다.

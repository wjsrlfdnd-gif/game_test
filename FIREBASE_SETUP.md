# Firebase 백엔드 연동 설정 가이드 (무료 Spark 요금제 지원)

게임 본체(`random_character_defense.html`)와 운영자 콘솔(`admin.html`)은 **Firebase Authentication + Cloud Firestore**와 바로 연동되도록 구성되어 있습니다.  
아래 5단계만 설정하면 **무료(Spark) 요금제**에서도 클라우드 세이브 동기화, 실시간 라이브 공지/배율, 선착순/1인1회 서버 검증 쿠폰, 운영자 로그인을 모두 사용할 수 있습니다.

---

## 1단계: Firebase 프로젝트 및 웹 앱 생성
1. [Firebase Console](https://console.firebase.google.com/) 접속 → **프로젝트 추가**
2. 프로젝트 개요에서 **웹(`</>`) 아이콘** 클릭 → 앱 닉네임(`RCD Web`) 입력 후 등록
3. 화면에 표시된 `firebaseConfig` 객체(`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`)를 복사합니다.

## 2단계: Authentication (로그인 수단) 활성화
1. 좌측 메뉴 **빌드 → Authentication → 시작하기**
2. **Sign-in method** 탭에서 아래 3가지를 활성화합니다:
   - **익명 (Anonymous)** — 필수 (별도 가입 없이 접속 즉시 클라우드 세이브/쿠폰 사용 가능)
   - **이메일/비밀번호 (Email/Password)** — 필수 (운영자 콘솔 로그인 및 유저 계정 연동용)
   - **Google** — 선택 (유저 원클릭 계정 연동용)
3. **Authentication → Settings → 승인된 도메인(Authorized domains)** 에 아래 도메인이 포함되어 있는지 확인하세요:
   - `wjsrlfdnd-gif.github.io`
   - `localhost` (로컬 테스트 및 Android APK용)
4. **Authentication → Users → 사용자 추가**에서 운영자용 이메일/비밀번호 계정을 생성하고, 생성된 계정의 **사용자 UID**를 복사합니다.

## 3단계: Cloud Firestore 생성 및 보안 규칙 적용
1. 좌측 메뉴 **빌드 → Firestore Database → 데이터베이스 만들기** (프로덕션 모드 시작, 리전: `asia-northeast3` 서울 권장)
2. **규칙(Rules)** 탭으로 이동해 저장소의 [`firestore.rules`](./firestore.rules) 파일 내용을 그대로 붙여넣고 **게시**합니다.
3. **데이터(Data)** 탭에서 운영자 권한 문서를 1개 등록합니다:
   - **컬렉션 시작**: 컬렉션 ID = `admins`
   - **문서 ID**: 2단계에서 복사한 **운영자 사용자 UID**
   - **필드**: `role` (string) = `admin`
   - 이제 해당 계정으로 `admin.html`에 로그인할 수 있으며, 일반 유저는 운영자 권한에 접근할 수 없습니다.

## 4단계: `firebase-config.js`에 설정값 반영
저장소 루트의 [`firebase-config.js`](./firebase-config.js) 파일에 1단계에서 복사한 `firebaseConfig` 값을 입력하고 `main` 브랜치에 커밋·푸시합니다.

> **팁**: 파일을 수정하기 전에 바로 테스트하고 싶다면 `admin.html`의 **[마스터 데이터·보안 설정]** 탭에서 `firebaseConfig` JSON을 붙여넣어 현재 브라우저에서 즉시 테스트한 뒤 `firebase-config.js`를 다운로드할 수도 있습니다.

## 5단계: 확인
- **게임 (`random_character_defense.html`)**: `⚙️ 설정 → ☁️ 클라우드 계정 연동 (Firebase)`에서 연결 상태, 이메일/Google 연동, 즉시 동기화 확인
- **운영자 콘솔 (`admin.html`)**: Firebase 운영자 이메일/비밀번호로 로그인 후
  - **Firestore 이벤트 쿠폰** 생성 (선착순 `maxUses` 제한·실시간 사용 횟수 `usedCount` 조회)
  - **실시간 공지/배율(`liveConfig`)** 즉시 발행
  - **유저 클라우드 세이브 목록** 조회·편집·원격 저장

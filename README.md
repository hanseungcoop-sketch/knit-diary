# 뜨개 다이어리

아이패드에서 쓰는 뜨개 기록 웹앱이에요. 작품 기록, 단수 카운터, 사진 기록, PDF 내보내기(GoodNotes·Flexcil), 캘린더 일정 파일, 백업 기능이 있어요. 기록은 모두 아이패드 안(브라우저 저장소)에만 저장돼요.

## 1. 윈도우 PC 준비 (처음 한 번)

1. **Node.js** 설치: https://nodejs.org 에서 LTS 버전을 받아 설치해요.
2. **Git** 설치: https://git-scm.com 에서 받아 설치해요.
3. **VS Code** 설치(권장): https://code.visualstudio.com
4. 이 폴더를 원하는 곳에 압축 해제하고, 그 폴더에서 터미널(PowerShell)을 열어 아래를 실행해요.

```
npm install
```

## 2. PC에서 실행하고 아이패드로 미리 보기

```
npm run dev
```

- PC 브라우저에서 터미널에 나온 `http://localhost:5173` 주소를 열면 돼요.
- 아이패드에서 보려면 PC와 같은 와이파이에 연결하고, 터미널에 나온 `Network:` 주소(예: `http://192.168.0.10:5173`)를 사파리에서 열어요.
- 윈도우 방화벽 창이 뜨면 "개인 네트워크 허용"을 눌러주세요.
- 코드를 고치고 저장하면 화면이 바로 바뀌어요.
- 이 주소는 개발용이에요. 실제로 쓸 기록은 아래 3번의 GitHub Pages 주소로 설치한 앱에 쌓아주세요(주소가 다르면 저장 공간도 달라요).

## 3. GitHub Pages에 올리기 (실제 사용)

1. https://github.com 에서 새 저장소를 만들어요. 예: `knit-diary`, **Public**.
2. 이 폴더에서:

```
git init
git add .
git commit -m "첫 버전"
git branch -M main
git remote add origin https://github.com/내아이디/knit-diary.git
git push -u origin main
```

3. GitHub 저장소 → **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿔요.
4. **Actions** 탭에서 배포가 끝나면(초록 체크, 1~2분) `https://내아이디.github.io/knit-diary/` 주소가 생겨요.
5. 이후에는 코드를 고치고 `git add . && git commit -m "수정 내용" && git push`만 하면 자동으로 다시 배포돼요.

## 4. 아이패드에 설치

1. 아이패드 **사파리**에서 GitHub Pages 주소를 열어요.
2. **공유 버튼 → 홈 화면에 추가 → 추가**를 눌러요.
3. 이후로는 홈 화면 아이콘으로만 열어요. 사파리 탭과 홈 화면 앱은 저장 공간이 따로예요.
4. 새 버전을 올리면 앱 아래에 "새 버전이 있어요 · 새로고침"이 떠요.

## 5. 꼭 알아둘 것

- 홈 화면 아이콘을 지우면 기록도 함께 지워져요. **백업·설정** 탭에서 가끔 백업 파일을 만들어 파일 앱이나 iCloud Drive에 저장해두세요. 앱도 마지막 백업 후 7일이 지나면 알려줘요.
- 캘린더는 작품 상세의 "캘린더에 기간 추가"로 일정 파일(.ics)을 만들어 아이패드 캘린더에 추가하는 방식이에요. 웹앱은 캘린더에 직접 쓸 수 없어요.
- 아이패드에는 진동 기능이 없어서, 알림 단은 카운터 버튼 색이 바뀌고 안내 띠가 뜨는 방식이에요.

## 폴더 구조

```
src/
  lib/          데이터 모델, 저장소(IndexedDB), PDF 만들기, 백업, 공유, 캘린더 파일
  screens/      화면 (홈, 보관함, 캘린더, PDF, 백업·설정, 작품 입력·상세, 카운터, 사진)
  components/   공통 UI (아이콘, 탭 바 등)
.github/workflows/deploy.yml   GitHub Pages 자동 배포
```

## 명령어

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 (같은 와이파이의 아이패드에서도 접속 가능) |
| `npm run build` | 배포용 빌드 (`dist` 폴더) |
| `npm run preview` | 빌드 결과를 미리 보기 |

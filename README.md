# 보드 게임 시뮬레이터 (GitHub Pages 배포 안내)

이 저장소는 `GAME_RULES.md` 규칙을 따르는 Vite + React 앱입니다. GitHub Pages에서 동작하도록 `vite.config.js`에 `base: './'`을 설정했습니다.

## 파일 구조

- `index.html`: Vite 진입 HTML (`/src/main.jsx` 로드)
- `GAME_RULES.md`: 게임 규칙 문서
- `README.md`: 배포 및 사용 안내
- `src/`: React 컴포넌트와 로직
  - `src/App.jsx`, `src/main.jsx`, `src/game.js`, `src/styles.css`
  - 게임 화면 + 확률 계산 페이지(토글)

## 로컬에서 열기

- 코드 에디터에서 `index.html`을 더블 클릭하거나, 정적 서버로 서빙합니다.
- macOS: Finder에서 `index.html` 열기 또는 아래 명령 사용:

```bash
python3 -m http.server 8080
# 브라우저에서 http://localhost:8080/index.html
```

## GitHub Pages 배포

1. GitHub에 새 저장소를 만든 뒤, 현재 프로젝트를 푸시합니다.

```bash
git init
git add .
git commit -m "init: board game simulator"
git branch -M main
git remote add origin git@github.com:<YOUR_ID>/<REPO>.git
git push -u origin main
```

2. GitHub 웹에서 Settings → Pages로 이동합니다.
- Source: `GitHub Actions` 선택

3. 로컬에서 의존성 설치 및 빌드 아티팩트 커밋은 필요 없습니다. GitHub Actions로 빌드/배포를 구성하거나, 단순히 `main` 브랜치에 코드 푸시 후 Pages Action 템플릿을 사용하세요.

직접 배포하고 싶다면(수동):

```bash
npm i
npm run build
# dist 폴더를 Pages에 올리거나, gh-pages 브랜치로 배포
```

## 커스터마이즈

- 보상 모드: `src/game.js`의 `REWARD_MODES` 수정
- 스타일: `src/styles.css` 수정
- 기능 확장: `src/game.js`/`src/App.jsx` 확장

## 브라우저 호환성

- 최신 Chrome/Edge/Firefox/Safari 권장
- 네트워크 환경에서 `unpkg.com`에 접근 가능해야 합니다.

---

MIT License


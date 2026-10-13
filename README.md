# 🧸 장난감 상자

생활에서 소소하게 쓰는 놀이 도구 모음이에요. 서버·로그인 없이 GitHub Pages에 그대로 올리는 정적 사이트예요.

## 게임

| 게임 | 화면 | 하는 법 |
|---|---|---|
| 🎟️ [제비뽑기](games/lots/) | 🖥️ 큰 화면 | n장(2–30) 중 k장 당첨. 한 장씩 눌러 뒤집거나 남은 것 모두 뒤집기 |
| 🎡 [룰렛](games/wheel/) | 🖥️ 큰 화면 | 항목(최대 24칸)을 쉼표·줄바꿈으로 적고 돌리기. 자주 쓰는 목록은 저장(길게 누르거나 오른쪽 클릭으로 지우기) |
| 🪜 [사다리타기](games/ladder/) | 🖥️ 큰 화면 | 참가자 2–12명(기본 8)의 이름·결과를 적고 사다리 만들기 → 이름을 누르면 길을 따라 내려감, 모두 보기 |
| 💣 [폭탄 돌리기](games/bomb/) | 📱 폰 한 대 | 시간(짧게 10–30초 · 보통 20–60초 · 길게 40–90초)을 고르고 시작 → 폰을 옆 사람에게 넘기다 터질 때 들고 있던 사람이 걸림. 남은 시간은 어디에도 안 보이고 째깍 소리는 끝까지 같은 빠르기. 돌리는 중엔 화면 꺼짐 방지(되는 브라우저), 그만하기는 1초 꾹 |

## 구조

빌드·설치할 것 없는 HTML/CSS/JS예요. 게임마다 폴더(페이지) 하나라 서로 엮이지 않아요.

```
index.html          홈: 게임 카드
css/base.css        모든 페이지가 같이 쓰는 색(라이트/다크 자동)·단추·판
js/ui.js            화면 만들기(h, button, svg, stepper), 이 기기에 저장(store), 소리·진동, 알림
js/random.js        crypto.getRandomValues 난수 (randInt, cryptoShuffle)
games/<게임>/       index.html · <게임>.js(화면) · <게임>-core.js(계산, 화면 없음) · <게임>.css
tests/              node --test
```

- 뽑기는 모두 `crypto.getRandomValues`로 결과를 먼저 정하고, 화면은 그 결과대로 움직이기만 해요.
- 설정은 이 기기의 localStorage(`toybox:<게임>`)에만 남아요.
- 크기: `<html class="big">` 페이지는 노트북·프로젝터에서 글자와 판이 같이 커지고, `<body class="phone">` 페이지는 폰 기준이에요.

### 게임 추가하기

1. `games/<이름>/` 폴더에 `index.html`을 만들어요 (다른 게임 페이지를 복사해서 시작하면 머리 줄·공용 파일이 이미 들어 있어요).
2. 계산은 `<이름>-core.js`에 화면 없이 두고 `tests/<이름>.test.js`로 확인해요.
3. 홈 `index.html`의 `.game-cards`에 카드 `<a>`를 하나 넣어요.

## 배포

리포 Settings › Pages › Build and deployment에서 **Deploy from a branch**, `main` / `(root)`를 고르면 `https://kkonoo.github.io/toy_box/`로 열려요. 모든 링크가 상대 경로라 따로 설정할 것은 없어요.

## 확인 (테스트)

저장소 맨 위에서 `node --test` (설치할 것 없음). 화면 없는 계산(`*-core.js`, `js/random.js`)을 확인해요.

---

제비뽑기·룰렛·사다리타기는 [살림노트(everyday_notes)](https://github.com/kkonoo/everyday_notes)의 놀이에서 가져왔어요.

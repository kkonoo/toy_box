# 🧸 장난감 상자

생활에서 소소하게 쓰는 놀이 도구 모음이에요. 서버·로그인 없이 GitHub Pages에 그대로 올리는 정적 사이트예요.

https://kkonoo.github.io/toy_box/


## 게임

| 게임 | 화면 | 하는 법 |
|---|---|---|
| 🎟️ [제비뽑기](games/lots/) | 🖥️ 큰 화면 | n장(2–30) 중 k장 당첨. 한 장씩 눌러 뒤집거나 남은 것 모두 뒤집기 |
| 🎡 [룰렛](games/wheel/) | 🖥️ 큰 화면 | 항목(최대 24칸)을 쉼표·줄바꿈으로 적고 돌리기. 자주 쓰는 목록은 저장(길게 누르거나 오른쪽 클릭으로 지우기) |
| 🪜 [사다리타기](games/ladder/) | 🖥️ 큰 화면 | 참가자 2–12명(기본 8)의 이름·결과를 적고 사다리 만들기 → 이름을 누르면 길을 따라 내려감, 모두 보기 |
| 💣 [폭탄 돌리기](games/bomb/) | 📱 폰 한 대 | 시간(짧게 10–30초 · 보통 20–60초 · 길게 40–90초)을 고르고 시작 → 폰을 옆 사람에게 넘기다 터질 때 들고 있던 사람이 걸림. 남은 시간은 어디에도 안 보이고 째깍 소리는 끝까지 같은 빠르기. 돌리는 중엔 화면 꺼짐 방지(되는 브라우저), 그만하기는 1초 꾹 |
| 🎅 [시크릿 산타](games/santa/) | 📱 개인 화면은 폰 | 이름(3명 이상)을 적고 매칭 → 자기 자신은 안 뽑히고, 둘이 서로 뽑는 쌍은 나올 수 있음. 주최자 화면엔 결과가 안 나오고 사람마다 개인 링크(복사·공유)나 QR을 나눠 줌. 받은 사람은 링크를 열고 선물 상자를 눌러 자기 결과만 확인 |
| 🔮 [타로](games/tarot/) | 📱 폰 우선, 🖥️ 큰 화면도 | 스프레드(원 카드·쓰리 카드·상황·장애·조언·켈틱 크로스)와 질문(종류·한 줄, 안 넣어도 됨)을 고르고 섞기 → 뒷면으로 펼친 10장(켈틱 크로스는 15장)에서 직접 골라 한 장씩 뒤집기. 역방향 켜고 끄기. 카드 뜻은 키 없이도 보이고, 각자 Claude API 키를 넣으면 질문에 맞춰 이야기하듯 읽어 줌 |

## 앱으로 설치 (PWA)

폰의 크롬·엣지(PC도)로 홈을 열면 위에 ‘📲 장난감 상자 앱으로 설치하기’ 배너가 떠요. 아이폰은 같은 자리에 ‘공유 › 홈 화면에 추가’ 안내가 떠요(카톡 같은 앱 안 브라우저나 이미 홈 화면에서 연 경우엔 안 뜸). ✕로 닫으면 그 기기에선 다시 안 떠요. 설치하면 주소창 없이 열리고, 한 번 열어 둔 기기는 인터넷이 끊겨도 열려요(타로의 Claude 읽기는 인터넷이 필요해요).

## 구조

빌드·설치할 것 없는 HTML/CSS/JS예요. 게임마다 폴더(페이지) 하나라 서로 엮이지 않아요.

```
index.html          홈: 게임 카드 (+ 앱 설치 배너)
manifest.webmanifest, sw.js, js/pwa.js   앱 설치·오프라인 (온라인이면 늘 새 파일, 오프라인이면 저장해 둔 파일)
icons/              앱 아이콘 🧸 (tools/make-icons.py로 그림, Noto Color Emoji · OFL)
css/base.css        모든 페이지가 같이 쓰는 색(라이트/다크 자동)·단추·판
js/ui.js            화면 만들기(h, button, svg, stepper), 이 기기에 저장(store), 소리·진동, 알림
js/random.js        crypto.getRandomValues 난수 (randInt, cryptoShuffle)
games/<게임>/       index.html · <게임>.js(화면) · <게임>-core.js(계산, 화면 없음) · <게임>.css
vendor/qrcode.js    QR 만들기 (qrcode-generator 2.0.4, Kazuhiko Arase, MIT — 시크릿 산타)
tests/              node --test
```

- 뽑기는 모두 `crypto.getRandomValues`로 결과를 먼저 정하고, 화면은 그 결과대로 움직이기만 해요.
- 설정은 이 기기의 localStorage(`toybox:<게임>`)에만 남아요.
- 시크릿 산타 개인 링크는 `games/santa/me.html#…` 꼴이고, `#` 뒤에 그 사람 결과(추첨 번호·이름·받는 사람)를 섞어서 담아요. 암호화는 아니라 마음먹고 풀면 볼 수 있지만 링크만 봐서는 이름이 안 읽혀요. `#` 뒤는 서버로 가지 않아요. 서버가 없어서 다시 섞어도 예전 링크는 예전 결과를 그대로 보여 주므로, 화면의 추첨 번호(예: #K3F9)로 최신 링크인지 확인해요.
- 타로의 🔮 Claude 읽기는 브라우저가 `api.anthropic.com`을 바로 불러요(서버 없음). API 키는 각자 Claude Console에서 만들어 🔑에 넣고, '이 기기에 저장'(localStorage)이나 '이번만 쓰기'(sessionStorage, 탭을 닫으면 지워짐)를 골라요. 모델(`claude-opus-5-5`)과 읽는 법(프롬프트)은 `games/tarot/tarot.js`의 `claudeStream`, `games/tarot/tarot-core.js`의 `READER_SYSTEM`에 있어요.
- 크기: `<html class="big">` 페이지는 노트북·프로젝터에서 글자와 판이 같이 커지고, `<body class="phone">` 페이지는 폰 기준이에요.

### 게임 추가하기

1. `games/<이름>/` 폴더에 `index.html`을 만들어요 (다른 게임 페이지를 복사해서 시작하면 머리 줄·공용 파일·앱 설치 줄이 이미 들어 있어요).
2. 계산은 `<이름>-core.js`에 화면 없이 두고 `tests/<이름>.test.js`로 확인해요.
3. 홈 `index.html`의 `.game-cards`에 카드 `<a>`를 하나 넣어요.
4. 오프라인에서도 열리게 `sw.js`의 `SHELL`에 새 파일들을 적어요.

## 확인 (테스트)

저장소 맨 위에서 `node --test` (설치할 것 없음). 화면 없는 계산(`*-core.js`, `js/random.js`)을 확인해요.

---

제비뽑기·룰렛·사다리타기는 [살림노트(everyday_notes)](https://github.com/kkonoo/everyday_notes)의 놀이에서, 타로는 [saju_lab](https://github.com/kkonoo/saju_lab)에서 가져왔어요.

'use strict';
// 타로 계산 (화면 없음): tarot.js 가 쓰고, tests/tarot.test.js 가 Node에서 확인
// saju_lab(kkonoo/saju_lab) js/reading.js 의 타로 뽑기·질문 칸·🤖 읽기에서 가져옴. 읽는 말투는 공부용 대신 타로 리더처럼

const SPREADS = {
  one: { name: '원 카드', pos: ['오늘의 카드'] },
  three: { name: '쓰리 카드', pos: ['과거', '현재', '미래'] },
  sao: { name: '상황·장애·조언', pos: ['상황', '장애', '조언'] },
  celtic: { name: '켈틱 크로스', pos: ['현재', '가로막는 것', '바탕', '지나간 일', '목표', '가까운 미래', '태도', '환경', '바람·두려움', '결과'] },
};
// 펼쳐 놓는 장 수: 자리보다 넉넉히 (켈틱 크로스는 10자리라 15장)
const layCount = spread => (SPREADS[spread].pos.length > 3 ? 15 : 10);
// 78장을 섞어 lay장만 뒷면으로 펼침 → 그중에서 자리 수만큼 직접 고름. 역방향을 켜면 카드마다 반반 확률로 뒤집힘
function dealDeck(lay, reversedOn) {
  return cryptoShuffle(TAROT_CARDS.map(c => c.id)).slice(0, lay).map(id => ({ id, reversed: reversedOn && randInt(2) === 1 }));
}

// ---------- 카드 앞면 (그림 대신 번호·이모지) ----------
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
const MAJOR_EMOJI = ['🎒', '🎩', '📜', '🌸', '🏰', '⛪', '💞', '🏇', '🦁', '🏮', '🌀', '⚖️', '🙃', '🥀', '🏺', '😈', '⚡', '⭐', '🌙', '☀️', '📯', '🌍'];
const SUIT_EMOJI = { w: '🪄', c: '🏆', s: '🗡️', p: '🪙' }; // saju_lab과 같음
const COURT_MARK = ['P', 'N', 'Q', 'K']; // 페이지 · 나이트 · 퀸 · 킹
const CARD_BY_ID = new Map(TAROT_CARDS.map(c => [c.id, c]));
function cardFace(id) {
  const c = CARD_BY_ID.get(id), n = +id.slice(1), major = id[0] === 'm';
  return {
    ...c, suit: id[0],
    mark: major ? ROMAN[n] : n === 1 ? 'A' : n <= 10 ? String(n) : COURT_MARK[n - 11],
    emoji: major ? MAJOR_EMOJI[n] : SUIT_EMOJI[id[0]],
  };
}

// ---------- 질문 칸: 종류 + 질문 한 줄 (다 안 넣어도 됨) ----------
const ASK_KINDS = { // [이모지, 이름, 자주 하는 질문]
  love: ['💕', '연애', ['그 사람은 나를 어떻게 생각할까?', '이 관계는 앞으로 어떻게 될까?', '다시 연락이 올까?', '새 인연은 언제 올까?']],
  work: ['💼', '일·직장', ['이직해도 될까?', '이 일은 잘 풀릴까?', '면접 결과는 어떨까?', '지금 일에서 무엇에 힘을 쓸까?']],
  study: ['📚', '시험·공부', ['이번 시험에 붙을까?', '어디에 힘을 쓰면 좋을까?', '공부 방법을 바꿔야 할까?']],
  money: ['💰', '돈', ['이번 투자는 괜찮을까?', '돈이 들어올 때는 언제일까?', '어디서 새는 돈을 막아야 할까?']],
  people: ['🤝', '사람', ['이 사람과 잘 지내려면?', '이 갈등은 풀릴까?', '이 사람을 믿어도 될까?']],
  health: ['🌿', '건강', ['요즘 몸에서 조심할 곳은?', '생활에서 바꿀 것은?']],
  choice: ['🔀', '선택', ['A와 B 중 무엇이 나을까?', '지금 시작해도 될까?', '기다리는 게 나을까?']],
  flow: ['🌤', '흐름', ['이번 달 흐름은 어떨까?', '지금 나에게 필요한 것은?', '올해 조심할 것은?']],
};
// 질문 한 줄: "💕 연애 — 다시 연락이 올까?"
function askText({ kind, question }) {
  const k = ASK_KINDS[kind];
  return [k && `${k[0]} ${k[1]}`, (question || '').trim()].filter(Boolean).join(' — ');
}

// ---------- 읽기 ----------
// 키 없이도 보여 주는 풀이: 자리마다 한 문단 (앞에 앉은 리더가 말하듯, 뜻은 카드 데이터 그대로)
function cardReading(pos, { id, reversed }) {
  const c = CARD_BY_ID.get(id);
  return `${pos} 자리에 ‘${c.name}’ 카드가 ${reversed ? '거꾸로 ' : ''}나왔어요. ${reversed ? c.rev : c.up}`;
}
// Claude에게 줄 읽는 법 (saju_lab의 '공부하는 사람이 따라 읽을 수 있게' 규칙은 빼고 리더 말투로)
const READER_SYSTEM = `당신은 따뜻하고 노련한 타로 리더예요. 마주 앉은 사람이 직접 고른 카드를 그 사람의 질문에 맞춰 읽어 주세요.
- 처음 한두 문장으로 카드 전체의 분위기를 짚어요.
- 카드마다 한 문단: 자리의 뜻과 카드의 뜻(정방향·역방향)을 엮어 이 질문에서 무엇을 말하는지 구체적으로 이야기해요. 문단은 "과거 · 펜타클 4 (역방향) —"처럼 시작해요.
- 끝에 카드들이 함께 들려주는 이야기를 한 문단으로 묶고, 지금 해 볼 만한 일 한두 가지를 권해요.
- 카드 뜻은 함께 주는 풀이를 바탕으로 하되 외운 설명처럼 늘어놓지 말고 이야기하듯 써요. 읽는 방법이나 용어 설명은 하지 않아요.
- 쉬운 해요체로, 정해진 미래처럼 단정하거나 겁주지 말아요.
- 마크다운 기호(#, *, -, 표)는 쓰지 말고 문단 사이는 빈 줄 하나로 나눠요.
- 질문이 없으면 '요즘의 나'에 대한 이야기로 읽어요.`;
// 고른 카드와 질문 → Claude에게 보낼 글
function readingPrompt(spread, cards, ask, date) {
  const sp = SPREADS[spread], q = askText(ask);
  return [`뽑은 날 ${date} · 스프레드: ${sp.name}`, ...cards.map((x, k) => {
    const c = CARD_BY_ID.get(x.id);
    return `\n${k + 1}. ${sp.pos[k]} — ${c.name} (${c.en}) ${x.reversed ? '역방향' : '정방향'}\n키워드: ${c.kw}\n뜻: ${x.reversed ? c.rev : c.up}`;
  }), `\n[질문]\n${q || '없음'}`].join('\n');
}

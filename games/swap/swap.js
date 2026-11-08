'use strict';
// 선물 뺏기 (큰 화면 하나): 이름을 적고 순서를 뽑으면, 차례마다 새 선물을 열거나 열린 선물을 뺏음 (규칙은 swap-core.js)
// 누가 무엇을 들고 있는지, 몇 번 뺏겼는지는 앱이 셈. 진행은 이 기기에 기억해서 새로 고쳐도 이어지고, 되돌리기도 됨
const prefs = store('swap', { names: '', limit: 3, game: null, past: [] }); // past = 되돌리기용 지난 game들
const PAST_MAX = 60;
const LIMITS = [[2, '2번까지'], [3, '3번까지'], [0, '제한 없음']];

function render() {
  const o = prefs.get();
  $('app').replaceChildren(o.game ? playPanel(o.game, o.past) : setupPanel(o));
}

// ---------- 1. 준비 ----------
function setupPanel(o) {
  const panel = h('section', 'panel swap-panel'), ta = h('textarea'), info = h('p', 'swap-info'), go = button('🎲 순서 뽑고 시작', start, 'btn primary big'), seg = h('div', 'seg');
  ta.rows = 8;
  ta.placeholder = '한 줄에 한 명씩 (쉼표로 나눠도 돼요)';
  ta.value = o.names;
  const check = () => {
    const n = parseNames(ta.value).length;
    info.textContent = n < 2 ? `${n}명 · 2명 이상이어야 해요` : `${n}명 · 선물 ${n}개`;
    go.disabled = n < 2;
  };
  ta.addEventListener('input', () => { prefs.set({ names: ta.value }); check(); });
  for (const [v, label] of LIMITS) seg.append(button(label, () => { prefs.set({ limit: v }); render(); }, o.limit === v ? 'on' : ''));
  check();
  panel.append(h('h2', '', '참가자 이름'), ta, info, h('h2', '', '한 선물을 뺏을 수 있는 횟수'), seg, go,
    h('p', 'hint', '각자 포장한 선물을 하나씩 가운데 쌓아 둬요. 섞은 순서대로 ‘새 선물 열기’나 ‘열린 선물 뺏기’ 중 하나를 해요. 뺏긴 사람은 바로 자기 차례가 되고(방금 뺏긴 걸 바로 되뺏기는 안 돼요), 새 선물을 열면 다음 사람으로 넘어가요. 모두 하나씩 들면 끝!'));
  return panel;
}
function start() {
  const o = prefs.get();
  prefs.set({ game: newSwap(parseNames(o.names), o.limit), past: [] });
  render();
}

// ---------- 2. 하기 ----------
function playPanel(g, past) {
  const panel = h('section', 'panel swap-panel'), order = h('ol', 'swap-order'), turn = h('div', 'swap-turn'), gifts = h('div', 'swap-gifts');
  g.order.forEach((name, i) => {
    const li = h('li', name === g.actor ? 'now' : holderOf(g, name) >= 0 ? 'has' : i >= g.next ? 'wait' : '');
    li.append(h('small', '', i + 1), h('b', '', name));
    order.append(li);
  });
  if (g.actor != null) {
    const form = h('form', 'swap-open'), label = h('input', 'text-input');
    label.maxLength = 30;
    label.placeholder = `무엇이 나왔나요? (안 써도 돼요)`;
    form.append(label, h('button', 'btn primary', `📦 새 선물 열기 · 남은 ${pileLeft(g)}개`));
    form.addEventListener('submit', e => { e.preventDefault(); act(openGift(g, label.value.trim() || `선물 ${g.gifts.length + 1}`)); });
    turn.append(h('p', 'swap-big', `🎁 ${g.actor}님 차례`),
      h('p', 'swap-sub', g.noBack >= 0 ? `방금 뺏겼어요! 새 선물을 열거나, ‘${g.gifts[g.noBack].label}’ 말고 다른 선물을 뺏어요.` : '새 선물을 열거나, 아래 열린 선물 중 하나를 뺏어요.'),
      form);
  } else {
    turn.classList.add('end');
    turn.append(h('p', 'swap-big', '🏁 끝! 모두 선물을 받았어요'), h('p', 'swap-sub', '가장 많이 뺏긴 선물이 오늘의 인기 선물이에요.'));
  }
  const most = Math.max(0, ...g.gifts.map(x => x.steals));
  g.gifts.forEach((x, i) => {
    const card = h('div', `swap-gift${x.steals && x.steals === most ? ' hot' : ''}`), why = stealBlock(g, i);
    card.append(h('b', 'swap-label', x.label), h('span', 'swap-holder', `🙋 ${x.holder}`),
      h('span', 'swap-steals', g.limit ? `뺏김 ${x.steals}/${g.limit}${x.steals >= g.limit ? ' 🔒' : ''}` : `뺏김 ${x.steals}번`));
    if (g.actor != null) {
      const b = button(why || `${g.actor}님이 뺏기`, () => act(stealGift(g, i)), 'btn small');
      b.disabled = !!why;
      card.append(b);
    }
    gifts.append(card);
  });
  if (!g.gifts.length) gifts.append(h('p', 'hint', '아직 연 선물이 없어요.'));
  const btns = h('div', 'play-btns'), undo = button('↩ 되돌리기', () => { prefs.set({ game: past[past.length - 1], past: past.slice(0, -1) }); render(); }, 'btn');
  undo.disabled = !past.length;
  btns.append(undo, button('처음부터', () => { if (confirm('이 판을 끝내고 이름 적는 화면으로 갈까요?')) { prefs.set({ game: null, past: [] }); render(); } }, 'btn'));
  panel.append(order, turn, h('h2', '', `열린 선물 ${g.gifts.length}개`), gifts, btns);
  return panel;
}
function act(next) {
  const o = prefs.get();
  prefs.set({ game: next, past: [...o.past, o.game].slice(-PAST_MAX) });
  if (next.actor == null) fanfare();
  render();
}

render();

'use strict';
// 타로 뽑기: 스프레드·질문을 고르고 → 78장을 섞어 뒷면으로 펼친 카드에서 직접 고르고 → 한 장씩 뒤집어 읽기
// 섞기·방향은 tarot-core.js(dealDeck, crypto 난수). 각자 Claude API 키를 넣으면 🔮 Claude가 질문에 맞춰 이야기하듯 읽어 줌
// saju_lab(kkonoo/saju_lab) js/reading.js · js/boards.js 의 타로에서 가져옴 (판 저장·동기화·공부용 설명은 뺌)
const prefs = store('tarot', { spread: 'three', reversed: true, kind: '', question: '', key: '' });
const KEY_SESSION = 'toybox:tarot-key'; // '이번만 쓰기' 키: 이 탭을 닫으면 지워짐
// 지금 판: { spread, ask, deck: [{ id, reversed }], picks: [deck 번호], open: Set(뒤집은 자리), date, dealt, ai, aiText, aiBusy, aiErr }
let st = null;

function render() {
  const app = $('app');
  paintKeyButton();
  if (!st) app.replaceChildren(setupPanel());
  else if (st.picks.length < SPREADS[st.spread].pos.length) app.replaceChildren(pickPanel());
  else app.replaceChildren(boardPanel(), ...readingPanels());
}
const askLine = () => (askText(st.ask) ? h('p', 'ask-line', `❓ ${askText(st.ask)}`) : '');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ---------- 1. 스프레드·질문 ----------
function setupPanel() {
  const o = prefs.get(), panel = h('section', 'panel tarot-setup'), seg = h('div', 'seg spread-seg'), kinds = h('div', 'chips'), faq = h('div', 'chips faq');
  for (const [k, sp] of Object.entries(SPREADS)) {
    const b = button('', () => { prefs.set({ spread: k }); render(); }, k === o.spread ? 'on' : '');
    b.append(h('b', '', sp.name), h('small', '', `${sp.pos.length}장`));
    seg.append(b);
  }
  for (const [k, [e, name]] of Object.entries(ASK_KINDS)) kinds.append(button(`${e} ${name}`, () => { prefs.set({ kind: o.kind === k ? '' : k }); render(); }, k === o.kind ? 'chip on' : 'chip'));
  const q = h('input', 'text-input');
  q.value = o.question;
  q.placeholder = '마음속 질문을 적어요 (안 적어도 돼요)';
  q.addEventListener('input', () => prefs.set({ question: q.value }));
  for (const t of ASK_KINDS[o.kind]?.[2] || []) faq.append(button(t, () => { q.value = t; prefs.set({ question: t }); }, 'chip'));
  const rev = h('label', 'check'), box = h('input');
  box.type = 'checkbox';
  box.checked = o.reversed;
  box.addEventListener('change', () => prefs.set({ reversed: box.checked }));
  rev.append(box, h('span', '', '역방향 카드도 쓰기'));
  panel.append(h('h2', '', '스프레드'), seg, h('h2', '', '질문'), kinds, q, faq, rev, button('🃏 카드 섞기', shuffle, 'btn primary big'),
    h('p', 'hint', `78장을 섞어 ${layCount(o.spread)}장을 뒷면으로 펼쳐요. 그중에서 마음이 가는 카드를 골라요.`));
  return panel;
}
function shuffle() {
  const o = prefs.get();
  st = { spread: o.spread, ask: { kind: o.kind, question: o.question.trim() }, deck: dealDeck(layCount(o.spread), o.reversed), picks: [], open: new Set(), date: today(), dealt: false, ai: '', aiText: '', aiBusy: false, aiErr: '' };
  render();
}

// ---------- 2. 펼친 카드에서 고르기 (부채꼴: 가운데가 높고 양끝이 기울어짐) ----------
function pickPanel() {
  const pos = SPREADS[st.spread].pos, n = st.picks.length, m = st.deck.length, panel = h('section', 'panel tarot-pick');
  const deck = h('div', `deck${st.dealt ? '' : ' deal'}`), slots = h('div', 'slots'), head = h('div', 'panel-head'), btns = h('div', 'play-btns');
  st.deck.forEach((c, k) => {
    const at = st.picks.indexOf(k), b = button(at < 0 ? '' : String(at + 1), () => pickCard(k), `dk${at < 0 ? '' : ' taken'}`), a = k - (m - 1) / 2;
    for (const [v, x] of [['--i', k], ['--x', k / (m - 1)], ['--rot', `${a * 36 / m}deg`], ['--dy', `${a * a * 80 / (m * m)}px`]]) b.style.setProperty(v, x);
    b.setAttribute('aria-label', at < 0 ? `카드 ${k + 1}` : `${at + 1}번째로 고른 카드`);
    deck.append(b);
  });
  deck.style.setProperty('--n', m);
  st.dealt = true; // 섞을 때만 펼치는 움직임
  pos.forEach((p, k) => { const s = h('div', `slot${k < n ? ' filled' : k === n ? ' next' : ''}`); s.append(h('b', '', k + 1), ` ${p}`); slots.append(s); });
  head.append(h('h2', '', `🃏 카드 고르기 ${n} / ${pos.length}`));
  if (n) btns.append(button('↩ 하나 되돌리기', () => { st.picks.pop(); render(); }, 'btn'));
  btns.append(button('🔀 다시 섞기', shuffle, 'btn'), button('질문 바꾸기', () => { st = null; render(); }, 'btn'));
  panel.append(head, askLine(), h('p', 'hint', `${m}장 중에서 마음이 가는 카드를 ${pos.length}장 골라요. 고른 순서대로 자리에 놓여요. 다음 자리: ${n + 1}. ${pos[n]}`), slots, deck, btns);
  return panel;
}
function pickCard(k) {
  if (st.picks.includes(k)) return;
  st.picks.push(k);
  render();
}

// ---------- 3. 스프레드 판: 한 장씩 눌러 뒤집기 ----------
function boardPanel() {
  const sp = SPREADS[st.spread], panel = h('section', 'panel tarot-board'), grid = h('div', `spread spread-${st.spread}`), head = h('div', 'panel-head');
  sp.pos.forEach((p, k) => grid.append(cardSlot(k, p)));
  const allOpen = st.open.size === sp.pos.length;
  head.append(h('h2', '', sp.name));
  if (!allOpen) head.append(button('모두 뒤집기', flipAll, 'btn small'));
  panel.append(head, askLine(), grid, h('p', 'hint', allOpen ? '카드를 누르면 뜻을 자세히 볼 수 있어요.' : '카드를 한 장씩 눌러 뒤집어요.'));
  return panel;
}
function cardSlot(k, pos) {
  const x = st.deck[st.picks[k]], wrap = h('div', 'tc-slot'), b = button('', () => (st.open.has(k) ? showCard(k) : flip(k)), `tcard${x.reversed ? ' rev' : ''}`);
  const inner = h('span', 'tc-inner');
  inner.append(h('span', 'tc-back'), h('span', 'tc-front'));
  b.append(inner);
  b.dataset.k = k;
  wrap.style.gridArea = `c${k + 1}`;
  wrap.append(b, h('span', 'tc-pos'));
  paintCard(wrap, k, pos);
  return wrap;
}
// 앞면 글자는 뒤집을 때 넣음 (뒤집기 전엔 어떤 카드인지 화면 어디에도 없게)
function paintCard(wrap, k, pos) {
  const x = st.deck[st.picks[k]], open = st.open.has(k), b = wrap.querySelector('.tcard');
  wrap.querySelector('.tc-pos').textContent = `${k + 1}. ${pos}${open && x.reversed ? ' · 역방향' : ''}`;
  b.setAttribute('aria-label', open ? `${pos}: ${cardFace(x.id).name}${x.reversed ? ' 역방향' : ''}` : `${k + 1}. ${pos} — 눌러서 뒤집기`);
  if (!open) return;
  const f = cardFace(x.id), front = b.querySelector('.tc-front');
  front.replaceChildren(h('span', 'tc-mark', f.mark), h('span', 'tc-emoji', f.emoji), h('span', 'tc-name', f.name));
  b.classList.add('open', `suit-${f.suit}`);
}
function flip(k) {
  if (st.open.has(k)) return;
  st.open.add(k);
  paintCard(document.querySelector(`.tcard[data-k="${k}"]`).parentElement, k, SPREADS[st.spread].pos[k]);
  if (st.open.size === SPREADS[st.spread].pos.length) { const me = st; setTimeout(() => { if (st === me) render(); }, reduceMotion() ? 0 : 700); } // 다 뒤집으면 읽기
}
async function flipAll() {
  const me = st, pos = SPREADS[st.spread].pos;
  for (let k = 0; k < pos.length; k++) {
    if (st !== me) return;
    if (!st.open.has(k)) { flip(k); await wait(reduceMotion() ? 0 : 220); }
  }
}
// 뒤집은 카드를 누르면: 정·역방향 뜻
function showCard(k) {
  const x = st.deck[st.picks[k]], c = cardFace(x.id), pos = SPREADS[st.spread].pos[k];
  $('cardTitle').textContent = `${pos} · ${c.name}${x.reversed ? ' (역방향)' : ''}`;
  const now = h('p', 'card-now'), other = h('p', 'hint');
  now.append(h('b', '', x.reversed ? '⬇️ 역방향 ' : '⬆️ 정방향 '), x.reversed ? c.rev : c.up);
  other.textContent = `${x.reversed ? '정방향' : '역방향'}: ${x.reversed ? c.up : c.rev}`;
  $('cardBody').replaceChildren(h('p', 'hint', `${c.en} · 🔑 ${c.kw}`), h('p', '', c.short), now, other);
  $('cardDlg').showModal();
}
$('cardClose').addEventListener('click', () => $('cardDlg').close());

// ---------- 4. 읽기: 카드 뜻(키 없이도) + 🔮 Claude 읽기(키가 있으면) ----------
function readingPanels() {
  const sp = SPREADS[st.spread], cards = st.picks.map(i => st.deck[i]), basic = h('section', 'panel tarot-read'), ai = h('section', 'panel tarot-ai'), btns = h('div', 'play-btns tarot-again');
  if (st.open.size < sp.pos.length) return [];
  basic.append(h('h2', '', '🔮 카드가 들려주는 이야기'), ...cards.map((x, k) => h('p', '', cardReading(sp.pos[k], x))));
  if (st.aiBusy || st.ai) {
    const head = h('div', 'panel-head'), text = h('div', 'ai-text', st.aiBusy ? st.aiText : st.ai);
    text.id = 'aiText';
    head.append(h('h2', '', st.aiBusy ? '🔮 Claude가 카드를 읽는 중…' : '🔮 Claude의 읽기'));
    if (!st.aiBusy) head.append(button('다시 읽기', askClaude, 'btn small'));
    ai.append(head, text);
  } else {
    ai.append(button('🔮 Claude에게 질문에 맞춰 읽어 달라기', askClaude, 'btn primary'),
      h('p', 'hint', apiKey() ? '고른 카드와 질문만 Claude에게 보내요.' : '각자 가진 Claude API 키를 넣으면 질문에 맞춰 이야기하듯 읽어 줘요.'));
  }
  if (st.aiErr) ai.append(h('p', 'ai-err', `⚠️ ${st.aiErr}`));
  btns.append(button('🔀 다시 섞기', shuffle, 'btn'), button('질문 바꾸기', () => { st = null; render(); }, 'btn'));
  return [basic, ai, btns];
}

// ---------- Claude API 키 (각자): 이 기기에 저장 또는 이번만(이 탭) ----------
function sessionKey() { try { return sessionStorage.getItem(KEY_SESSION) || ''; } catch { return ''; } }
const apiKey = () => prefs.get().key || sessionKey();
function paintKeyButton() { $('keyBtn').textContent = apiKey() ? '🔑 키 넣음' : '🔑 Claude 키'; }
let afterKey = null; // 키를 넣으면 이어서 할 일 (읽기 단추에서 열었을 때)
function openKeyDialog(then) {
  afterKey = typeof then === 'function' ? then : null;
  $('keyInput').value = apiKey();
  $('keyForm').keySave.value = prefs.get().key || !sessionKey() ? 'device' : 'session';
  $('keyDlg').showModal();
}
function setKey(key, where) {
  prefs.set({ key: where === 'device' ? key : '' });
  try { if (where === 'session' && key) sessionStorage.setItem(KEY_SESSION, key); else sessionStorage.removeItem(KEY_SESSION); } catch { /* 못 씀 */ }
}
$('keyBtn').addEventListener('click', () => openKeyDialog());
$('keyForm').addEventListener('submit', e => {
  e.preventDefault();
  const key = $('keyInput').value.trim(), then = afterKey;
  setKey(key, $('keyForm').keySave.value);
  $('keyDlg').close();
  render();
  toast(key ? '키를 넣었어요' : '키를 지웠어요');
  if (key && then) then();
});
$('keyClear').addEventListener('click', () => { setKey('', 'device'); $('keyInput').value = ''; $('keyDlg').close(); render(); toast('키를 지웠어요'); });
$('keyCancel').addEventListener('click', () => $('keyDlg').close());
$('keyDlg').addEventListener('close', () => { afterKey = null; });

// ---------- 🔮 Claude로 읽기 (saju_lab askClaude·claudeStream) ----------
// 브라우저가 api.anthropic.com을 바로 부름(서버 없음). 판이 바뀌면(다시 섞기·질문 바꾸기) 받는 중이던 읽기는 버림
async function askClaude() {
  const key = apiKey();
  if (!key) { openKeyDialog(askClaude); return; }
  const me = st, live = () => st === me;
  Object.assign(st, { aiBusy: true, aiText: '', ai: '', aiErr: '' });
  render();
  const r = await claudeStream({
    key, sys: READER_SYSTEM, live,
    content: readingPrompt(me.spread, me.picks.map(i => me.deck[i]), me.ask, me.date),
    onText: t => { me.aiText = t; const el = $('aiText'); if (el) el.textContent = t; },
  });
  if (r.aborted || !live()) return;
  if (r.err) st.aiErr = r.err; else st.ai = r.text;
  st.aiBusy = false;
  render();
}
// Claude 한 번 부르기 (스트리밍): 글자가 올 때마다 onText(지금까지 글), live()가 거짓이 되면 그만둠
async function claudeStream({ key, sys, content, onText, live = () => true }) {
  const ctrl = new AbortController();
  let text = '', stop = null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: {
        'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01', // 안전 필터에 걸리면 서버가 다른 모델로 이어서 읽음
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-5-5', max_tokens: 16000, stream: true, output_config: { effort: 'medium' }, fallbacks: 'default',
        system: sys, messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      const msg = (await res.json().catch(() => null))?.error?.message || '';
      throw new Error({ 401: 'API 키가 맞지 않아요. 🔑에서 다시 넣어 주세요.', 429: '요청이 많아요. 조금 뒤에 다시 해 보세요.', 529: 'Claude가 붐벼요. 조금 뒤에 다시 해 보세요.' }[res.status] || `읽지 못했어요 (${res.status}) ${msg}`);
    }
    // 스트리밍(SSE): 글자가 오는 대로 붙임
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (!live()) { ctrl.abort(); return { aborted: true }; }
      if (done) break;
      buf += value.replaceAll('\r', '');
      let n;
      while ((n = buf.indexOf('\n\n')) >= 0) {
        const data = buf.slice(0, n).split('\n').find(l => l.startsWith('data:'));
        buf = buf.slice(n + 2);
        const e = data ? JSON.parse(data.slice(5)) : {};
        if (e.type === 'content_block_delta' && e.delta.type === 'text_delta') text += e.delta.text;
        else if (e.type === 'message_delta') stop = e.delta.stop_reason;
        else if (e.type === 'error') throw new Error(`읽다가 끊겼어요: ${e.error.message}`);
      }
      onText(text);
    }
    if (stop === 'refusal') throw new Error('Claude가 이 카드는 읽지 않았어요. 질문을 바꿔 다시 해 보세요.');
    return { text: text + (stop === 'max_tokens' ? '\n\n(길이 제한에 걸려 여기서 끊겼어요)' : '') };
  } catch (e) {
    return { err: e instanceof TypeError ? '인터넷에 연결돼 있는지 확인해 주세요.' : e.message };
  }
}

render();

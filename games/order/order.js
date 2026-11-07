'use strict';
// 주문 모으기: 메뉴를 적거나 📷 메뉴판 사진에서 Claude가 메뉴 이름을 뽑아 목록을 만들고,
// 폰 한 대를 테이블마다 넘기며 메뉴마다 ＋ 추가 / − 취소 → 개수는 바를 정(正)과 숫자로. 커피처럼 나누는 메뉴는 🧊 아이스 · 🔥 따뜻한을 따로(하나만 되는 메뉴는 그 하나만)
// 메뉴·개수는 이 기기에만 남아서(toybox:order) 새로 고치거나 잠깐 다른 앱에 다녀와도 그대로
const prefs = store('order', { text: '', menu: [], counts: {}, only: false });
// Claude 키는 타로와 같이 씀: 타로에서 넣은 키를 그대로 읽고, 여기서 넣어도 타로에서 보임
const keyPrefs = store('tarot', { key: '' });
const KEY_SESSION = 'toybox:tarot-key'; // '이번만 쓰기' 키: 이 탭을 닫으면 지워짐
const PHOTO_MAX = 6, PHOTO_EDGE = 2000; // 한 번에 읽는 사진 수, 보낼 때 줄이는 긴 쪽(px)
// 正 쓰는 순서: 위 가로 → 가운데 세로 → 가운데 짧은 가로 → 왼쪽 세로 → 아래 가로 (20×20 칸)
const STROKES = [[3, 3, 17, 3], [10, 3, 10, 17], [10, 10, 15, 10], [5, 10, 5, 17], [2, 17, 18, 17]];
const TEMP_LABEL = { ice: '🧊 아이스', hot: '🔥 따뜻한' };
let editing = false; // 메뉴 고치는 중 (메뉴가 있어도 적는 화면)
let reading = false; // 메뉴판을 읽는 중
let readNote = null; // 읽은 결과 한 줄 { text, err }

function render() {
  paintKeyButton();
  $('app').replaceChildren(editing || !prefs.get().menu.length ? menuPanel() : countPanel());
}

// ---------- 1. 메뉴 만들기: 직접 적기 · 📷 메뉴판 사진 ----------
function menuPanel() {
  const o = prefs.get(), panel = h('section', 'panel order-panel'), ta = h('textarea'), info = h('p', 'hint');
  const go = button(o.menu.length ? '이 메뉴로 세기' : '주문 받기 시작', startCounting, 'btn primary big');
  ta.id = 'menuText';
  ta.rows = 10;
  ta.placeholder = '한 줄에 메뉴 하나씩\n아메리카노 (아이스/따뜻한)\n아인슈페너 (아이스만)\n자몽에이드\n…';
  ta.value = o.text;
  const check = () => {
    const n = parseMenu(ta.value).length;
    info.textContent = n ? `메뉴 ${n}개` : '메뉴를 적거나 메뉴판 사진을 찍어요.';
    go.disabled = !n || reading;
  };
  ta.addEventListener('input', () => { prefs.set({ text: ta.value }); check(); });
  check();
  const head = h('div', 'panel-head'), photo = h('div', 'order-photo');
  head.append(h('h2', '', '메뉴'));
  if (o.text.trim()) head.append(button('비우기', () => { prefs.set({ text: '' }); readNote = null; render(); }, 'btn small'));
  const shot = button(reading ? '📷 메뉴판 읽는 중…' : '📷 메뉴판 사진으로 읽기', () => $('photoInput').click(), 'btn');
  shot.disabled = reading;
  photo.append(shot);
  if (readNote) photo.append(h('p', `order-note${readNote.err ? ' err' : ''}`, readNote.text));
  panel.append(head, photo, ta, info, go,
    h('p', 'hint', '아이스와 따뜻한을 나눠 셀 메뉴는 이름 끝에 (아이스/따뜻한), 하나만 되는 메뉴는 (아이스만)이나 (따뜻한만)을 붙여요. HOT/ICE, ICE ONLY라고 적어도 돼요.'),
    h('p', 'hint', '사진은 여러 장 골라도 돼요. 읽은 메뉴는 아래 칸에 붙으니 틀린 이름은 고쳐 주세요. 사진은 메뉴 이름을 읽는 데만 Claude에게 보내고 저장하지 않아요.'));
  if (o.menu.length) {
    const back = button('고치지 않고 돌아가기', () => { editing = false; prefs.set({ text: o.menu.join('\n') }); render(); }, 'btn');
    back.disabled = reading; // 읽는 중에 나가면 읽은 메뉴가 갈 곳이 없음
    panel.append(back);
  }
  return panel;
}
function startCounting() {
  const menu = parseMenu($('menuText').value), { counts, dropped } = keepCounts(prefs.get().counts, menu);
  if (dropped.length && !confirm(`지운 메뉴의 주문도 같이 지워져요.\n${dropped.map(([name, n]) => `${name} ${n}`).join('\n')}`)) return;
  prefs.set({ menu, counts, text: menu.join('\n') });
  editing = false;
  readNote = null;
  render();
  scrollTo(0, 0);
}

// ---------- 2. 세기: 메뉴마다 ＋ 추가 / − 취소 ----------
function countPanel() {
  const o = prefs.get(), panel = h('section', 'panel order-panel'), top = h('div', 'order-top'), seg = h('div', 'seg'), list = h('ul', 'order-list');
  const total = h('b', 'order-total'), onlyBtn = button('', () => { prefs.set({ only: true }); render(); }, o.only ? 'on' : '');
  total.id = 'orderTotal';
  onlyBtn.id = 'onlyBtn';
  seg.append(button('전체 메뉴', () => { prefs.set({ only: false }); render(); }, o.only ? '' : 'on'), onlyBtn);
  top.append(total, seg);
  const lines = o.only ? o.menu.filter(line => entryTotal(line, o.counts) > 0) : o.menu;
  list.append(...lines.map(menuRow));
  if (!lines.length) list.append(h('li', 'order-empty', '아직 주문이 없어요'));
  const adder = h('form', 'order-adder'), inp = h('input', 'text-input'), add = h('button', 'btn', '＋ 넣기');
  inp.placeholder = '메뉴에 없는 것 주문하기';
  adder.append(inp, add);
  adder.addEventListener('submit', e => { e.preventDefault(); addMenu(inp.value); });
  const btns = h('div', 'play-btns'), copy = button('📋 주문 복사', copyOrder, 'btn'), clear = button('개수 모두 지우기', clearCounts, 'btn');
  copy.id = 'copyBtn';
  clear.id = 'clearBtn';
  btns.append(copy, button('메뉴 고치기', () => { editing = true; prefs.set({ text: o.menu.join('\n') }); render(); scrollTo(0, 0); }, 'btn'), clear);
  panel.append(top, h('p', 'hint', '폰을 테이블마다 넘기며 자기 메뉴의 ＋ 추가를 눌러요. 잘못 눌렀으면 − 취소.'), list, adder, btns);
  paintTotal(panel);
  return panel;
}
// 메뉴 한 줄: [이름 · 개수] 아래에 세는 칸 하나(나누는 메뉴는 🧊 아이스 · 🔥 따뜻한 둘, 아이스만이면 🧊 하나)
// 칸마다 [(🧊 아이스 7) 正正下 · − 취소 ＋ 추가]. 칸이 하나면 칸 개수는 빼고. 누르면 이 메뉴와 합계만 다시 그림
function menuRow(line) {
  const li = h('li', 'order-row'), head = h('div', 'order-head'), num = h('span', 'order-n'), keys = entryKeys(line);
  head.append(h('b', 'order-name', readEntry(line).name), num);
  li.append(head);
  const painters = keys.map(({ key, temp }) => {
    const row = h('div', `order-line${temp ? ` ${temp}` : ''}`), marks = h('span', 'tally'), sub = h('span', 'order-sub'), btns = h('span', 'order-btns');
    const minus = button('− 취소', () => change(key, -1, paint, line), 'btn'), plus = button('＋ 추가', () => change(key, 1, paint, line), 'btn primary');
    minus.setAttribute('aria-label', `${key} 하나 취소`);
    plus.setAttribute('aria-label', `${key} 하나 추가`);
    marks.setAttribute('aria-hidden', 'true');
    btns.append(minus, plus);
    if (temp) row.append(h('span', 'temp', TEMP_LABEL[temp]));
    if (keys.length > 1) row.append(sub);
    row.append(marks, btns);
    li.append(row);
    return fresh => {
      const n = prefs.get().counts[key] || 0;
      row.classList.toggle('has', n > 0);
      sub.textContent = n;
      marks.replaceChildren(...tallyMarks(n, fresh));
      minus.disabled = !n;
    };
  });
  const paint = freshKey => {
    painters.forEach((p, i) => p(keys[i].key === freshKey));
    const n = entryTotal(line, prefs.get().counts);
    li.classList.toggle('has', n > 0);
    num.textContent = n;
  };
  paint('');
  return li;
}
// 바를 정: 다섯 획마다 正 하나. fresh면 마지막 획이 그려지듯 나타남
function tallyMarks(n, fresh) {
  const groups = tallyGroups(n);
  return groups.map((g, i) => {
    const s = svg('svg', { viewBox: '0 0 20 20' });
    for (let k = 0; k < g; k++) {
      const [x1, y1, x2, y2] = STROKES[k], line = svg('line', { x1, y1, x2, y2, pathLength: 1 });
      if (fresh && i === groups.length - 1 && k === g - 1) line.classList.add('new');
      s.append(line);
    }
    return s;
  });
}
function change(key, d, paint, line) {
  const counts = { ...prefs.get().counts }, n = Math.max(0, (counts[key] || 0) + d);
  if (n) counts[key] = n; else delete counts[key];
  prefs.set({ counts });
  buzz(d > 0 ? 15 : [10, 50, 10]);
  if (prefs.get().only && !entryTotal(line, counts)) { render(); return; } // 주문한 것만 보기에서 0이 되면 메뉴를 뺌
  paint(d > 0 ? key : '');
  paintTotal();
}
function paintTotal(root = document) {
  const o = prefs.get(), total = totalOf(o.counts), find = id => root.querySelector(`#${id}`);
  find('orderTotal').textContent = `모두 ${total}잔`;
  find('onlyBtn').textContent = `주문한 것만 ${o.menu.filter(line => entryTotal(line, o.counts) > 0).length}`;
  find('copyBtn').disabled = find('clearBtn').disabled = !total;
}
// 메뉴에 없는 것: 메뉴 끝에 넣고 1잔 (아이스·따뜻한을 둘 다 고르는 메뉴는 어느 쪽인지 몰라서 넣기만)
function addMenu(value) {
  const o = prefs.get(), line = parseMenu(value)[0];
  if (!line) return;
  const { name } = readEntry(line), keys = entryKeys(line), pick = keys.length > 1;
  if (o.menu.some(x => readEntry(x).name === name)) { toast('이미 있는 메뉴예요. 그 줄의 ＋ 추가를 눌러요'); return; }
  if (o.menu.length >= MENU_MAX) { toast(`메뉴는 ${MENU_MAX}개까지예요`); return; }
  const menu = [...o.menu, line];
  prefs.set({ menu, text: menu.join('\n'), counts: pick ? o.counts : { ...o.counts, [keys[0].key]: 1 }, only: pick ? false : o.only }); // 0잔이라 주문한 것만 보기엔 안 보임
  render();
  toast(pick ? `‘${name}’ 메뉴를 넣었어요. 아이스·따뜻한 중에 ＋ 추가를 눌러요` : `‘${keys[0].key}’ 1잔 넣었어요`);
}
async function copyOrder() {
  const o = prefs.get(), text = orderText(o.menu, o.counts);
  try { await navigator.clipboard.writeText(text); toast('주문을 복사했어요'); } catch { prompt('주문을 복사해 주세요', text); } // 복사가 안 되는 브라우저
}
function clearCounts() {
  if (!confirm(`주문 ${totalOf(prefs.get().counts)}잔을 모두 지울까요? 메뉴는 그대로예요.`)) return;
  prefs.set({ counts: {} });
  render();
}

// ---------- 📷 메뉴판 읽기 (Claude) ----------
// 사진을 고르면 → 키가 없으면 키부터 넣고 → 긴 쪽 PHOTO_EDGE로 줄여 Claude에게 보내고 → 받은 이름을 메뉴 칸 끝에 붙임
$('photoInput').addEventListener('change', e => {
  const all = [...e.target.files], files = all.slice(0, PHOTO_MAX);
  e.target.value = ''; // 같은 사진을 다시 골라도 change가 오게
  if (!files.length) return;
  if (all.length > PHOTO_MAX) toast(`사진은 한 번에 ${PHOTO_MAX}장까지 읽어요`);
  if (apiKey()) readMenu(files); else openKeyDialog(() => readMenu(files));
});
async function readMenu(files) {
  const key = apiKey();
  if (!key || reading) return;
  reading = true;
  readNote = { text: '메뉴판을 읽고 있어요. 조금 걸려요…' };
  render();
  try {
    const names = await askMenu(key, await Promise.all(files.map(shrinkPhoto)));
    const text = prefs.get().text, before = parseMenu(text).length, after = addNames(text, names);
    prefs.set({ text: after });
    const added = parseMenu(after).length - before;
    readNote = !names.length ? { text: '메뉴를 찾지 못했어요. 메뉴판이 잘 보이게 다시 찍어 보세요.', err: true }
      : added ? { text: `메뉴 ${added}개를 넣었어요. 틀린 이름은 고쳐 주세요.` } : { text: '읽은 메뉴가 이미 다 있어요.' };
  } catch (err) {
    readNote = { text: err.message, err: true };
  }
  reading = false;
  render();
}
async function shrinkPhoto(file) {
  let img;
  try { img = await createImageBitmap(file); } catch { throw new Error('사진을 열지 못했어요. 다른 사진(JPG·PNG)으로 해 보세요.'); }
  const [w, hh] = fitSize(img.width, img.height, PHOTO_EDGE), c = h('canvas');
  c.width = w;
  c.height = hh;
  c.getContext('2d').drawImage(img, 0, 0, w, hh);
  img.close();
  const url = c.toDataURL('image/jpeg', 0.85);
  return url.slice(url.indexOf(',') + 1); // base64만
}
// Claude 한 번 부르기: 사진들 + MENU_PROMPT → { items: [...] } (MENU_SCHEMA 모양으로만 답함)
// 브라우저가 api.anthropic.com을 바로 부름(서버 없음, 타로 claudeStream과 같은 머리말)
async function askMenu(key, images) {
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01', // 안전 필터에 걸리면 서버가 다른 모델로 이어서 읽음
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-5-5', max_tokens: 16000, fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: MENU_SCHEMA } }, // 글자 읽기라 짧게 생각하고 빨리
        messages: [{ role: 'user', content: [
          ...images.map(data => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } })),
          { type: 'text', text: MENU_PROMPT },
        ] }],
      }),
    });
  } catch { throw new Error('인터넷에 연결돼 있는지 확인해 주세요.'); }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error({ 401: 'API 키가 맞지 않아요. 🔑에서 다시 넣어 주세요.', 413: '사진이 너무 커요. 장수를 줄여 다시 해 보세요.', 429: '요청이 많아요. 조금 뒤에 다시 해 보세요.', 529: 'Claude가 붐벼요. 조금 뒤에 다시 해 보세요.' }[res.status]
      || `읽지 못했어요 (${res.status}) ${body?.error?.message || ''}`);
  }
  if (body?.stop_reason === 'refusal') throw new Error('Claude가 이 사진은 읽지 않았어요. 메뉴판만 보이게 다시 찍어 보세요.');
  const text = body?.content?.filter(b => b.type === 'text').at(-1)?.text || '';
  return parseMenuReply(text);
}

// ---------- Claude API 키 (각자, 타로와 같이 씀): 이 기기에 저장 또는 이번만(이 탭) ----------
function sessionKey() { try { return sessionStorage.getItem(KEY_SESSION) || ''; } catch { return ''; } }
const apiKey = () => keyPrefs.get().key || sessionKey();
function paintKeyButton() { $('keyBtn').textContent = apiKey() ? '🔑 키 넣음' : '🔑 Claude 키'; }
let afterKey = null; // 키를 넣으면 이어서 할 일 (사진을 고른 뒤 열었을 때)
function openKeyDialog(then) {
  afterKey = typeof then === 'function' ? then : null;
  $('keyInput').value = apiKey();
  $('keyForm').keySave.value = keyPrefs.get().key || !sessionKey() ? 'device' : 'session';
  $('keyDlg').showModal();
}
function setKey(key, where) {
  keyPrefs.set({ key: where === 'device' ? key : '' });
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

render();

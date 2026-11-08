'use strict';
// 시크릿 산타 개인 화면 (폰): 링크 # 뒤에 담긴 내 결과만 풀어서 보여 줌 (santa-core.js decodeCard)
// 옆에서 화면을 볼 수 있으니 선물 상자를 눌러야 이름이 보이고, 다시 가릴 수 있음
// 위시리스트(santa-db.js): 맨 아래에 내 것을 쓰고, 상자를 열면 받는 사람 것이 이름 밑에 보임. 둘 다 바뀌면 바로 다시 그림
const card = decodeCard(location.hash.slice(1));
const wishOn = !!(card && card.w && card.rw && firebaseConfig); // 위시리스트가 생기기 전 링크거나 Firebase 설정이 없으면 안 보임
const theirs = h('ul', 'wish-list'), mine = h('ul', 'wish-list');
let mineCount = 0;

function render(open) {
  const app = $('app');
  if (!card) {
    app.replaceChildren(h('div', 'me-gift', '🎁'), h('p', 'me-hello', '링크가 잘못됐어요'), h('p', 'hint', '주최자에게 링크를 다시 받아 주세요.'));
    return;
  }
  const head = h('p', 'me-draw', `🎅 시크릿 산타 · 추첨 #${card.d}`), hello = h('p', 'me-hello', `${card.g}님, 안녕하세요!`);
  if (!open) {
    const gift = button('', () => render(true), 'me-gift');
    gift.append(h('span', 'me-box', '🎁'), h('span', 'me-tap', '눌러서 확인하기'));
    app.replaceChildren(head, hello, gift, h('p', 'hint', '주변에 화면을 보는 사람이 없는지 확인하고 눌러요.'));
  } else {
    const who = h('div', 'me-result');
    who.append(h('p', '', `${card.g}님이 선물할 사람은`), h('p', 'me-name', card.r), h('p', 'me-tree', '🎄'));
    app.replaceChildren(head, who);
    if (wishOn) app.append(wishBox(`🎁 ${card.r}님 위시리스트`, theirs));
    app.append(button('다시 가리기', () => render(false), 'btn'),
      h('p', 'hint', '이 링크는 다시 열어도 같은 결과예요. 다른 사람에게 보여 주지 마세요.'));
  }
  if (wishOn) app.append(myBox);
}

// ---------- 위시리스트 ----------
function wishBox(title, list, ...rest) {
  const box = h('section', 'wish-box');
  box.append(h('h2', '', title), list, ...rest);
  return box;
}
function wishRow(w, onRemove) {
  const li = h('li'), item = h('div', 'wish-item');
  item.append(h('span', 'wish-name', w.name));
  let host = '';
  try { host = new URL(w.link).hostname.replace(/^www\./, ''); } catch { /* 링크 없음 또는 주소 꼴이 아님 */ }
  if (host && /^https?:\/\//i.test(w.link)) { // 규칙이 http(s) 주소만 받지만 한 번 더 (javascript: 같은 것 막기)
    const a = h('a', 'wish-link', `🔗 ${host}`);
    a.href = w.link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    item.append(a);
  }
  li.append(item);
  if (onRemove) {
    const x = button('✕', onRemove, 'icon-btn small');
    x.setAttribute('aria-label', `${w.name} 지우기`);
    li.append(x);
  }
  return li;
}
const note = text => h('li', 'wish-empty', text);
const LOAD_FAIL = '위시리스트를 못 불러왔어요. 인터넷 연결을 확인하고 새로 고쳐 주세요.';

// 내 위시리스트: 칸에 쓰던 글자가 다시 그릴 때 안 지워지게 한 번만 만듦
const myForm = h('form', 'wish-form'), myFull = h('p', 'hint', `${MAX_WISHES}개까지 넣을 수 있어요.`);
const myBox = wishBox('📝 내 위시리스트', mine, myForm, myFull, h('p', 'hint', '갖고 싶은 것을 써 두면 나를 뽑은 산타 화면에 바로 보여요. 안 써도 괜찮아요.'));
{
  const name = h('input', 'text-input'), link = h('input', 'text-input');
  name.maxLength = MAX_WISH_NAME;
  name.placeholder = '갖고 싶은 것 (예: 겨울 장갑)';
  link.placeholder = '참고 링크 (안 써도 돼요)';
  link.inputMode = 'url';
  link.autocomplete = 'off';
  myForm.append(name, link, h('button', 'btn primary', '넣기'));
  myForm.addEventListener('submit', e => {
    e.preventDefault();
    const n = name.value.trim(), l = wishLink(link.value);
    if (!n) { name.focus(); return; }
    if (l === null) { toast('참고 링크는 https://로 시작하는 주소를 넣어 주세요'); link.focus(); return; }
    if (mineCount >= MAX_WISHES) return;
    const typed = [name.value, link.value];
    name.value = link.value = ''; // 바로 비우고, 못 넣으면 되돌림 (인터넷이 느려도 목록엔 먼저 보임)
    wishDb.add(card.w, n, l).catch(() => {
      if (!name.value && !link.value) [name.value, link.value] = typed;
      toast('못 넣었어요. 인터넷 연결을 확인해 주세요');
    });
  });
}
function paintMine(items) {
  mineCount = items.length;
  mine.replaceChildren(...items.map(w => wishRow(w, () => {
    if (confirm(`‘${w.name}’ 지울까요?`)) wishDb.remove(card.w, w.id).catch(() => toast('못 지웠어요. 인터넷 연결을 확인해 주세요'));
  })));
  if (!items.length) mine.append(note('아직 없어요.'));
  for (const el of myForm.elements) el.disabled = items.length >= MAX_WISHES;
  myFull.hidden = items.length < MAX_WISHES;
}
function paintTheirs(items) {
  theirs.replaceChildren(...items.map(w => wishRow(w)));
  if (!items.length) theirs.append(note(`${card.r}님이 아직 안 썼어요. 쓰면 여기에 바로 보여요.`));
}

if (wishOn) {
  mine.append(note('불러오는 중…'));
  theirs.append(note('불러오는 중…'));
  myFull.hidden = true;
  wishDb.watch(card.w, paintMine, () => mine.replaceChildren(note(LOAD_FAIL))).catch(() => mine.replaceChildren(note(LOAD_FAIL)));
  wishDb.watch(card.rw, paintTheirs, () => theirs.replaceChildren(note(LOAD_FAIL))).catch(() => theirs.replaceChildren(note(LOAD_FAIL)));
}
addEventListener('hashchange', () => location.reload()); // 다른 링크를 같은 탭에 붙여 넣었을 때
render(false);

'use strict';
// 시크릿 산타 개인 화면 (폰): 링크 # 뒤에 담긴 내 결과만 풀어서 보여 줌 (santa-core.js decodeCard)
// 옆에서 화면을 볼 수 있으니 선물 상자를 눌러야 이름이 보이고, 다시 가릴 수 있음
const card = decodeCard(location.hash.slice(1));

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
    return;
  }
  const who = h('div', 'me-result');
  who.append(h('p', '', `${card.g}님이 선물할 사람은`), h('p', 'me-name', card.r), h('p', 'me-tree', '🎄'));
  app.replaceChildren(head, who, button('다시 가리기', () => render(false), 'btn'),
    h('p', 'hint', '이 링크는 다시 열어도 같은 결과예요. 다른 사람에게 보여 주지 마세요.'));
}
addEventListener('hashchange', () => location.reload()); // 다른 링크를 같은 탭에 붙여 넣었을 때
render(false);

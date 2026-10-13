'use strict';
// 앱 설치(PWA)·오프라인: 모든 페이지에서 서비스 워커(sw.js, 저장소 맨 위)를 등록하고, 홈에서만 설치 배너를 띄움
// 살림노트(everyday_notes) app.js 의 설치 배너에서 가져옴. 파일을 더블클릭해서 연 경우(file://)엔 동작 안 함
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register(new URL('../sw.js', document.currentScript.src)).catch(() => {});
}

// 크롬·엣지가 설치할 수 있다고 알려 주면(안드로이드·PC, 이미 설치했으면 안 옴) 홈 위에 '앱으로 설치하기' 배너.
// 아이폰은 이 알림이 없어서 '공유 › 홈 화면에 추가' 안내를 대신 띄움 (홈 화면에서 열었거나, 홈 화면에 추가가 없는 카톡 등 앱 안 브라우저면 안 띄움)
// ✕로 닫으면 이 기기에선 다시 안 띄우고 브라우저 기본 안내에 맡김
(() => {
  const KEY = 'toybox:app', banner = document.getElementById('installBanner');
  const closed = () => { try { return !!JSON.parse(localStorage.getItem(KEY))?.installClosed; } catch { return false; } };
  const iosGuide = /iPhone|iPad|iPod/.test(navigator.userAgent) && /Safari\//.test(navigator.userAgent) && !navigator.standalone;
  let installEvt = null;
  addEventListener('beforeinstallprompt', e => {
    if (closed()) return;
    e.preventDefault(); // 브라우저가 따로 띄우는 설치 안내 대신 배너로
    installEvt = e;
    render();
  });
  addEventListener('appinstalled', () => { installEvt = null; render(); });
  function render() {
    if (!banner) return; // 게임 페이지엔 배너 자리가 없음
    banner.hidden = closed() || !(installEvt || iosGuide);
    if (banner.hidden) return;
    const go = document.createElement(installEvt ? 'button' : 'span'), x = document.createElement('button');
    go.className = 'banner-go';
    if (installEvt) {
      go.type = 'button';
      go.textContent = '📲 장난감 상자 앱으로 설치하기';
      go.addEventListener('click', () => { installEvt.prompt(); installEvt = null; render(); }); // 브라우저 설치 창. 한 번만 쓸 수 있음
    } else go.textContent = '📲 앱으로 쓰려면 공유 › ‘홈 화면에 추가’ (공유가 안 보이면 ··· 안에)';
    x.type = 'button';
    x.className = 'icon-btn small';
    x.title = '닫기 (이 기기에선 다시 안 떠요)';
    x.textContent = '✕';
    x.addEventListener('click', () => {
      try { localStorage.setItem(KEY, JSON.stringify({ installClosed: true })); } catch { /* 못 씀 */ }
      installEvt = null;
      render();
    });
    banner.replaceChildren(go, x);
  }
  render();
})();

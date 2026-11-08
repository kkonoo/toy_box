'use strict';
// 시크릿 산타 위시리스트 저장소 (Firebase Firestore, 투표와 같은 프로젝트). 설정은 js/firebase-config.js, 지키는 규칙은 firestore.rules
// santaWishes/{위시 id}/items/{항목} = { name, link(없어도 됨), at }. 참가자 이름은 저장하지 않음
// 위시 id는 링크(# 뒤)에만 있음: 본인 링크로 쓰고, 나를 뽑은 산타 링크로 읽음 (santa-core.js wishId)
// 로그인 화면 없이 익명 로그인 (규칙이 로그인한 요청만 받아서)
const FIREBASE = 'https://www.gstatic.com/firebasejs/12.19.0/';
let fbReady = null;
function fb() {
  fbReady ||= (async () => {
    const [{ getApps, initializeApp }, A, F] = await Promise.all(['app', 'auth', 'firestore'].map(n => import(`${FIREBASE}firebase-${n}.js`)));
    const app = getApps()[0] || initializeApp(firebaseConfig), auth = A.getAuth(app);
    await auth.authStateReady();
    if (!auth.currentUser) await A.signInAnonymously(auth);
    return { F, db: F.getFirestore(app) };
  })().catch(e => { fbReady = null; throw e; }); // 실패하면 다음에 처음부터 다시
  return fbReady;
}

const wishDb = {
  // 위시리스트가 바뀔 때마다 onItems([{ id, name, link }], 넣은 순서), 못 읽으면 onError
  async watch(list, onItems, onError) {
    const { F, db } = await fb();
    return F.onSnapshot(F.collection(db, 'santaWishes', list, 'items'), s => onItems(s.docs
      .map(d => { const x = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, name: x.name, link: x.link || '', at: x.at ? x.at.toMillis() : 0 }; })
      .sort((a, b) => a.at - b.at)), onError);
  },
  async add(list, name, link) {
    const { F, db } = await fb();
    await F.addDoc(F.collection(db, 'santaWishes', list, 'items'), { name, ...(link ? { link } : {}), at: F.serverTimestamp() });
  },
  async remove(list, id) {
    const { F, db } = await fb();
    await F.deleteDoc(F.doc(db, 'santaWishes', list, 'items', id));
  },
};

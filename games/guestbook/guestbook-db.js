'use strict';
// 방명록 저장소 (Firebase Firestore, 투표·초대장과 같은 프로젝트). 설정은 js/firebase-config.js, 지키는 규칙은 firestore.rules
// guestbooks/{방명록 id} = { title, date: 'YYYY-MM-DD', place, owner, createdAt }
// guestbooks/{방명록 id}/entries/{글} = { name, came: true|false, msg, wish, at }   글은 기기마다 하나, id = sha256('sign:' + uid + ':' + 방명록 id)
// 로그인 화면 없이 익명 로그인. uid는 그대로 남기지 않고 섞은 열쇠(bookKey)로만 씀 (초대장과 같은 방식)
const FIREBASE = 'https://www.gstatic.com/firebasejs/12.19.0/';
let fbReady = null;
function fb() {
  fbReady ||= (async () => {
    const [{ getApps, initializeApp }, A, F] = await Promise.all(['app', 'auth', 'firestore'].map(n => import(`${FIREBASE}firebase-${n}.js`)));
    const app = getApps()[0] || initializeApp(firebaseConfig), auth = A.getAuth(app);
    await auth.authStateReady();
    if (!auth.currentUser) await A.signInAnonymously(auth);
    return { F, db: F.getFirestore(app), uid: auth.currentUser.uid };
  })().catch(e => { fbReady = null; throw e; }); // 실패하면 다음에 처음부터 다시
  return fbReady;
}
// 열쇠 = sha256(kind + ':' + uid + ':' + 방명록 id), 16진수 소문자 (firestore.rules key와 같은 계산)
async function bookKey(kind, uid, id) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${kind}:${uid}:${id}`));
  return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
}

const bookDb = {
  async create(data) {
    const { F, db, uid } = await fb(), ref = F.doc(F.collection(db, 'guestbooks'));
    await F.setDoc(ref, { ...data, owner: await bookKey('owner', uid, ref.id), createdAt: F.serverTimestamp() });
    return ref.id;
  },
  async update(id, data) {
    const { F, db } = await fb();
    await F.updateDoc(F.doc(db, 'guestbooks', id), data);
  },
  // 방명록(없으면 null, isOwner: 이 기기가 만든 것)·글들(mine: 이 기기의 글)이 바뀔 때마다 on.book / on.entries, 못 읽으면 on.error
  async watch(id, on) {
    const { F, db, uid } = await fb(), ref = F.doc(db, 'guestbooks', id);
    const [ownerKey, myKey] = await Promise.all([bookKey('owner', uid, id), bookKey('sign', uid, id)]);
    const stops = [
      F.onSnapshot(ref, s => on.book(s.exists() ? { ...s.data(), isOwner: s.data().owner === ownerKey } : null), on.error),
      F.onSnapshot(F.collection(ref, 'entries'), s => on.entries(s.docs.map(d => {
        const x = d.data({ serverTimestamps: 'estimate' });
        return { id: d.id, name: x.name, came: x.came, msg: x.msg, wish: x.wish, at: x.at ? x.at.toMillis() : 0, mine: d.id === myKey };
      }).sort((a, b) => a.at - b.at)), on.error),
    ];
    return { stop: () => stops.forEach(f => f()) };
  },
  async sign(id, entry) {
    const { F, db, uid } = await fb();
    await F.setDoc(F.doc(db, 'guestbooks', id, 'entries', await bookKey('sign', uid, id)), { ...entry, at: F.serverTimestamp() });
  },
  async unsign(id) {
    const { F, db, uid } = await fb();
    await F.deleteDoc(F.doc(db, 'guestbooks', id, 'entries', await bookKey('sign', uid, id)));
  },
  async removeEntry(id, entryId) {
    const { F, db } = await fb();
    await F.deleteDoc(F.doc(db, 'guestbooks', id, 'entries', entryId));
  },
  // 만든 기기: 글을 모두 지우고 방명록도 지움
  async remove(id) {
    const { F, db } = await fb(), ref = F.doc(db, 'guestbooks', id), b = F.writeBatch(db);
    for (const d of (await F.getDocs(F.collection(ref, 'entries'))).docs) b.delete(d.ref);
    b.delete(ref);
    await b.commit();
  },
};

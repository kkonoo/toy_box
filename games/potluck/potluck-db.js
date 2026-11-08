'use strict';
// 포트럭 저장소 (Firebase Firestore, 투표와 같은 프로젝트). 설정은 js/firebase-config.js, 지키는 규칙은 firestore.rules
// potlucks/{포트럭 id} = { title, cats: [{ name, slots, ex }], owner, closed, createdAt }
// potlucks/{포트럭 id}/entries/{신청} = { name, cat, dish, host?, at }
//   내 신청: 기기마다 하나, id = sha256('entry:' + uid + ':' + 포트럭 id). 만든 기기가 랜덤으로 넣은 것은 host: true
// 로그인 화면 없이 익명 로그인. uid는 그대로 남기지 않고 섞은 열쇠(potKey)로만 씀 (투표와 같은 방식)
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
// 열쇠 = sha256(kind + ':' + uid + ':' + 포트럭 id), 16진수 소문자 (firestore.rules key와 같은 계산)
async function potKey(kind, uid, id) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${kind}:${uid}:${id}`));
  return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
}

const potDb = {
  async create(title, cats) {
    const { F, db, uid } = await fb(), ref = F.doc(F.collection(db, 'potlucks'));
    await F.setDoc(ref, { title, cats, owner: await potKey('owner', uid, ref.id), closed: false, createdAt: F.serverTimestamp() });
    return ref.id;
  },
  // 포트럭(없으면 null)·신청들이 바뀔 때마다 on.potluck / on.entries, 못 읽으면 on.error
  // potluck.isOwner: 이 기기가 만든 것인지, entry.mine: 이 기기의 신청인지
  async watch(id, on) {
    const { F, db, uid } = await fb(), ref = F.doc(db, 'potlucks', id);
    const [ownerKey, myKey] = await Promise.all([potKey('owner', uid, id), potKey('entry', uid, id)]);
    const stops = [
      F.onSnapshot(ref, s => on.potluck(s.exists() ? { ...s.data(), isOwner: s.data().owner === ownerKey } : null), on.error),
      F.onSnapshot(F.collection(ref, 'entries'), s => on.entries(s.docs.map(d => {
        const x = d.data({ serverTimestamps: 'estimate' });
        return { id: d.id, name: x.name, cat: x.cat, dish: x.dish, host: !!x.host, at: x.at ? x.at.toMillis() : 0, mine: d.id === myKey };
      })), on.error),
    ];
    return { stop: () => stops.forEach(f => f()) };
  },
  async sign(id, name, cat, dish) {
    const { F, db, uid } = await fb();
    await F.setDoc(F.doc(db, 'potlucks', id, 'entries', await potKey('entry', uid, id)), { name, cat, dish, at: F.serverTimestamp() });
  },
  async unsign(id) {
    const { F, db, uid } = await fb();
    await F.deleteDoc(F.doc(db, 'potlucks', id, 'entries', await potKey('entry', uid, id)));
  },
  // 만든 기기: 랜덤 배정을 넣으면서 마감 (한 번에)
  async fillAndClose(id, picks) {
    const { F, db } = await fb(), ref = F.doc(db, 'potlucks', id), b = F.writeBatch(db);
    for (const p of picks) b.set(F.doc(F.collection(ref, 'entries')), { name: p.name, cat: p.cat, dish: '', host: true, at: F.serverTimestamp() });
    b.update(ref, { closed: true });
    await b.commit();
  },
  async setClosed(id, closed) {
    const { F, db } = await fb();
    await F.updateDoc(F.doc(db, 'potlucks', id), { closed });
  },
  async setCats(id, cats) {
    const { F, db } = await fb();
    await F.updateDoc(F.doc(db, 'potlucks', id), { cats });
  },
  async removeEntry(id, entryId) {
    const { F, db } = await fb();
    await F.deleteDoc(F.doc(db, 'potlucks', id, 'entries', entryId));
  },
  // 만든 기기: 신청을 모두 지우고 포트럭도 지움
  async remove(id) {
    const { F, db } = await fb(), ref = F.doc(db, 'potlucks', id), b = F.writeBatch(db);
    for (const d of (await F.getDocs(F.collection(ref, 'entries'))).docs) b.delete(d.ref);
    b.delete(ref);
    await b.commit();
  },
};

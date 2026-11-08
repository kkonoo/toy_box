'use strict';
// 누가 썼을까 저장소 (Firebase Firestore, 투표와 같은 프로젝트). 설정은 js/firebase-config.js, 지키는 규칙은 firestore.rules
// whoRooms/{방 id} = { questions: [질문], owner, closed, createdAt }
// whoRooms/{방 id}/answers/{열쇠_질문 번호} = { name, q, text, at }   열쇠 = sha256('ans:' + uid + ':' + 방 id)
// 모든 답(이름 포함)은 방을 만든 기기만 읽음 → 다른 사람은 큰 화면에 공개되기 전까지 누가 무엇을 썼는지 모름
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
// 열쇠 = sha256(kind + ':' + uid + ':' + 방 id), 16진수 소문자 (firestore.rules key와 같은 계산)
async function whoKey(kind, uid, id) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${kind}:${uid}:${id}`));
  return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
}

const whoDb = {
  async create(questions) {
    const { F, db, uid } = await fb(), ref = F.doc(F.collection(db, 'whoRooms'));
    await F.setDoc(ref, { questions, owner: await whoKey('owner', uid, ref.id), closed: false, createdAt: F.serverTimestamp() });
    return ref.id;
  },
  // 방(없으면 null, isOwner: 이 기기가 만든 방)이 바뀔 때마다 onRoom
  async watchRoom(id, onRoom, onError) {
    const { F, db, uid } = await fb(), ownerKey = await whoKey('owner', uid, id);
    return F.onSnapshot(F.doc(db, 'whoRooms', id), s => onRoom(s.exists() ? { ...s.data(), isOwner: s.data().owner === ownerKey } : null), onError);
  },
  // 모든 답 (만든 기기만 규칙이 허락)
  async watchAnswers(id, onList, onError) {
    const { F, db } = await fb();
    return F.onSnapshot(F.collection(db, 'whoRooms', id, 'answers'), s => onList(s.docs.map(d => ({ id: d.id, ...d.data() }))), onError);
  },
  // 내 답: { 질문 번호: { name, text } }
  async mine(id, n) {
    const { F, db, uid } = await fb(), k = await whoKey('ans', uid, id), out = {};
    await Promise.all(Array.from({ length: n }, async (_, q) => {
      const s = await F.getDoc(F.doc(db, 'whoRooms', id, 'answers', `${k}_${q}`));
      if (s.exists()) out[q] = s.data();
    }));
    return out;
  },
  // 내 답 넣기·고치기: 빈 칸은 지움 (한 번에)
  async answer(id, name, texts) {
    const { F, db, uid } = await fb(), k = await whoKey('ans', uid, id), b = F.writeBatch(db);
    texts.forEach((text, q) => {
      const ref = F.doc(db, 'whoRooms', id, 'answers', `${k}_${q}`);
      if (text) b.set(ref, { name, q, text, at: F.serverTimestamp() }); else b.delete(ref);
    });
    await b.commit();
  },
  async setClosed(id, closed) {
    const { F, db } = await fb();
    await F.updateDoc(F.doc(db, 'whoRooms', id), { closed });
  },
  async remove(id) {
    const { F, db } = await fb(), ref = F.doc(db, 'whoRooms', id), b = F.writeBatch(db);
    for (const d of (await F.getDocs(F.collection(ref, 'answers'))).docs) b.delete(d.ref);
    b.delete(ref);
    await b.commit();
  },
};

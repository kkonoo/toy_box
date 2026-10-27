'use strict';
// 투표 저장소 (Firebase Firestore): 장난감 상자에서 서버를 쓰는 건 투표뿐. 설정은 js/firebase-config.js, 지키는 규칙은 firestore.rules
// 로그인 화면 없이 익명 로그인 → 기기(브라우저)마다 1표. 브라우저 데이터를 지우거나 다른 브라우저로 열면 새 사람
// 익명 로그인 uid는 어디에도 그대로 남기지 않고 투표마다 섞은 열쇠(voteKey)로만 씀
// polls/{투표 id} · polls/{투표 id}/options/{항목 id} · polls/{투표 id}/votes/{표 열쇠}
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
// 열쇠 = sha256('owner:' 또는 'vote:' + uid + ':' + 투표 id), 16진수 소문자 (firestore.rules key와 같은 계산)
// 투표마다 달라서 다른 투표의 표와 같은 사람인지, 어느 표가 주최자 것인지 알 수 없음
async function voteKey(kind, uid, poll) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${kind}:${uid}:${poll}`));
  return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
}
const millis = t => (t ? t.toMillis() : null);

const voteDb = {
  // 새 투표: 투표와 처음 항목을 한 번에 쓰고 투표 id를 돌려줌. 처음 항목 id는 '00'·'01'… (같은 시간에 써져서 이 순서로 줄 세움)
  async create(poll, items) {
    const { F, db, uid } = await fb(), ref = F.doc(F.collection(db, 'polls')), b = F.writeBatch(db);
    b.set(ref, { ...poll, closeAt: poll.closeAt == null ? null : F.Timestamp.fromMillis(poll.closeAt), closed: false,
      owner: await voteKey('owner', uid, ref.id), createdAt: F.serverTimestamp() });
    items.forEach((text, i) => b.set(F.doc(ref, 'options', pad(i)), { text, at: F.serverTimestamp() }));
    await b.commit();
    return ref.id;
  },
  // 투표 보기: 투표(없으면 null)·항목·내 표(없으면 null)가 바뀔 때마다 on.poll / on.options / on.mine, 못 읽으면 on.error
  // poll.isOwner: 이 기기가 만든 투표인지
  async watch(id, on) {
    const { F, db, uid } = await fb(), ref = F.doc(db, 'polls', id);
    const [ownerKey, myKey] = await Promise.all([voteKey('owner', uid, id), voteKey('vote', uid, id)]);
    const stops = [
      F.onSnapshot(ref, s => on.poll(s.exists() ? { ...s.data(), closeAt: millis(s.data().closeAt), isOwner: s.data().owner === ownerKey } : null), on.error),
      F.onSnapshot(F.collection(ref, 'options'), s => on.options(s.docs.map(d => ({ id: d.id, text: d.data().text, at: millis(d.data({ serverTimestamps: 'estimate' }).at) }))), on.error),
      F.onSnapshot(F.doc(ref, 'votes', myKey), s => on.mine(s.exists() ? s.data() : null), on.error),
    ];
    return {
      stop: () => stops.forEach(f => f()),
      // 모든 표 (투표한 순서): 결과를 볼 수 있을 때만 규칙이 허락함 → 못 보면 onDenied. 돌려준 함수로 그만 보기
      watchVotes: (onVotes, onDenied) => F.onSnapshot(F.query(F.collection(ref, 'votes'), F.orderBy('at')), s => onVotes(s.docs.map(d => d.data())), onDenied),
      // 연결 새로 열기: 열어 둔 연결에 지켜보기를 더하면 규칙이 마감 시간을 그 연결을 연 때 기준으로 봐서(에뮬레이터에서 확인)
      // 마감 시간이 지나도 결과가 막힘 → 끊었다 다시 이으면 지금 시각으로 봄 (다른 지켜보기는 저절로 이어짐)
      reconnect: () => F.disableNetwork(db).then(() => F.enableNetwork(db)),
    };
  },
  async addOption(id, text) {
    const { F, db } = await fb();
    await F.addDoc(F.collection(db, 'polls', id, 'options'), { text, at: F.serverTimestamp() });
  },
  async removeOption(id, optId) {
    const { F, db } = await fb();
    await F.deleteDoc(F.doc(db, 'polls', id, 'options', optId));
  },
  // 내 표 넣기·바꾸기. 익명 투표는 name = null (이름 칸을 아예 안 씀)
  async vote(id, picks, name) {
    const { F, db, uid } = await fb();
    await F.setDoc(F.doc(db, 'polls', id, 'votes', await voteKey('vote', uid, id)), { picks, ...(name == null ? {} : { name }), at: F.serverTimestamp() });
  },
  async unvote(id) {
    const { F, db, uid } = await fb();
    await F.deleteDoc(F.doc(db, 'polls', id, 'votes', await voteKey('vote', uid, id)));
  },
  // 주최자: 마감·다시 열기
  async setClosed(id, closed, closeAt) {
    const { F, db } = await fb();
    await F.updateDoc(F.doc(db, 'polls', id), { closed, closeAt: closeAt == null ? null : F.Timestamp.fromMillis(closeAt) });
  },
  // 주최자: 투표 지우기. 마감해야 모든 표를 읽고 지울 수 있어서(규칙) 먼저 마감하고, 표·항목·투표를 한 번에
  async remove(id) {
    const { F, db } = await fb(), ref = F.doc(db, 'polls', id);
    await F.updateDoc(ref, { closed: true });
    const [votes, options] = await Promise.all([F.getDocs(F.collection(ref, 'votes')), F.getDocs(F.collection(ref, 'options'))]);
    const b = F.writeBatch(db);
    for (const d of [...votes.docs, ...options.docs]) b.delete(d.ref);
    b.delete(ref);
    await b.commit();
  },
};

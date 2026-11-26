'use strict';
// 초대장 저장소 (Firebase Firestore, 투표와 같은 프로젝트). 설정은 js/firebase-config.js, 지키는 규칙은 firestore.rules
// invites/{초대장 id} = { title, date: 'YYYY-MM-DD', time: 'HH:MM', until: 'HH:MM' 또는 '', place, program, note, owner, createdAt }
// invites/{초대장 id}/rsvps/{답장} = { name, answer: 'yes'|'maybe'|'no', msg, at }   답장은 기기마다 하나, id = sha256('rsvp:' + uid + ':' + 초대장 id)
// 로그인 화면 없이 익명 로그인. uid는 그대로 남기지 않고 섞은 열쇠(inviteKey)로만 씀 (투표와 같은 방식)
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
// 열쇠 = sha256(kind + ':' + uid + ':' + 초대장 id), 16진수 소문자 (firestore.rules key와 같은 계산)
async function inviteKey(kind, uid, id) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${kind}:${uid}:${id}`));
  return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
}

const inviteDb = {
  async create(data) {
    const { F, db, uid } = await fb(), ref = F.doc(F.collection(db, 'invites'));
    await F.setDoc(ref, { ...data, owner: await inviteKey('owner', uid, ref.id), createdAt: F.serverTimestamp() });
    return ref.id;
  },
  async update(id, data) {
    const { F, db } = await fb();
    await F.updateDoc(F.doc(db, 'invites', id), data);
  },
  // 초대장(없으면 null, isOwner: 이 기기가 만든 것)·답장들(mine: 이 기기의 답장)이 바뀔 때마다 on.invite / on.rsvps, 못 읽으면 on.error
  async watch(id, on) {
    const { F, db, uid } = await fb(), ref = F.doc(db, 'invites', id);
    const [ownerKey, myKey] = await Promise.all([inviteKey('owner', uid, id), inviteKey('rsvp', uid, id)]);
    const stops = [
      F.onSnapshot(ref, s => on.invite(s.exists() ? { ...s.data(), isOwner: s.data().owner === ownerKey } : null), on.error),
      F.onSnapshot(F.collection(ref, 'rsvps'), s => on.rsvps(s.docs.map(d => {
        const x = d.data({ serverTimestamps: 'estimate' });
        return { id: d.id, name: x.name, answer: x.answer, msg: x.msg, at: x.at ? x.at.toMillis() : 0, mine: d.id === myKey };
      }).sort((a, b) => a.at - b.at)), on.error),
    ];
    return { stop: () => stops.forEach(f => f()) };
  },
  async reply(id, name, answer, msg) {
    const { F, db, uid } = await fb();
    await F.setDoc(F.doc(db, 'invites', id, 'rsvps', await inviteKey('rsvp', uid, id)), { name, answer, msg, at: F.serverTimestamp() });
  },
  async unreply(id) {
    const { F, db, uid } = await fb();
    await F.deleteDoc(F.doc(db, 'invites', id, 'rsvps', await inviteKey('rsvp', uid, id)));
  },
  async removeRsvp(id, rsvpId) {
    const { F, db } = await fb();
    await F.deleteDoc(F.doc(db, 'invites', id, 'rsvps', rsvpId));
  },
  // 만든 기기: 답장을 모두 지우고 초대장도 지움
  async remove(id) {
    const { F, db } = await fb(), ref = F.doc(db, 'invites', id), b = F.writeBatch(db);
    for (const d of (await F.getDocs(F.collection(ref, 'rsvps'))).docs) b.delete(d.ref);
    b.delete(ref);
    await b.commit();
  },
};

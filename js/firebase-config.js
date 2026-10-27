'use strict';
// Firebase 설정: 장난감 상자에서 Firebase를 쓰는 건 투표(games/vote)뿐. 다른 게임은 서버 없이 그대로
// Firebase 콘솔 › 프로젝트 설정 › 내 앱(웹 앱)의 firebaseConfig { … } 를 아래 null 자리에 붙여 넣어요 (README ‘투표 준비’)
// 이 값은 공개돼도 괜찮아요. 데이터를 지키는 건 firestore.rules
// null이면 투표 화면에 '아직 준비 중이에요'만 보여요
const firebaseConfig = {
  apiKey: 'AIzaSyDNiWKD8sJs-mMGyw4UmCRBwjrFq3HtgvQ',
  authDomain: 'vote-29.firebaseapp.com',
  projectId: 'vote-29',
  storageBucket: 'vote-29.firebasestorage.app',
  messagingSenderId: '659458361831',
  appId: '1:659458361831:web:1fab3f13927656d1b61542',
};

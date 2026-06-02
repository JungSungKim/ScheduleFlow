/* ================================================
   ScheduleFlow — Firebase Initialization
   Project: my-scheduleflow-dev
   ================================================ */

const firebaseConfig = {
  apiKey:            "AIzaSyD2Cs6-UrVnMX3OhL5x6qb9zkcG5rD63B8",
  authDomain:        "my-scheduleflow-dev.web.app",
  projectId:         "my-scheduleflow-dev",
  storageBucket:     "my-scheduleflow-dev.firebasestorage.app",
  messagingSenderId: "49679554908",
  appId:             "1:49679554908:web:14070ca574f5b2aa104999",
  measurementId:     "G-KMP18J0PBP"
};

firebase.initializeApp(firebaseConfig);

// ── Firebase Services (global) ──
const fbAuth           = firebase.auth();
const fbDb             = firebase.firestore();
const fbGoogleProvider = new firebase.auth.GoogleAuthProvider();

fbGoogleProvider.addScope('profile');
fbGoogleProvider.addScope('email');

// Korean locale for Google login prompt
fbGoogleProvider.setCustomParameters({ locale: 'ko' });

/* ================================================
   ScheduleFlow — Auth Module
   Google Sign-In, Logout, Data Migration, Account Deletion
   ================================================ */

// ── Auth State Listener (entry point) ──
function initAuth() {
  // 모바일 리다이렉트 로그인 결과 처리
  fbAuth.getRedirectResult().catch(e => {
    if (e.code && e.code !== 'auth/no-current-user') {
      alert('로그인 오류: ' + e.message);
    }
  });

  fbAuth.onAuthStateChanged(async (user) => {
    if (user) {
      await handleUserLogin(user);
    } else {
      Cache.todos = null;
      Cache.trips = null;
      showLoginScreen();
    }
  });
}

// ── Post-Login Flow ──
async function handleUserLogin(user) {
  showLoadingOverlay('데이터를 불러오는 중...');

  let isCloudAvailable = false;
  let hasTodos          = false;
  let hasTrips          = false;

  try {
    // Firestore 미설정 시 무한 대기 방지 — 6초 타임아웃
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore 연결 시간 초과')), 6000)
    );
    const result = await Promise.race([Store.loadFromCloud(user.uid), timeout]);
    hasTodos          = result.hasTodos;
    hasTrips          = result.hasTrips;
    isCloudAvailable  = true;
  } catch (cloudErr) {
    // Firestore 실패 → localStorage를 임시 소스로 사용하고 앱 진입 허용
    console.warn('[ScheduleFlow] Firestore 연결 실패, localStorage 사용:', cloudErr.message);
    Cache.todos = JSON.parse(localStorage.getItem('sf_todos') || '[]');
    Cache.trips = JSON.parse(localStorage.getItem('sf_trips') || '[]');
  }

  if (Cache.todos === null) Cache.todos = [];
  if (Cache.trips === null) Cache.trips = [];

  // 클라우드 정상 연결 + 첫 로그인 + 로컬 데이터 있음 → 마이그레이션 제안
  if (isCloudAvailable && !hasTodos && !hasTrips) {
    const localTodos = JSON.parse(localStorage.getItem('sf_todos') || '[]');
    const localTrips = JSON.parse(localStorage.getItem('sf_trips') || '[]');
    if (localTodos.length > 0 || localTrips.length > 0) {
      hideLoadingOverlay();
      showMigrationModal(user.uid, localTodos.length, localTrips.length);
      return;
    }
  }

  hideLoadingOverlay();
  enterApp(user);
}

function enterApp(user) {
  hideLoginScreen();
  updateProfileUI(user);
  startRealtimeSync(user.uid);
  navigate('dashboard');
}

// ── Google Sign-In ──
// 전략 결정:
//   Standalone PWA → signInWithPopup
//     (redirect는 Safari로 빠져나간 뒤 PWA 컨텍스트로 복귀 불가 — iOS 제약)
//   일반 모바일 브라우저 → signInWithRedirect (팝업 차단 우회)
//   데스크탑 → signInWithPopup
const _isMobile     = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
const _isStandalone = window.matchMedia('(display-mode: standalone)').matches
                      || window.navigator.standalone === true;

async function signInWithGoogle() {
  const btn   = document.getElementById('login-btn-google');
  const label = document.getElementById('login-btn-label');
  btn.disabled = true;
  label.textContent = '로그인 중...';

  try {
    if (_isMobile && !_isStandalone) {
      // 일반 모바일 브라우저: 팝업 차단 → 리다이렉트
      await fbAuth.signInWithRedirect(fbGoogleProvider);
    } else {
      // 데스크탑 or Standalone PWA: 팝업 사용
      await fbAuth.signInWithPopup(fbGoogleProvider);
    }
  } catch (e) {
    btn.disabled = false;
    label.textContent = 'Google로 계속하기';
    if (e.code !== 'auth/popup-closed-by-user') {
      alert('로그인 중 오류가 발생했습니다.\n' + e.message);
    }
  }
}

// ── Sign Out ──
async function signOut() {
  closeSettingsPanel();
  if (!confirm('로그아웃 하시겠습니까?')) return;

  Cache.todos = null;
  Cache.trips = null;
  stopRealtimeSync();
  await fbAuth.signOut();
  // onAuthStateChanged → showLoginScreen()
}

// ── Account Deletion (GDPR) ──
async function deleteAccount() {
  closeSettingsPanel();
  if (!confirm('계정과 모든 데이터가 영구적으로 삭제됩니다.\n정말로 삭제하시겠습니까?')) return;
  if (!confirm('⚠️ 이 작업은 되돌릴 수 없습니다.\n계속하시겠습니까?')) return;

  const user = fbAuth.currentUser;
  if (!user) return;

  showLoadingOverlay('데이터를 삭제하는 중...');
  try {
    await Store.deleteAllUserData(user.uid);
    await user.delete();
    // onAuthStateChanged fires → showLoginScreen()
  } catch (e) {
    hideLoadingOverlay();
    if (e.code === 'auth/requires-recent-login') {
      alert('보안을 위해 재로그인 후 다시 시도해 주세요.');
      await fbAuth.signOut();
    } else {
      alert('삭제 중 오류: ' + e.message);
    }
  }
}

// ── Data Migration Modal ──
function showMigrationModal(uid, todoCount, tripCount) {
  openModal(`
    <div class="modal-header">
      <h2>기존 데이터 발견</h2>
    </div>
    <div class="migration-body">
      <div class="migration-icon">☁️</div>
      <p class="migration-desc">이 기기에 저장된 데이터가 있습니다.</p>
      <div class="migration-stats">
        <span>📋 할 일 <strong>${todoCount}개</strong></span>
        <span>✈️ 출장 <strong>${tripCount}개</strong></span>
      </div>
      <p class="migration-note">클라우드로 가져오면 모든 기기에서 사용할 수 있습니다.</p>
    </div>
    <div class="form-actions" style="flex-direction:column;gap:10px">
      <button class="btn btn-primary" onclick="doMigrate('${uid}')">
        ☁️ 클라우드로 가져오기
      </button>
      <button class="btn btn-outline" onclick="skipMigrate()">
        새로 시작하기
      </button>
    </div>
  `);
}

async function doMigrate(uid) {
  closeModal();
  showLoadingOverlay('데이터를 이전하는 중...');
  try {
    await Store.migrateLocalToCloud(uid);
    hideLoadingOverlay();
    enterApp(fbAuth.currentUser);
  } catch (e) {
    hideLoadingOverlay();
    alert('마이그레이션 중 오류: ' + e.message);
  }
}

function skipMigrate() {
  closeModal();
  Cache.todos = [];
  Cache.trips = [];
  hideLoadingOverlay();
  enterApp(fbAuth.currentUser);
}

// ── Login Screen UI ──
function showLoginScreen() {
  document.getElementById('login-screen').classList.add('visible');
  // Reset login button state
  const btn   = document.getElementById('login-btn-google');
  const label = document.getElementById('login-btn-label');
  if (btn)   btn.disabled = false;
  if (label) label.textContent = 'Google로 계속하기';
  hideLoadingOverlay();
}

function hideLoginScreen() {
  document.getElementById('login-screen').classList.remove('visible');
}

// ── Loading Overlay ──
function showLoadingOverlay(msg) {
  document.getElementById('loading-msg').textContent = msg || '로딩 중...';
  document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoadingOverlay() {
  document.getElementById('loading-overlay').style.display = 'none';
}

// ── Profile UI ──
function updateProfileUI(user) {
  const avatar = document.getElementById('profile-avatar');
  const name   = document.getElementById('profile-name');
  const email  = document.getElementById('profile-email');

  if (avatar) {
    if (user.photoURL) {
      avatar.innerHTML = `<img src="${user.photoURL}" alt="profile" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    } else {
      avatar.textContent = (user.displayName || user.email || '?')[0].toUpperCase();
    }
  }
  if (name)  name.textContent  = user.displayName || '';
  if (email) email.textContent = user.email || '';

  // Settings panel user info
  const settingsInfo = document.getElementById('settings-user-info');
  if (settingsInfo) {
    settingsInfo.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0">
        <div class="settings-avatar">${user.photoURL
          ? `<img src="${user.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`
          : (user.displayName || '?')[0].toUpperCase()
        }</div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(user.displayName || '')}</div>
          <div style="font-size:0.82rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(user.email || '')}</div>
        </div>
      </div>`;
  }
}

// ── Settings Panel ──
function toggleSettingsPanel() {
  const panel = document.getElementById('settings-panel');
  panel.classList.toggle('open');
  document.getElementById('settings-backdrop').classList.toggle('open');
  if (panel.classList.contains('open') && typeof renderCalSyncSection === 'function') {
    renderCalSyncSection();
  }
}

function closeSettingsPanel() {
  document.getElementById('settings-panel').classList.remove('open');
  document.getElementById('settings-backdrop').classList.remove('open');
}

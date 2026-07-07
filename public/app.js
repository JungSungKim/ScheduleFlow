/* ================================================
   ScheduleFlow — Core App (Router, Theme, Storage)
   Write-Through Cache: Cache → localStorage → Firestore
   ================================================ */

// ── PWA 설치 프롬프트 ──
let _pwaPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _pwaPrompt = e;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  _pwaPrompt = null;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'none';
});

function triggerPwaInstall() {
  if (!_pwaPrompt) return;
  _pwaPrompt.prompt();
  _pwaPrompt.userChoice.then(result => {
    if (result.outcome === 'accepted') {
      const btn = document.getElementById('pwa-install-btn');
      if (btn) btn.style.display = 'none';
    }
    _pwaPrompt = null;
  });
}

// ── In-Memory Cache ──
const Cache = { todos: null, trips: null };

// ── Firestore Debounced Sync ──
const _syncTimers = {};
async function _syncToCloud(key, data) {
  const user = (typeof fbAuth !== 'undefined') ? fbAuth.currentUser : null;
  if (!user) return;
  try {
    await fbDb
      .collection('users').doc(user.uid)
      .collection('sf-data').doc(key)
      .set({
        list: data,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  } catch (e) {
    console.warn('[Firestore sync failed]', key, e.message);
  }
}

function _scheduleSyncToCloud(key, data) {
  clearTimeout(_syncTimers[key]);
  _syncTimers[key] = setTimeout(() => _syncToCloud(key, data), 1500);
}

// ── Storage Layer (Write-Through Cache) ──
const Store = {
  // ── Synchronous reads — always from memory Cache ──
  getTodos() { return Cache.todos ?? []; },
  getTrips() { return Cache.trips ?? []; },

  // ── Theme stays on device (preference) ──
  getTheme()   { return localStorage.getItem('sf_theme') || 'light'; },
  saveTheme(t) { localStorage.setItem('sf_theme', t); },

  getDashboardOrder() {
    try { return JSON.parse(localStorage.getItem('sf_dash_order')); } catch(e) { return null; }
  },
  saveDashboardOrder(order) {
    localStorage.setItem('sf_dash_order', JSON.stringify(order));
  },

  // ── 문서 기본값 템플릿 (로컬 전용) ──
  getDocTemplate() {
    try { return JSON.parse(localStorage.getItem('sf_doc_template') || '{}'); } catch(e) { return {}; }
  },
  saveDocTemplate(tpl) {
    localStorage.setItem('sf_doc_template', JSON.stringify(tpl));
  },

  // ── 알림 설정 (로컬 전용) ──
  getNotifEnabled() { return localStorage.getItem('sf_notif') === '1'; },
  saveNotifEnabled(v) { localStorage.setItem('sf_notif', v ? '1' : '0'); },

  // ── 캘린더 연동 (로컬 전용) ──
  getCalToken:     () => localStorage.getItem('sf_cal_token') || null,
  saveCalToken:    (t) => { if (t) localStorage.setItem('sf_cal_token', t); else localStorage.removeItem('sf_cal_token'); },
  getCalWorkerUrl: () => localStorage.getItem('sf_cal_worker') || '',
  saveCalWorkerUrl:(u) => { if (u) localStorage.setItem('sf_cal_worker', u); else localStorage.removeItem('sf_cal_worker'); },

  // ── Writes: Cache + localStorage + async Firestore ──
  saveTodos(list) {
    Cache.todos = list;
    localStorage.setItem('sf_todos', JSON.stringify(list));
    _scheduleSyncToCloud('todos', list);
    scheduleCalSync();
  },
  saveTrips(list) {
    Cache.trips = list;
    localStorage.setItem('sf_trips', JSON.stringify(list));
    _scheduleSyncToCloud('trips', list);
    scheduleCalSync();
  },

  // ── Cloud operations (called from auth.js only) ──
  async loadFromCloud(uid) {
    const base = fbDb.collection('users').doc(uid).collection('sf-data');
    const [todosSnap, tripsSnap] = await Promise.all([
      base.doc('todos').get(),
      base.doc('trips').get()
    ]);
    const hasTodos = todosSnap.exists;
    const hasTrips = tripsSnap.exists;
    Cache.todos = hasTodos ? (todosSnap.data().list ?? []) : null;
    Cache.trips = hasTrips ? (tripsSnap.data().list ?? []) : null;
    return { hasTodos, hasTrips };
  },

  async migrateLocalToCloud(uid) {
    const localTodos = JSON.parse(localStorage.getItem('sf_todos') || '[]');
    const localTrips = JSON.parse(localStorage.getItem('sf_trips') || '[]');
    const base = fbDb.collection('users').doc(uid).collection('sf-data');
    const ts   = firebase.firestore.FieldValue.serverTimestamp();
    await Promise.all([
      base.doc('todos').set({ list: localTodos, updatedAt: ts }),
      base.doc('trips').set({ list: localTrips, updatedAt: ts })
    ]);
    Cache.todos = localTodos;
    Cache.trips = localTrips;
  },

  async deleteAllUserData(uid) {
    const base = fbDb.collection('users').doc(uid).collection('sf-data');
    const calToken = localStorage.getItem('sf_cal_token');
    const ops = [base.doc('todos').delete(), base.doc('trips').delete()];
    if (calToken) ops.push(fbDb.collection('publicCalendars').doc(calToken).delete().catch(() => {}));
    await Promise.all(ops);
    Cache.todos = [];
    Cache.trips = [];
    localStorage.removeItem('sf_todos');
    localStorage.removeItem('sf_trips');
    localStorage.removeItem('sf_cal_token');
    localStorage.removeItem('sf_cal_worker');
  }
};

// ── Real-time Cross-Device Sync ──
const _realtimeUnsubs = [];

function startRealtimeSync(uid) {
  stopRealtimeSync();
  const base = fbDb.collection('users').doc(uid).collection('sf-data');

  _realtimeUnsubs.push(
    base.doc('todos').onSnapshot({ includeMetadataChanges: true }, snap => {
      if (!snap.exists || snap.metadata.fromCache || snap.metadata.hasPendingWrites) return;
      const list = snap.data().list ?? [];
      if (JSON.stringify(Cache.todos) === JSON.stringify(list)) return;
      Cache.todos = list;
      localStorage.setItem('sf_todos', JSON.stringify(list));
      _onRemoteSync();
    }),
    base.doc('trips').onSnapshot({ includeMetadataChanges: true }, snap => {
      if (!snap.exists || snap.metadata.fromCache || snap.metadata.hasPendingWrites) return;
      const list = snap.data().list ?? [];
      if (JSON.stringify(Cache.trips) === JSON.stringify(list)) return;
      Cache.trips = list;
      localStorage.setItem('sf_trips', JSON.stringify(list));
      _onRemoteSync();
    })
  );
}

function stopRealtimeSync() {
  _realtimeUnsubs.forEach(fn => fn());
  _realtimeUnsubs.length = 0;
}

function _onRemoteSync() {
  _showSyncToast('다른 기기에서 변경사항이 동기화됨');
  if      (currentPage === 'dashboard')  renderDashboard();
  else if (currentPage === 'todo')       renderTodos();
  else if (currentPage === 'calendar')   renderCalendar();
  else if (currentPage === 'trips')      renderTrips();
  else if (currentPage === 'documents')  renderDocuments();
}

function _showSyncToast(msg) {
  let toast = document.getElementById('sync-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sync-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg || '동기화됨';
  toast.className = 'sync-toast visible';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), 2500);
}

async function manualRefresh() {
  const user = (typeof fbAuth !== 'undefined') ? fbAuth.currentUser : null;
  if (!user) return;
  const btn = document.getElementById('btn-refresh');
  if (btn) btn.classList.add('spinning');
  try {
    await Store.loadFromCloud(user.uid);
    if (Cache.todos === null) Cache.todos = [];
    if (Cache.trips === null) Cache.trips = [];
    if      (currentPage === 'dashboard')  renderDashboard();
    else if (currentPage === 'todo')       renderTodos();
    else if (currentPage === 'calendar')   renderCalendar();
    else if (currentPage === 'trips')      renderTrips();
    else if (currentPage === 'documents')  renderDocuments();
    _showSyncToast('새로고침 완료');
  } catch (e) {
    _showSyncToast('동기화 실패');
  } finally {
    if (btn) setTimeout(() => btn.classList.remove('spinning'), 600);
  }
}

// ── UUID ──
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
}

// ── Date Helpers ──
function fmtDate(d)  { return d ? new Date(d).toLocaleDateString('ko-KR') : ''; }
function fmtYearMonth(ym) {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split('-');
  return `${y}년 ${String(Number(m)).padStart(2,'0')}월`;
}
function isoDate(d) {
  if (!d) return '';
  if (d instanceof Date) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return new Date(d).toISOString().split('T')[0];
}
function today() { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; }
function diffDays(dateStr) {
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const t = new Date();        t.setHours(0, 0, 0, 0);
  return Math.ceil((d - t) / 86400000);
}
function fmtTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 || 12;
  return `${ampm} ${h12}:${m.toString().padStart(2, '0')}`;
}
function fmtTimeAmPm(timeStr) {
  if (!timeStr) return '';
  const h = Number(timeStr.split(':')[0]);
  return h < 12 ? '오전' : '오후';
}

// ── Recurrence Helper ──
function todoMatchesRepeat(t, dateStr) {
  const baseDate = t.startDate || t.dueDate;
  if (!baseDate || !t.repeat || t.repeat === 'none') return false;
  if (dateStr < baseDate) return false;
  const base = new Date(baseDate + 'T00:00:00');
  const date = new Date(dateStr  + 'T00:00:00');
  const diffDays = Math.round((date - base) / 86400000);
  if (t.repeat === 'daily')   return true;
  if (t.repeat === 'weekly')  return diffDays % 7 === 0;
  if (t.repeat === 'monthly') return date.getDate() === base.getDate();
  return false;
}

// ── Escape HTML ──
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Theme ──
function initTheme() {
  const theme = Store.getTheme();
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
  const next = Store.getTheme() === 'dark' ? 'light' : 'dark';
  Store.saveTheme(next);
  initTheme();
}

// ── Router ──
let currentPage = 'dashboard';
const pageTitles = {
  dashboard: '대시보드', todo: 'TODO', calendar: '캘린더',
  trips: '출장', documents: '문서'
};

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p  => p.classList.remove('active'));
  document.querySelectorAll('[data-page]').forEach(n => n.classList.remove('active'));
  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');
  document.querySelectorAll(`[data-page="${page}"]`).forEach(n => n.classList.add('active'));
  document.getElementById('page-title').textContent = pageTitles[page] || '';
  if (page === 'dashboard') renderDashboard();
  else if (page === 'todo')      renderTodos();
  else if (page === 'calendar')  renderCalendar();
  else if (page === 'trips')     renderTrips();
  else if (page === 'documents') renderDocuments();
  document.getElementById('sidebar').classList.remove('open');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (backdrop) backdrop.classList.remove('visible');
}

// ── Modal ──
function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').style.display = 'flex';
}
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// ── Universal Add Modal ──
function showAddNewModal() {
  openModal(`
    <div class="modal-header">
      <h2>새 일정 추가</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="add-new-options">
      <button class="add-new-option" onclick="closeModal();showTodoForm()">
        <span class="add-new-icon">📋</span>
        <div>
          <div class="add-new-title">할 일 추가</div>
          <div class="add-new-desc">마감일, 우선순위, 태그를 설정하세요</div>
        </div>
        <span style="color:var(--text-muted);font-size:1.2rem">›</span>
      </button>
      <button class="add-new-option" onclick="closeModal();showTripForm()">
        <span class="add-new-icon">✈️</span>
        <div>
          <div class="add-new-title">출장 등록</div>
          <div class="add-new-desc">출장 일정과 목적지, 목적을 등록하세요</div>
        </div>
        <span style="color:var(--text-muted);font-size:1.2rem">›</span>
      </button>
    </div>
  `);
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  
  // 모바일 메뉴 토글
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  document.getElementById('menu-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('visible');
  });
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('visible');
    });
  }

  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });
  document.getElementById('btn-add-new').addEventListener('click', showAddNewModal);

  const btnGoHome = document.getElementById('btn-go-home');
  if (btnGoHome) btnGoHome.addEventListener('click', () => navigate('dashboard'));

  // Ctrl+K / Cmd+K → 검색
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape') { closeSearch(); }
  });

  initTodoFilters();
  initTripFilters();
  initNotifications();
  _syncNotifToggleUI();
  // Auth module handles initial navigation (no navigate() here)
  initAuth();
});

// ── Search ──
let _searchOpen = false;

function openSearch() {
  if (_searchOpen) return;
  _searchOpen = true;
  const overlay = document.createElement('div');
  overlay.id = 'search-overlay';
  overlay.className = 'search-overlay';
  overlay.innerHTML = `
    <div class="search-box" id="search-box">
      <div class="search-input-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="search-input" id="search-input" placeholder="할 일, 출장, 문서 검색..." autocomplete="off">
        <span class="search-kbd">ESC</span>
      </div>
      <div class="search-results" id="search-results"></div>
      <div class="search-footer">
        <span><kbd class="search-kbd">↑↓</kbd> 이동</span>
        <span><kbd class="search-kbd">Enter</kbd> 선택</span>
        <span><kbd class="search-kbd">ESC</kbd> 닫기</span>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSearch(); });
  document.body.appendChild(overlay);
  const input = document.getElementById('search-input');
  input.focus();
  input.addEventListener('input', () => renderSearchResults(input.value.trim()));
  input.addEventListener('keydown', onSearchKey);
  renderSearchResults('');
}

function closeSearch() {
  if (!_searchOpen) return;
  _searchOpen = false;
  const el = document.getElementById('search-overlay');
  if (el) el.remove();
}

function renderSearchResults(q) {
  const container = document.getElementById('search-results');
  if (!container) return;
  const lq = q.toLowerCase();

  const todos  = Store.getTodos().filter(t => !q || t.title.toLowerCase().includes(lq) || (t.tags||[]).some(g => g.toLowerCase().includes(lq)));
  const trips  = Store.getTrips().filter(t => !q || t.title.toLowerCase().includes(lq) || (t.destination||'').toLowerCase().includes(lq));
  const docs   = Store.getTrips().filter(t => (t.preReport || t.postReport) && (!q || t.title.toLowerCase().includes(lq)));

  if (!todos.length && !trips.length && !docs.length) {
    container.innerHTML = `<div class="search-empty">${q ? `"${esc(q)}" 검색 결과 없음` : '검색어를 입력하세요'}</div>`;
    return;
  }

  let html = '';
  if (todos.length) {
    html += `<div class="search-section-label">📋 할 일</div>`;
    html += todos.slice(0, 5).map(t => {
      const sub = t.dueDate ? fmtDate(t.dueDate) : (t.status === 'done' ? '완료' : '진행중');
      return `<div class="search-result-item" data-action="todo" data-id="${t.id}">
        <div class="search-result-icon">📋</div>
        <div class="search-result-text">
          <div class="search-result-title">${esc(t.title)}</div>
          <div class="search-result-sub">${sub}</div>
        </div>
        <span class="search-result-tag">${{todo:'미완료',  'in-progress':'진행중', done:'완료'}[t.status]||''}</span>
      </div>`;
    }).join('');
  }
  if (trips.length) {
    html += `<div class="search-section-label">✈️ 출장</div>`;
    html += trips.slice(0, 5).map(t => `
      <div class="search-result-item" data-action="trip" data-id="${t.id}">
        <div class="search-result-icon">✈️</div>
        <div class="search-result-text">
          <div class="search-result-title">${esc(t.title)}</div>
          <div class="search-result-sub">${esc(t.destination||'')} · ${fmtDate(t.startDate)}</div>
        </div>
        <span class="search-result-tag">${{planned:'계획됨','in-progress':'진행중',completed:'완료'}[t.status]||''}</span>
      </div>`).join('');
  }
  if (docs.length) {
    html += `<div class="search-section-label">📄 문서</div>`;
    html += docs.slice(0, 3).map(t => {
      const flags = [t.preReport ? '사전신청서' : null, t.postReport ? '보고서' : null].filter(Boolean).join(', ');
      return `<div class="search-result-item" data-action="doc" data-id="${t.id}">
        <div class="search-result-icon">📄</div>
        <div class="search-result-text">
          <div class="search-result-title">${esc(t.title)}</div>
          <div class="search-result-sub">${flags}</div>
        </div>
      </div>`;
    }).join('');
  }
  container.innerHTML = html;
  container.querySelectorAll('.search-result-item').forEach(el => {
    el.addEventListener('click', () => execSearchResult(el));
  });
}

function onSearchKey(e) {
  const items = document.querySelectorAll('#search-results .search-result-item');
  const focused = document.querySelector('#search-results .search-result-item.focused');
  let idx = focused ? [...items].indexOf(focused) : -1;
  if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, items.length - 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); }
  else if (e.key === 'Enter' && focused) { execSearchResult(focused); return; }
  else return;
  items.forEach(el => el.classList.remove('focused'));
  if (items[idx]) items[idx].classList.add('focused');
}

function execSearchResult(el) {
  const { action, id } = el.dataset;
  closeSearch();
  if (action === 'todo')  { navigate('todo');      setTimeout(() => showTodoDetail(id), 100); }
  if (action === 'trip')  { navigate('trips');     setTimeout(() => showTripDetail(id), 100); }
  if (action === 'doc')   { navigate('documents'); setTimeout(() => selectTripForDoc(id), 100); }
}

// ── Data Export / Import ──
function showDataModal() {
  const todos  = Store.getTodos();
  const trips  = Store.getTrips();
  const docs   = trips.filter(t => t.preReport || t.postReport);
  openModal(`
    <div class="modal-header">
      <h2>💾 데이터 관리</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="export-section">
      <h3>현재 데이터</h3>
      <div class="export-stats">
        <div class="export-stat"><div class="export-stat-num">${todos.length}</div><div class="export-stat-label">할 일</div></div>
        <div class="export-stat"><div class="export-stat-num">${trips.length}</div><div class="export-stat-label">출장</div></div>
        <div class="export-stat"><div class="export-stat-num">${docs.length}</div><div class="export-stat-label">문서</div></div>
      </div>
    </div>
    <div class="export-section">
      <h3>내보내기</h3>
      <button class="btn btn-outline" style="width:100%;margin-bottom:8px" onclick="exportData()">
        📥 JSON 파일로 내보내기
      </button>
    </div>
    <div class="export-section">
      <h3>가져오기</h3>
      <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:10px">이전에 내보낸 JSON 파일을 불러옵니다. 기존 데이터와 병합됩니다.</p>
      <label class="btn btn-outline" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer">
        📤 JSON 파일 가져오기
        <input type="file" accept=".json" style="display:none" onchange="importData(event)">
      </label>
    </div>
  `);
}

function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    todos: Store.getTodos(),
    trips: Store.getTrips(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `scheduleflow-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.todos && !data.trips) { alert('유효하지 않은 백업 파일입니다.'); return; }
      if (!confirm(`할 일 ${(data.todos||[]).length}건, 출장 ${(data.trips||[]).length}건을 가져옵니다. 기존 데이터와 병합됩니다. 계속하시겠습니까?`)) return;

      // 병합: 기존 ID와 중복되지 않는 항목만 추가
      const curTodos = Store.getTodos();
      const curTrips = Store.getTrips();
      const curTodoIds = new Set(curTodos.map(t => t.id));
      const curTripIds = new Set(curTrips.map(t => t.id));

      const newTodos = (data.todos||[]).filter(t => !curTodoIds.has(t.id));
      const newTrips = (data.trips||[]).filter(t => !curTripIds.has(t.id));

      Store.saveTodos([...curTodos, ...newTodos]);
      Store.saveTrips([...curTrips, ...newTrips]);

      closeModal();
      alert(`가져오기 완료: 할 일 ${newTodos.length}건, 출장 ${newTrips.length}건 추가됨`);
      renderDashboard();
    } catch { alert('파일을 읽을 수 없습니다.'); }
  };
  reader.readAsText(file);
}

// ════════════════════════════════════════════════
//  알림 / 리마인더 시스템
// ════════════════════════════════════════════════

const _notifShown = new Set(); // 세션 내 중복 방지: `${todoId}-${dateStr}`
let _notifTimer = null;

function initNotifications() {
  if (!('Notification' in window)) return;
  if (Store.getNotifEnabled()) _startNotifLoop();
}

function _startNotifLoop() {
  if (_notifTimer) return;
  checkUpcomingReminders();
  _notifTimer = setInterval(checkUpcomingReminders, 60_000);
}

function _stopNotifLoop() {
  clearInterval(_notifTimer);
  _notifTimer = null;
}

async function requestNotifPermission() {
  if (!('Notification' in window)) {
    alert('이 브라우저는 알림을 지원하지 않습니다.');
    return;
  }
  const perm = await Notification.requestPermission();
  const enabled = perm === 'granted';
  Store.saveNotifEnabled(enabled);
  _syncNotifToggleUI();
  if (enabled) {
    _startNotifLoop();
    alert('알림이 활성화되었습니다. 마감 30분 전에 알림을 보내드립니다.');
  } else {
    alert('알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
  }
}

function toggleNotifications() {
  if (!('Notification' in window)) return;
  if (!Store.getNotifEnabled()) {
    requestNotifPermission();
  } else {
    Store.saveNotifEnabled(false);
    _stopNotifLoop();
    _syncNotifToggleUI();
  }
}

function _syncNotifToggleUI() {
  const toggle = document.getElementById('notif-toggle');
  if (!toggle) return;
  const enabled = Store.getNotifEnabled();
  toggle.checked = enabled;
}

function checkUpcomingReminders() {
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  const todayStr = today();
  Store.getTodos()
    .filter(t => t.status !== 'done' && t.dueDate)
    .forEach(t => {
      const key = `${t.id}-${t.dueDate}`;
      if (_notifShown.has(key)) return;

      let shouldNotify = false;

      if (t.dueDate === todayStr && t.dueTime) {
        // 마감 시간 30분 전 알림
        const [h, m] = t.dueTime.split(':').map(Number);
        const dueMs = new Date(todayStr + 'T' + t.dueTime).getTime();
        const diffMin = (dueMs - now.getTime()) / 60_000;
        if (diffMin >= 0 && diffMin <= 30) shouldNotify = true;
      } else if (t.dueDate === todayStr && !t.dueTime) {
        // 오늘 마감, 시간 없음 → 09:00~09:01 사이에 한 번
        if (now.getHours() === 9 && now.getMinutes() === 0) shouldNotify = true;
      }

      if (shouldNotify) {
        _notifShown.add(key);
        const timeLabel = t.dueTime ? `${fmtTimeAmPm(t.dueTime)} 마감` : '오늘 마감';
        new Notification('ScheduleFlow 리마인더', {
          body: `${t.title} — ${timeLabel}`,
          icon: '/icon.svg',
          tag: key,
        });
      }
    });
}

// ── 캘린더 연동 (webcal / Cloudflare Worker) ──

function generateICS(trips, todos) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ScheduleFlow//KO',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:ScheduleFlow',
    'X-WR-CALDESC:ScheduleFlow 출장 및 할 일',
  ];

  (trips || []).forEach(trip => {
    if (!trip.startDate) return;
    const endDate = trip.endDate || trip.startDate;
    const endExcl = new Date(endDate + 'T00:00:00');
    endExcl.setDate(endExcl.getDate() + 1);
    const endStr = endExcl.toISOString().slice(0, 10).replace(/-/g, '');
    const desc = [
      trip.destination ? `목적지: ${trip.destination}` : '',
      trip.purpose     ? `목적: ${trip.purpose}`       : '',
      trip.project     ? `사업명: ${trip.project}`     : '',
    ].filter(Boolean).join('\\n');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:trip-${trip.id}@scheduleflow`);
    lines.push(`SUMMARY:✈️ ${trip.title}`);
    lines.push(`DTSTART;VALUE=DATE:${trip.startDate.replace(/-/g, '')}`);
    lines.push(`DTEND;VALUE=DATE:${endStr}`);
    if (trip.destination) lines.push(`LOCATION:${trip.destination}`);
    if (desc)             lines.push(`DESCRIPTION:${desc}`);
    lines.push('END:VEVENT');
  });

  (todos || []).filter(t => t.dueDate && t.status !== 'done').forEach(todo => {
    const endExcl = new Date(todo.dueDate + 'T00:00:00');
    endExcl.setDate(endExcl.getDate() + 1);
    const endStr = endExcl.toISOString().slice(0, 10).replace(/-/g, '');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:todo-${todo.id}@scheduleflow`);
    lines.push(`SUMMARY:📋 ${todo.title}`);
    lines.push(`DTSTART;VALUE=DATE:${todo.dueDate.replace(/-/g, '')}`);
    lines.push(`DTEND;VALUE=DATE:${endStr}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

let _calSyncTimer = null;
function scheduleCalSync() {
  if (!Store.getCalToken()) return;
  clearTimeout(_calSyncTimer);
  _calSyncTimer = setTimeout(_pushCalendar, 3000);
}

async function _pushCalendar() {
  const token = Store.getCalToken();
  if (!token) return;
  const user = (typeof fbAuth !== 'undefined') ? fbAuth.currentUser : null;
  if (!user) return;
  try {
    await fbDb.collection('publicCalendars').doc(token).set({
      content: generateICS(Store.getTrips(), Store.getTodos()),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch(e) {
    console.warn('[Cal sync failed]', e.message);
  }
}

async function enableCalSync() {
  const token = uuid();
  Store.saveCalToken(token);
  await _pushCalendar();
  renderCalSyncSection();
  _showSyncToast('캘린더 연동이 활성화되었습니다');
}

async function disableCalSync() {
  const token = Store.getCalToken();
  if (token) {
    try { await fbDb.collection('publicCalendars').doc(token).delete(); } catch(e) {}
  }
  Store.saveCalToken(null);
  renderCalSyncSection();
  _showSyncToast('캘린더 연동이 해제되었습니다');
}

function saveCalWorkerUrl() {
  const val = (document.getElementById('cal-worker-url-input')?.value || '').trim().replace(/\/$/, '');
  if (!val) return;
  Store.saveCalWorkerUrl(val);
  renderCalSyncSection();
}

function _editCalWorkerUrl() {
  Store.saveCalWorkerUrl('');
  renderCalSyncSection();
}

function copyCalUrl(url) {
  navigator.clipboard.writeText(url).then(() => _showSyncToast('URL이 복사되었습니다'));
}

function renderCalSyncSection() {
  const el = document.getElementById('cal-sync-section');
  if (!el) return;
  const token     = Store.getCalToken();
  const workerUrl = Store.getCalWorkerUrl();

  if (!workerUrl) {
    el.innerHTML = `
      <div style="font-size:0.88rem;font-weight:500;margin-bottom:8px">📅 캘린더 연동 (webcal)</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">
        Cloudflare Worker를 배포한 후 URL을 입력하세요.<br>
        설정 방법: <code>cloudflare-worker/</code> 폴더 참고
      </div>
      <input id="cal-worker-url-input" class="form-input" style="font-size:0.82rem;margin-bottom:8px"
        placeholder="https://scheduleflow-cal.username.workers.dev">
      <button class="btn btn-outline btn-sm" style="width:100%" onclick="saveCalWorkerUrl()">Worker URL 저장</button>`;
    return;
  }

  if (!token) {
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:0.88rem;font-weight:500">📅 캘린더 연동 (webcal)</div>
        <button class="btn btn-outline btn-sm" onclick="_editCalWorkerUrl()" style="font-size:0.72rem">URL 변경</button>
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">
        Worker: <span style="color:var(--text-primary)">${esc(workerUrl)}</span>
      </div>
      <button class="btn btn-primary btn-sm" style="width:100%" onclick="enableCalSync()">연동 시작</button>`;
    return;
  }

  const base = workerUrl.replace(/^https?:\/\//, '');
  const webcalUrl = `webcal://${base}/${token}.ics`;
  const httpsUrl  = `${workerUrl}/${token}.ics`;

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div style="font-size:0.88rem;font-weight:500">📅 캘린더 연동 ✅</div>
      <button class="btn btn-outline btn-sm" onclick="disableCalSync()" style="font-size:0.72rem;color:#e84040;border-color:#e84040">해제</button>
    </div>
    <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">구독 URL</div>
    <div class="cal-url-box" onclick="copyCalUrl('${webcalUrl}')" title="클릭하여 복사">${webcalUrl}</div>
    <div style="display:flex;gap:6px;margin-top:8px">
      <button class="btn btn-outline btn-sm" style="flex:1" onclick="copyCalUrl('${webcalUrl}')">📋 webcal:// 복사</button>
      <button class="btn btn-outline btn-sm" style="flex:1" onclick="copyCalUrl('${httpsUrl}')">🔗 https:// 복사</button>
    </div>
    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:8px;line-height:1.5">
      <b>iPhone 캘린더:</b> 설정 → 캘린더 → 계정 추가 → 기타 → 구독된 캘린더 추가 → webcal:// URL 붙여넣기<br>
      <b>Google 캘린더:</b> 다른 캘린더 + → URL로 추가 → https:// URL 붙여넣기
    </div>`;
}

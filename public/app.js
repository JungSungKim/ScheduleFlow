/* ================================================
   ScheduleFlow — Core App (Router, Theme, Storage)
   Write-Through Cache: Cache → localStorage → Firestore
   ================================================ */

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

  // ── Writes: Cache + localStorage + async Firestore ──
  saveTodos(list) {
    Cache.todos = list;
    localStorage.setItem('sf_todos', JSON.stringify(list));
    _scheduleSyncToCloud('todos', list);
  },
  saveTrips(list) {
    Cache.trips = list;
    localStorage.setItem('sf_trips', JSON.stringify(list));
    _scheduleSyncToCloud('trips', list);
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
    await Promise.all([
      base.doc('todos').delete(),
      base.doc('trips').delete()
    ]);
    Cache.todos = [];
    Cache.trips = [];
    localStorage.removeItem('sf_todos');
    localStorage.removeItem('sf_trips');
  }
};

// ── UUID ──
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
}

// ── Date Helpers ──
function fmtDate(d)  { return d ? new Date(d).toLocaleDateString('ko-KR') : ''; }
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
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  document.getElementById('btn-add-new').addEventListener('click', showAddNewModal);

  const btnGoHome = document.getElementById('btn-go-home');
  if (btnGoHome) btnGoHome.addEventListener('click', () => navigate('dashboard'));

  // Ctrl+K / Cmd+K → 검색
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape') { closeSearch(); closeModal(); }
  });

  initTodoFilters();
  initTripFilters();
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

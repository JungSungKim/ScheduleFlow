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
  return 'xxxx-xxxx-4xxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
}

// ── Date Helpers ──
function fmtDate(d)  { return d ? new Date(d).toLocaleDateString('ko-KR') : ''; }
function isoDate(d)  { return d ? new Date(d).toISOString().split('T')[0] : ''; }
function today()     { return isoDate(new Date()); }
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
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el  = document.getElementById(`page-${page}`);
  const nav = document.querySelector(`[data-page="${page}"]`);
  if (el)  el.classList.add('active');
  if (nav) nav.classList.add('active');
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

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  document.getElementById('btn-add-new').addEventListener('click', showAddNewModal);
  
  const btnGoHome = document.getElementById('btn-go-home');
  if (btnGoHome) btnGoHome.addEventListener('click', () => navigate('dashboard'));

  initTodoFilters();
  initTripFilters();
  // Auth module handles initial navigation (no navigate() here)
  initAuth();
});

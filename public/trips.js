/* ================================================
   ScheduleFlow — Trips Module
   ================================================ */

let tripFilter = 'all';
let tripSort = 'created';

function initTripFilters() {
  document.querySelectorAll('#page-trips .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#page-trips .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tripFilter = btn.dataset.filter;
      renderTrips();
    });
  });
  const sortSel = document.getElementById('trip-sort-select');
  if (sortSel) sortSel.addEventListener('change', () => { tripSort = sortSel.value; renderTrips(); });
}

function _renderTripCard(t) {
  const dd = diffDays(t.startDate);
  let ddText = '';
  if (t.status === 'completed') ddText = '완료';
  else if (dd === 0) ddText = 'D-Day';
  else if (dd > 0) ddText = `D-${dd}`;
  else ddText = `D+${Math.abs(dd)}`;
  const statusLabel = {planned:'계획됨','in-progress':'진행중',completed:'완료'}[t.status];
  const preIcon = t.preReport ? '✅' : '⬜';
  const postIcon = t.postReport ? '✅' : '⬜';
  return `
  <div class="trip-card" data-id="${t.id}" onclick="showTripDetail('${t.id}')">
    <div class="trip-card-header">
      <span class="trip-card-title">${esc(t.title)}</span>
      <div style="display:flex;align-items:center;gap:6px">
        ${t.project ? `<span class="project-badge">${esc(t.project)}</span>` : ''}
        <span class="trip-status-badge ${t.status}">${statusLabel}</span>
      </div>
    </div>
    <div class="trip-card-info">
      <span>📍 ${esc(t.destination)}</span>
      <span>📅 ${fmtDate(t.startDate)}${t.startTime ? ' ' + fmtTime(t.startTime) : ''} ~ ${fmtDate(t.endDate)}${t.endTime ? ' ' + fmtTime(t.endTime) : ''}</span>
      <span class="dday-badge ${dd===0?'today':''}">  ${ddText}</span>
    </div>
    <div class="trip-doc-status">
      <button class="doc-status-btn ${t.preReport ? 'done' : ''}" onclick="event.stopPropagation();openTripDoc('${t.id}','pre')" title="출장사전신청서">
        📝 신청서 ${preIcon}
      </button>
      <button class="doc-status-btn ${t.postReport ? 'done' : ''}" onclick="event.stopPropagation();openTripDoc('${t.id}','post')" title="외근출장보고서">
        📋 보고서 ${postIcon}
      </button>
    </div>
    <div class="trip-card-actions">
      <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();showTripForm('${t.id}')">✏️ 수정</button>
      <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();addTripTodo('${t.id}')">✚ 할 일 추가</button>
      <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();cycleTripStatus('${t.id}')">${t.status==='planned'?'▶ 진행':t.status==='in-progress'?'✓ 완료':'↩ 되돌리기'}</button>
      <button class="btn btn-sm btn-outline text-danger" onclick="event.stopPropagation();deleteTrip('${t.id}')">🗑️ 삭제</button>
    </div>
  </div>`;
}

function _renderByProject(trips) {
  const withProject = trips.filter(t => t.project && t.project.trim());
  const noProject   = trips.filter(t => !t.project || !t.project.trim());
  let html = '';
  if (withProject.length) {
    html += `<div class="project-group-header"><span>🏷️ 사업 출장</span><span class="month-group-count">${withProject.length}건</span></div>`;
    html += withProject.map(_renderTripCard).join('');
  }
  if (noProject.length) {
    html += `<div class="project-group-header"><span>📋 일반 출장</span><span class="month-group-count">${noProject.length}건</span></div>`;
    html += noProject.map(_renderTripCard).join('');
  }
  return html || '';
}

function openTripDoc(tripId, type) {
  navigate('documents');
  setTimeout(() => {
    selectTripForDoc(tripId);
    setTimeout(() => {
      if (type === 'pre') showPreReport(tripId);
      else showPostReport(tripId);
    }, 50);
  }, 100);
}

function _renderCompletedTripsByMonth(completedTrips) {
  const prevYM = (() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();

  const groups = {};
  completedTrips.forEach(t => {
    const key = (t.endDate || t.startDate || t.createdAt || '').slice(0, 7) || 'nodate';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  return Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map(key => {
      const items = groups[key];
      const label = key === 'nodate' ? '날짜 없음' : fmtYearMonth(key);
      const isOpen = key >= prevYM;
      return `
      <details class="month-group" ${isOpen ? 'open' : ''}>
        <summary class="month-group-header">
          <span class="month-group-chevron">▶</span>
          <span class="month-group-title">${label} 완료</span>
          <span class="month-group-count">${items.length}건</span>
        </summary>
        <div class="month-group-body">${items.map(_renderTripCard).join('')}</div>
      </details>`;
    }).join('');
}

function renderTrips() {
  const trips = Store.getTrips();
  const list = document.getElementById('trips-list');
  const byProject = tripSort === 'project';

  if (tripFilter === 'completed') {
    const completed = trips.filter(t => t.status === 'completed');
    list.innerHTML = completed.length
      ? (byProject ? _renderByProject(completed) : _renderCompletedTripsByMonth(completed))
      : '<p class="empty-state">완료된 출장이 없습니다 ✈️</p>';
    return;
  }

  if (tripFilter !== 'all') {
    const filtered = trips.filter(t => t.status === tripFilter);
    list.innerHTML = filtered.length
      ? (byProject ? _renderByProject(filtered) : filtered.map(_renderTripCard).join(''))
      : '<p class="empty-state">등록된 출장이 없습니다 ✈️</p>';
    return;
  }

  // '전체': 진행중/계획됨 먼저, 완료는 뒤
  const active    = trips.filter(t => t.status !== 'completed');
  const completed = trips.filter(t => t.status === 'completed');

  let html = byProject ? _renderByProject(active) : active.map(_renderTripCard).join('');

  if (completed.length) {
    if (html) html += '<div class="done-section-divider"><span>완료된 출장</span></div>';
    html += byProject ? _renderByProject(completed) : _renderCompletedTripsByMonth(completed);
  }

  list.innerHTML = html || '<p class="empty-state">등록된 출장이 없습니다 ✈️</p>';
}

function cycleTripStatus(id) {
  const trips = Store.getTrips();
  const t = trips.find(x => x.id === id);
  if (!t) return;
  const cycle = { planned:'in-progress','in-progress':'completed', completed:'planned' };
  t.status = cycle[t.status] || 'planned';
  Store.saveTrips(trips);
  renderTrips();
  if (document.getElementById('modal-overlay').style.display === 'flex') {
    showTripDetail(id); // 상세 패널 열려 있으면 새로고침
  }
}

function deleteTrip(id) {
  // 연결된 할 일 확인
  const linkedTodos = Store.getTodos().filter(t => t.tripId === id);
  const confirmMsg = linkedTodos.length > 0
    ? `연결된 할 일 ${linkedTodos.length}건의 출장 연결이 해제됩니다. 출장을 삭제하시겠습니까?`
    : '출장 및 관련 문서를 삭제하시겠습니까?';
  if (!confirm(confirmMsg)) return;
  // 연결 해제
  if (linkedTodos.length > 0) {
    const todos = Store.getTodos().map(t => t.tripId === id ? { ...t, tripId: null } : t);
    Store.saveTodos(todos);
  }
  Store.saveTrips(Store.getTrips().filter(t => t.id !== id));
  closeModal();
  renderTrips();
  if (typeof renderTodos    === 'function') renderTodos();
  if (typeof renderDashboard === 'function') renderDashboard();
}

function showTripForm(editId, prefillDate) {
  const existing = editId ? Store.getTrips().find(t => t.id === editId) : null;
  openModal(`
    <div class="modal-header">
      <h2>${existing ? '출장 수정' : '새 출장 등록'}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <form id="trip-form">
      <div class="form-group">
        <label class="form-label">출장 제목 *</label>
        <input class="form-input" id="trp-title" value="${esc(existing?.title||'')}" required>
      </div>
      <div class="form-group">
        <label class="form-label">방문처 (목적지) *</label>
        <input class="form-input" id="trp-dest" value="${esc(existing?.destination||'')}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">시작 일시 *</label>
          <div style="display:flex;gap:4px">
            <input class="form-input" type="date" id="trp-start" value="${existing?.startDate||prefillDate||''}" required style="flex:1.5">
            <input class="form-input" type="time" id="trp-start-time" value="${existing?.startTime||''}" style="flex:1">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">종료 일시 *</label>
          <div style="display:flex;gap:4px">
            <input class="form-input" type="date" id="trp-end" value="${existing?.endDate||prefillDate||''}" required style="flex:1.5">
            <input class="form-input" type="time" id="trp-end-time" value="${existing?.endTime||''}" style="flex:1">
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">사업명(계약명)</label>
        <input class="form-input" id="trp-project" value="${esc(existing?.project||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">목적</label>
        <textarea class="form-textarea" id="trp-purpose" rows="2">${esc(existing?.purpose||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">교통수단</label>
          <input class="form-input" id="trp-transport" value="${esc(existing?.transport||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">동행자</label>
          <input class="form-input" id="trp-companions" value="${esc(existing?.companions||'')}">
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">취소</button>
        <button type="submit" class="btn btn-primary">${existing ? '수정' : '등록'}</button>
      </div>
    </form>
  `);
  document.getElementById('trip-form').addEventListener('submit', e => {
    e.preventDefault();
    const trips = Store.getTrips();
    const isNew = !existing;
    const data = {
      title: document.getElementById('trp-title').value.trim(),
      destination: document.getElementById('trp-dest').value.trim(),
      startDate: document.getElementById('trp-start').value,
      startTime: document.getElementById('trp-start-time').value || null,
      endDate: document.getElementById('trp-end').value,
      endTime: document.getElementById('trp-end-time').value || null,
      project: document.getElementById('trp-project').value.trim(),
      purpose: document.getElementById('trp-purpose').value.trim(),
      transport: document.getElementById('trp-transport').value.trim(),
      companions: document.getElementById('trp-companions').value.trim(),
    };
    if (!data.title || !data.destination) return;
    let savedId = editId;
    if (existing) {
      const idx = trips.findIndex(x => x.id === editId);
      if (idx >= 0) trips[idx] = { ...trips[idx], ...data };
    } else {
      const newTrip = { id: uuid(), ...data, status:'planned', preReport:null, postReport:null, createdAt: new Date().toISOString() };
      trips.push(newTrip);
      savedId = newTrip.id;
    }
    Store.saveTrips(trips);
    renderTrips();
    if (typeof renderDashboard === 'function') renderDashboard();

    // 저장 후 확인 + 할 일 추가 옵션
    if (isNew) {
      const _sid = savedId;
      openModal(`
        <div class="modal-header">
          <h2>✅ 출장이 등록되었습니다</h2>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <p style="color:var(--text-secondary);margin-bottom:20px">${esc(data.title)} 출장이 저장되었습니다.</p>
        <div class="detail-action-bar">
          <button class="btn btn-outline" onclick="closeModal()">닫기</button>
          <button class="btn btn-primary" onclick="addTripTodo('${_sid}')">✚ 관련 할 일 추가하기</button>
        </div>
      `);
    } else {
      closeModal();
    }
  });
}

// ── 출장 상세 패널 ──
function showTripDetail(id) {
  const t = Store.getTrips().find(x => x.id === id);
  if (!t) return;

  const statusLabel = { planned:'계획됨','in-progress':'진행중', completed:'완료' }[t.status] || '';
  const dd = diffDays(t.startDate);
  const ddText = t.status === 'completed' ? '완료' : dd === 0 ? 'D-Day' : dd > 0 ? `D-${dd}` : `D+${Math.abs(dd)}`;

  // 연결된 할 일
  const linkedTodos = Store.getTodos().filter(x => x.tripId === id);
  const todoListHtml = linkedTodos.length
    ? linkedTodos.map(x => {
        const chkCls = x.status === 'done' ? 'done' : x.status === 'in-progress' ? 'in-progress' : '';
        const chkIcon = x.status === 'done' ? '✓' : x.status === 'in-progress' ? '◐' : '';
        return `<div class="detail-todo-item">
          <div class="mini-checkbox ${chkCls}" onclick="cycleTodoStatus('${x.id}');showTripDetail('${id}')">${chkIcon}</div>
          <span style="flex:1;color:var(--text-primary)">${esc(x.title)}</span>
          <span class="todo-priority ${x.priority}" style="font-size:0.72rem">${{high:'높음',mid:'보통',low:'낮음'}[x.priority]||''}</span>
        </div>`;
      }).join('')
    : '<p style="color:var(--text-muted);font-size:0.85rem">연결된 할 일이 없습니다.</p>';

  const statusNextLabel = t.status === 'planned' ? '▶ 진행 시작' : t.status === 'in-progress' ? '✓ 완료 처리' : '↩ 되돌리기';

  openModal(`
    <div class="modal-header">
      <h2>✈️ ${esc(t.title)}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="detail-panel">
      <div class="detail-section">
        <dl class="detail-info-grid">
          <dt>📍 목적지</dt><dd>${esc(t.destination)}</dd>
          <dt>📅 일정</dt><dd>${fmtDate(t.startDate)}${t.startTime?' '+fmtTime(t.startTime):''} ~ ${fmtDate(t.endDate)}${t.endTime?' '+fmtTime(t.endTime):''}</dd>
          <dt>📌 상태</dt><dd><span class="trip-status-badge ${t.status}">${statusLabel}</span> <span style="color:var(--text-muted);font-size:0.82rem">${ddText}</span></dd>
          ${t.project ? `<dt>🏷️ 사업명</dt><dd>${esc(t.project)}</dd>` : ''}
          ${t.purpose ? `<dt>🎯 목적</dt><dd>${esc(t.purpose)}</dd>` : ''}
          ${t.transport ? `<dt>🚌 교통</dt><dd>${esc(t.transport)}</dd>` : ''}
          ${t.companions ? `<dt>👥 동행</dt><dd>${esc(t.companions)}</dd>` : ''}
        </dl>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">📋 연결된 할 일 (${linkedTodos.length}건)</div>
        ${todoListHtml}
      </div>
      <div class="detail-section">
        <div class="detail-section-title">📄 문서 상태</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="doc-status-btn ${t.preReport ? 'done' : ''}" style="flex:1" onclick="closeModal();openTripDoc('${id}','pre')">
            📝 신청서 ${t.preReport ? '✅ 작성됨' : '⬜ 미작성'}
          </button>
          <button class="doc-status-btn ${t.postReport ? 'done' : ''}" style="flex:1" onclick="closeModal();openTripDoc('${id}','post')">
            📋 보고서 ${t.postReport ? '✅ 작성됨' : '⬜ 미작성'}
          </button>
        </div>
      </div>
      <div class="detail-action-bar">
        <button class="btn btn-outline" onclick="cycleTripStatus('${id}')">  ${statusNextLabel}</button>
        <button class="btn btn-outline" onclick="addTripTodo('${id}')">✚ 할 일 추가</button>
        <button class="btn btn-primary" onclick="closeModal();showTripForm('${id}')">✏️ 수정하기</button>
      </div>
    </div>
  `);
}

// ── 출장에서 할 일 추가 ──
function addTripTodo(tripId) {
  const t = Store.getTrips().find(x => x.id === tripId);
  if (!t) return;
  showTodoForm(null, tripId);
}

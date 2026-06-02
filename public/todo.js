/* ================================================
   ScheduleFlow — TODO Module
   UX-1: Tag System + Repeat field UI
   UX-4: Drag & Drop
   ================================================ */

let todoFilter = 'all';
let todoSort = 'created';
let todoTagFilter = null;
let todoTripFilter = null;   // Phase 3: 출장별 필터
let dragSrcId = null;

// ── Tag Color Palette ──
const TAG_PALETTE = [
  { bg: 'var(--color-primary-light)',   text: 'var(--color-primary)' },
  { bg: 'var(--color-secondary-light)', text: 'var(--color-secondary)' },
  { bg: 'var(--color-warning-light)',   text: 'var(--color-warning)' },
  { bg: 'var(--color-danger-light)',    text: 'var(--color-danger)' },
  { bg: '#EDE0F5', text: '#8A55B8' },
  { bg: '#DCF0F8', text: '#3A8EB8' },
];

function tagColor(tag) {
  let hash = 0;
  for (const c of tag) hash = (hash * 31 + c.charCodeAt(0)) & 0xFFFF;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

function parseTags(str) {
  return (str || '').split(',').map(t => t.trim()).filter(Boolean);
}

// ── Tag Filters ──
function renderTagFilters() {
  const todos = Store.getTodos();
  const allTags = [...new Set(todos.flatMap(t => t.tags || []))].filter(Boolean);
  const container = document.getElementById('todo-tag-filters');
  if (!allTags.length) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  container.innerHTML = `
    <span class="tag-filter-label">🏷️ 태그</span>
    <button class="tag-filter-btn ${!todoTagFilter ? 'active' : ''}" onclick="setTagFilter(null)">전체</button>
    ${allTags.map(tag => {
      const isActive = todoTagFilter === tag;
      return `<button class="tag-filter-btn ${isActive ? 'active' : ''}"
                       onclick="setTagFilter(${JSON.stringify(tag)})">${esc(tag)}</button>`;
    }).join('')}
  `;
}

function setTagFilter(tag) {
  todoTagFilter = tag;
  renderTagFilters();
  renderTodos();
}

// ── Trip Filter (출장별 필터) ──
function renderTripFilter() {
  const container = document.getElementById('todo-trip-filter');
  if (!container) return;

  // tripId가 있는 todos만 추려서 연결된 출장 목록기
  const linkedTripIds = [...new Set(Store.getTodos().map(t => t.tripId).filter(Boolean))];
  const trips = Store.getTrips().filter(t => linkedTripIds.includes(t.id));

  if (!trips.length) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  container.innerHTML = `
    <span class="tag-filter-label">✈️ 출장</span>
    <button class="tag-filter-btn ${!todoTripFilter ? 'active' : ''}" onclick="setTripFilter(null)">전체</button>
    ${trips.map(t => {
      const isActive = todoTripFilter === t.id;
      return `<button class="tag-filter-btn ${isActive ? 'active' : ''}" onclick="setTripFilter(${JSON.stringify(t.id)})">${esc(t.title)}</button>`;
    }).join('')}
  `;
}

function setTripFilter(tripId) {
  todoTripFilter = tripId;
  renderTripFilter();
  renderTodos();
}

// ── Filter & Sort Init ──
function initTodoFilters() {
  document.querySelectorAll('#page-todo .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#page-todo .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      todoFilter = btn.dataset.filter;
      renderTodos();
    });
  });
  document.getElementById('todo-sort-select').addEventListener('change', e => {
    todoSort = e.target.value;
    renderTodos();
  });
}

// ── Render ──
function renderTodos() {
  let todos = Store.getTodos();

  // filter by status
  if (todoFilter !== 'all') todos = todos.filter(t => t.status === todoFilter);
  // filter by tag
  if (todoTagFilter) todos = todos.filter(t => (t.tags || []).includes(todoTagFilter));
  // filter by trip
  if (todoTripFilter) todos = todos.filter(t => t.tripId === todoTripFilter);

  // sort
  if (todoSort === 'due') {
    todos.sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9'));
  } else if (todoSort === 'priority') {
    const w = { high: 0, mid: 1, low: 2 };
    todos.sort((a, b) => (w[a.priority] ?? 1) - (w[b.priority] ?? 1));
  } else {
    if (todos.some(t => t.sortOrder !== undefined)) {
      todos.sort((a, b) => (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999));
    } else {
      todos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  }

  const list = document.getElementById('todo-list');
  if (!todos.length) {
    list.innerHTML = '<p class="empty-state">할 일을 추가해 보세요! ✏️</p>';
    updateTodoBadge();
    renderTagFilters();
    return;
  }

  list.innerHTML = todos.map(t => {
    const tagBadges = (t.tags || []).map(tag => {
      const col = tagColor(tag);
      return `<span class="tag-badge" style="background:${col.bg};color:${col.text}">${esc(tag)}</span>`;
    }).join('');
    const repeatIcon = t.repeat && t.repeat !== 'none' ? ' <span title="반복 일정">🔁</span>' : '';

    // 연결된 출장 배지
    let tripBadge = '';
    if (t.tripId) {
      const linkedTrip = Store.getTrips().find(x => x.id === t.tripId);
      if (linkedTrip) {
        tripBadge = `<span class="trip-link-badge" onclick="event.stopPropagation();showTripDetail('${linkedTrip.id}')" title="연결된 출장 보기">✈️ ${esc(linkedTrip.title)}</span>`;
      }
    }

    return `
    <div class="todo-item ${t.status === 'done' ? 'done' : ''}" data-id="${t.id}"
         draggable="true"
         ondragstart="onTodoDragStart(event,'${t.id}')"
         ondragover="onTodoDragOver(event)"
         ondrop="onTodoDrop(event,'${t.id}')"
         ondragend="onTodoDragEnd(event)"
         onclick="showTodoDetail('${t.id}')">
      <div class="todo-drag-handle" title="드래그하여 순서 변경" onclick="event.stopPropagation()">⠿</div>
      <div class="todo-checkbox ${t.status === 'done' ? 'checked' : ''}"
           onclick="event.stopPropagation();cycleTodoStatus('${t.id}')">${t.status === 'done' ? '✓' : t.status === 'in-progress' ? '◐' : ''}</div>
      <div class="todo-info">
        <div class="todo-title">${t.type === 'personal' ? '👤 ' : t.type === 'trip' ? '✈️ ' : ''}${esc(t.title)}${repeatIcon}</div>
        <div class="todo-meta">
          ${t.startDate && t.startDate !== t.dueDate ? `<span>📅 ${fmtDate(t.startDate)} ~ ${fmtDate(t.dueDate)}</span>` : t.dueDate ? `<span>📅 ${fmtDate(t.dueDate)}${t.dueTime ? ' ' + fmtTime(t.dueTime) : ''}</span>` : ''}
          <span class="todo-priority ${t.priority}">${{ high: '높음', mid: '보통', low: '낮음' }[t.priority] || '보통'}</span>
          ${tagBadges}
          ${tripBadge}
        </div>
      </div>
      <div class="todo-actions">
        <button class="btn-icon" onclick="event.stopPropagation();showTodoForm('${t.id}')" title="수정">✏️</button>
        <button class="btn-icon" onclick="event.stopPropagation();deleteTodo('${t.id}')" title="삭제">🗑️</button>
      </div>
    </div>
    `;
  }).join('');
  updateTodoBadge();
  renderTagFilters();
  renderTripFilter();
}

function updateTodoBadge() {
  const count = Store.getTodos().filter(t => t.status !== 'done').length;
  ['todo-badge', 'todo-badge-panel'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = count;
    el.style.display = count > 0 ? 'inline' : 'none';
  });
}

// ── Status Cycle ──
function cycleTodoStatus(id) {
  const todos = Store.getTodos();
  const t = todos.find(x => x.id === id);
  if (!t) return;
  const cycle = { todo: 'in-progress', 'in-progress': 'done', done: 'todo' };
  t.status = cycle[t.status] || 'todo';
  Store.saveTodos(todos);
  renderTodos();
}

// ── Delete ──
function deleteTodo(id) {
  if (!confirm('삭제하시겠습니까?')) return;
  Store.saveTodos(Store.getTodos().filter(t => t.id !== id));
  renderTodos();
}

// ── Todo Detail Panel ──
function showTodoDetail(id) {
  const t = Store.getTodos().find(x => x.id === id);
  if (!t) return;

  const statusLabel = { todo: '미완료', 'in-progress': '진행중', done: '완료' }[t.status] || '';
  const statusColor = { todo: 'var(--color-primary)', 'in-progress': 'var(--color-warning)', done: 'var(--color-secondary)' }[t.status];
  const tagBadges = (t.tags || []).map(tag => {
    const col = tagColor(tag);
    return `<span class="tag-badge" style="background:${col.bg};color:${col.text}">${esc(tag)}</span>`;
  }).join(' ');

  let linkedTripHtml = '';
  if (t.tripId) {
    const trip = Store.getTrips().find(x => x.id === t.tripId);
    if (trip) {
      linkedTripHtml = `<dt>✈️ 출장</dt><dd><span class="trip-link-badge" onclick="showTripDetail('${trip.id}')">${esc(trip.title)}</span></dd>`;
    }
  }

  const nextStatusLabel = t.status === 'todo' ? '◐ 진행중으로' : t.status === 'in-progress' ? '✓ 완료 처리' : '↺ 되돌리기';

  openModal(`
    <div class="modal-header">
      <h2>📋 ${esc(t.title)}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="detail-panel">
      <div class="detail-section">
        <dl class="detail-info-grid">
          <dt>📌 상태</dt><dd><span style="color:${statusColor};font-weight:600">${statusLabel}</span></dd>
          ${t.startDate && t.startDate !== t.dueDate
            ? `<dt>📅 일정</dt><dd>${fmtDate(t.startDate)} ~ ${fmtDate(t.dueDate)}</dd>`
            : t.dueDate
              ? `<dt>📅 마감일</dt><dd>${fmtDate(t.dueDate)}${t.dueTime ? ' ' + fmtTime(t.dueTime) : ''}</dd>`
              : ''}
          <dt>⚡ 우선</dt><dd><span class="todo-priority ${t.priority}">${{high:'높음',mid:'보통',low:'낮음'}[t.priority]||'보통'}</span></dd>
          <dt>🏷️ 구분</dt><dd>${
            t.type === 'personal' ? '개인 일정 👤'
            : t.type === 'trip'   ? '출장 ✈️'
            : '업무 일정'
          }</dd>
          ${linkedTripHtml}
          ${t.description ? `<dt>📝 메모</dt><dd style="white-space:pre-line">${esc(t.description)}</dd>` : ''}
        </dl>
        ${tagBadges ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">${tagBadges}</div>` : ''}
      </div>
      <div class="detail-action-bar">
        <button class="btn btn-outline" onclick="cycleTodoStatus('${id}');showTodoDetail('${id}')">${nextStatusLabel}</button>
        <button class="btn btn-primary" onclick="closeModal();showTodoForm('${id}')">✏️ 수정하기</button>
        <button class="btn btn-outline text-danger" onclick="deleteTodo('${id}')">🗑️ 삭제</button>
      </div>
    </div>
  `);
}

// ── Form ──
function showTodoForm(editId, prefillTripId) {
  const existing = editId ? Store.getTodos().find(t => t.id === editId) : null;
  const existingTags = (existing?.tags || []).join(', ');

  // 출장 링크 드롭다운 데이터
  const activeTrips = Store.getTrips().filter(x => x.status !== 'completed');
  const currentTripId = existing?.tripId || prefillTripId || '';
  const tripOptions = activeTrips.map(x =>
    `<option value="${x.id}" ${currentTripId === x.id ? 'selected' : ''}>${esc(x.title)} (${fmtDate(x.startDate)})</option>`
  ).join('');

  openModal(`
    <div class="modal-header">
      <h2>${existing ? '할 일 수정' : '새 할 일'}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <form id="todo-form">
      <div class="form-group">
        <label class="form-label">제목 *</label>
        <input class="form-input" id="tf-title" value="${esc(existing?.title || '')}" required>
      </div>
      <div class="form-group">
        <label class="form-label">설명</label>
        <textarea class="form-textarea" id="tf-desc" rows="3">${esc(existing?.description || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">일정 구분</label>
          <select class="form-select" id="tf-type" onchange="_onTodoTypeChange()">
            <option value="work"     ${!existing || existing?.type === 'work'     ? 'selected' : ''}>업무 일정</option>
            <option value="personal" ${existing?.type === 'personal' ? 'selected' : ''}>개인 일정 👤</option>
            <option value="trip"     ${existing?.type === 'trip'     ? 'selected' : ''}>출장 ✈️</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">우선순위</label>
          <select class="form-select" id="tf-priority">
            <option value="low"  ${existing?.priority === 'low'  ? 'selected' : ''}>낮음</option>
            <option value="mid"  ${!existing || existing?.priority === 'mid' ? 'selected' : ''}>보통</option>
            <option value="high" ${existing?.priority === 'high' ? 'selected' : ''}>높음</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">시작 일시</label>
          <div style="display:flex;gap:4px">
            <input class="form-input" type="date" id="tf-start" value="${existing?.startDate || ''}" style="flex:1.5">
            <input class="form-input" type="time" id="tf-start-time" value="${existing?.startTime || ''}" style="flex:1">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">마감(종료) 일시</label>
          <div style="display:flex; gap:4px">
            <input class="form-input" type="date" id="tf-due" value="${existing?.dueDate || ''}" style="flex:1.5">
            <input class="form-input" type="time" id="tf-due-time" value="${existing?.dueTime || ''}" style="flex:1">
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">태그 <span style="color:var(--text-muted);font-weight:400">(콤마로 구분)</span></label>
          <input class="form-input" id="tf-tags" placeholder="예: 업무, 긴급, 회의" value="${esc(existingTags)}">
        </div>
        <div class="form-group">
          <label class="form-label">반복</label>
          <select class="form-select" id="tf-repeat">
            <option value="none"    ${(!existing?.repeat || existing?.repeat === 'none')   ? 'selected' : ''}>없음</option>
            <option value="daily"   ${existing?.repeat === 'daily'   ? 'selected' : ''}>매일</option>
            <option value="weekly"  ${existing?.repeat === 'weekly'  ? 'selected' : ''}>매주</option>
            <option value="monthly" ${existing?.repeat === 'monthly' ? 'selected' : ''}>매월</option>
          </select>
        </div>
      </div>

      <div id="tf-trip-inline-section" style="display:${!existing && false || existing?.type==='trip' ? 'block':'none'};border-top:1px solid var(--border-color);padding-top:14px;margin-top:4px;">
        <div style="font-size:0.82rem;font-weight:600;color:var(--color-secondary);margin-bottom:12px">✈️ 출장 정보 (TODO 저장 시 자동 등록)</div>
        <div class="form-group">
          <label class="form-label">방문처 (목적지) *</label>
          <input class="form-input" id="tf-trip-dest" placeholder="예: 서울 코엑스, 대전 모아소프트" value="${existing?.type==='trip'&&existing?.tripId ? (Store.getTrips().find(x=>x.id===existing.tripId)?.destination||'') : ''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">사업명</label>
            <input class="form-input" id="tf-trip-project" placeholder="예: [현안유지] TMS 과제" value="${existing?.type==='trip'&&existing?.tripId ? (Store.getTrips().find(x=>x.id===existing.tripId)?.project||'') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">교통수단</label>
            <input class="form-input" id="tf-trip-transport" placeholder="예: KTX, 자차, 미니버스" value="${existing?.type==='trip'&&existing?.tripId ? (Store.getTrips().find(x=>x.id===existing.tripId)?.transport||'') : ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">동행자</label>
          <input class="form-input" id="tf-trip-companions" placeholder="예: 홈길동, 홍길동" value="${existing?.type==='trip'&&existing?.tripId ? (Store.getTrips().find(x=>x.id===existing.tripId)?.companions||'') : ''}">
        </div>
      </div>
      <div id="tf-link-section" style="display:${existing?.type==='trip' ? 'none':'block'}">
        <div class="form-group">
          <label class="form-label">✈️ 출장 연결 <span style="color:var(--text-muted);font-weight:400">(선택)</span></label>
          <select class="form-select" id="tf-trip-id">
            <option value="">-- 연결 안 함 --</option>
            ${tripOptions}
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">취소</button>
        <button type="submit" class="btn btn-primary" id="tf-submit-btn">${existing ? '수정' : '추가'}</button>
      </div>
    </form>
  `);

  // 유형 변경 시 인라인 스위치
  window._onTodoTypeChange = function() {
    const v = document.getElementById('tf-type').value;
    const sec = document.getElementById('tf-trip-inline-section');
    const lnk = document.getElementById('tf-link-section');
    const btn = document.getElementById('tf-submit-btn');
    const isNew = !existing;
    if (v === 'trip') {
      sec.style.display = 'block';
      lnk.style.display = 'none';
      if (isNew) btn.textContent = '할일 + 출장 동시 등록 ✈️';
    } else {
      sec.style.display = 'none';
      lnk.style.display = 'block';
      if (isNew) btn.textContent = '추가';
    }
  };
  // 초기 유형이 trip으로 프리필된될 때 버튼 텍스트 설정
  if (!existing) window._onTodoTypeChange();

  document.getElementById('todo-form').addEventListener('submit', e => {
    e.preventDefault();
    const todos = Store.getTodos();
    const typeVal = document.getElementById('tf-type').value;
    const tripIdInput = document.getElementById('tf-trip-id');
    const tripIdVal = (typeVal !== 'trip' && tripIdInput) ? (tripIdInput.value || null) : null;

    const data = {
      title:       document.getElementById('tf-title').value.trim(),
      description: document.getElementById('tf-desc').value.trim(),
      type:        typeVal,
      startDate:   document.getElementById('tf-start').value || document.getElementById('tf-due').value || null,
      startTime:   document.getElementById('tf-start-time').value || null,
      dueDate:     document.getElementById('tf-due').value || document.getElementById('tf-start').value || null,
      dueTime:     document.getElementById('tf-due-time').value || null,
      priority:    document.getElementById('tf-priority').value,
      tags:        parseTags(document.getElementById('tf-tags').value),
      repeat:      document.getElementById('tf-repeat').value,
      tripId:      tripIdVal,
    };
    if (!data.title) return;

    // ── 출장 유형: 신규 등록 시 출장도 자동 생성 ──
    if (typeVal === 'trip' && !existing) {
      const dest = document.getElementById('tf-trip-dest')?.value.trim();
      if (!dest) {
        document.getElementById('tf-trip-dest').focus();
        document.getElementById('tf-trip-dest').style.borderColor = 'var(--color-danger)';
        return;
      }
      const newTrip = {
        id:          uuid(),
        title:       data.title,
        destination: dest,
        startDate:   data.startDate || data.dueDate,
        startTime:   data.startTime || null,
        endDate:     data.dueDate || data.startDate,
        endTime:     data.dueTime || null,
        project:     document.getElementById('tf-trip-project')?.value.trim() || '',
        purpose:     '',
        transport:   document.getElementById('tf-trip-transport')?.value.trim() || '',
        companions:  document.getElementById('tf-trip-companions')?.value.trim() || '',
        status:      'planned',
        preReport:   null,
        postReport:  null,
        createdAt:   new Date().toISOString(),
      };
      const trips = Store.getTrips();
      trips.push(newTrip);
      Store.saveTrips(trips);
      data.tripId = newTrip.id;   // 자동 연결
    }

    if (existing) {
      const idx = todos.findIndex(x => x.id === editId);
      if (idx >= 0) todos[idx] = { ...todos[idx], ...data };
    } else {
      todos.push({ id: uuid(), ...data, status: 'todo', createdAt: new Date().toISOString() });
    }
    Store.saveTodos(todos);
    closeModal();
    renderTodos();
    if (typeof renderTrips === 'function') renderTrips();
    if (typeof renderDashboard === 'function') renderDashboard();
  });
}

// ── Drag & Drop (UX-4) ──
function onTodoDragStart(e, id) {
  dragSrcId = id;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => {
    const el = document.querySelector(`.todo-item[data-id="${id}"]`);
    if (el) el.classList.add('dragging');
  }, 0);
}

function onTodoDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const item = e.currentTarget;
  document.querySelectorAll('.todo-item').forEach(el => el.classList.remove('drag-over'));
  if (item.dataset.id !== dragSrcId) item.classList.add('drag-over');
}

function onTodoDrop(e, targetId) {
  e.preventDefault();
  if (!dragSrcId || dragSrcId === targetId) return;

  const todos = Store.getTodos();
  const srcIdx = todos.findIndex(t => t.id === dragSrcId);
  const tgtIdx = todos.findIndex(t => t.id === targetId);
  if (srcIdx < 0 || tgtIdx < 0) return;

  const [moved] = todos.splice(srcIdx, 1);
  todos.splice(tgtIdx, 0, moved);
  todos.forEach((t, i) => t.sortOrder = i);
  Store.saveTodos(todos);
  renderTodos();
}

function onTodoDragEnd(e) {
  dragSrcId = null;
  document.querySelectorAll('.todo-item').forEach(el => {
    el.classList.remove('dragging', 'drag-over');
  });
}


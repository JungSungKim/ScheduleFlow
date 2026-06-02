/* ================================================
   ScheduleFlow — Dashboard Module
   ================================================ */

let dashCalYear, dashCalMonth;

function renderDashboard() {
  applyDashboardOrder();
  renderDashTodos();
  renderDashTrips();
  renderDashDocs();
  renderDashCalendar();
  initDashboardDnD();
}

function applyDashboardOrder() {
  const container = document.getElementById('dashboard-grid');
  if (!container) return;
  const order = Store.getDashboardOrder();
  if (order && order.length) {
    order.forEach(id => {
      const el = document.getElementById(id);
      if (el) container.appendChild(el);
    });
  }
}

function initDashboardDnD() {
  const container = document.getElementById('dashboard-grid');
  if (!container) return;

  // Cleanup native drag attributes just in case
  const cards = container.querySelectorAll('.dash-card');
  cards.forEach(card => card.removeAttribute('draggable'));

  if (window.dashSortable) {
    window.dashSortable.destroy();
  }

  window.dashSortable = new Sortable(container, {
    handle: '.dash-drag-handle', // Drag handle selector
    animation: 200,             // ms, animation speed moving items
    ghostClass: 'sortable-ghost', // Class name for the drop placeholder
    dragClass: 'sortable-drag', // Class name for the dragging item
    forceFallback: false,       // Use fallback if native doesn't work well
    onEnd: function (evt) {
      // Save order
      const newOrder = Array.from(container.querySelectorAll('.dash-card')).map(c => c.id).filter(Boolean);
      Store.saveDashboardOrder(newOrder);
    }
  });
}

// ── Today's TODOs ──
function renderDashTodos() {
  const todos     = Store.getTodos().filter(t => t.status !== 'done');
  const todayTodos = todos.filter(t => t.dueDate === today());
  document.getElementById('today-todo-count').textContent = todayTodos.length || todos.length;
  const list = document.getElementById('today-todo-list');

  const display = todayTodos.length ? todayTodos : todos.slice(0, 5);
  if (!display.length) {
    list.innerHTML = '<p class="empty-state">등록된 할 일이 없습니다</p>';
    return;
  }
  list.innerHTML = display.map(t => {
    const tagBadges = (t.tags || []).slice(0, 2).map(tag => {
      const col = typeof tagColor === 'function' ? tagColor(tag) : { bg: 'var(--color-primary-light)', text: 'var(--color-primary)' };
      return `<span class="tag-badge" style="background:${col.bg};color:${col.text}">${esc(t.title ? tag : tag)}</span>`;
    }).join('');
    return `
    <div class="todo-item" style="padding:10px 14px;margin-bottom:6px;cursor:pointer" onclick="showTodoDetail('${t.id}')">
      <div class="todo-checkbox ${t.status === 'done' ? 'checked' : ''}"
           onclick="event.stopPropagation();cycleTodoStatus('${t.id}');renderDashboard()">${t.status === 'done' ? '✓' : t.status === 'in-progress' ? '◐' : ''}</div>
      <div class="todo-info">
        <div class="todo-title" style="font-size:0.88rem">${esc(t.title)}</div>
        <div class="todo-meta">
          ${t.dueDate ? `<span>${fmtDate(t.dueDate)}${t.dueTime ? ' (' + fmtTimeAmPm(t.dueTime) + ')' : ''}</span>` : ''}
          <span class="todo-priority ${t.priority}" style="font-size:0.68rem">${{ high: '높음', mid: '보통', low: '낮음' }[t.priority] || ''}</span>
          ${tagBadges}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Upcoming Trips ──
function renderDashTrips() {
  const trips = Store.getTrips()
    .filter(t => t.status !== 'completed')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const list = document.getElementById('upcoming-trips-list');
  if (!trips.length) {
    list.innerHTML = '<p class="empty-state">예정된 출장이 없습니다</p>';
    return;
  }
  list.innerHTML = trips.slice(0, 3).map(t => {
    const dd     = diffDays(t.startDate);
    const ddText = dd === 0 ? 'D-Day' : dd > 0 ? `D-${dd}` : `D+${Math.abs(dd)}`;
    const statusNextLabel = t.status === 'planned' ? '▶ 진행 시작' : t.status === 'in-progress' ? '✓ 완료' : '↩ 되돌리기';
    return `
    <div class="dash-trip-item" style="padding:8px 0;border-bottom:1px solid var(--border-color);cursor:pointer;" onclick="showTripDetail('${t.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:500;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">📍 ${esc(t.destination)} · ${fmtDate(t.startDate)}${t.startTime ? ' ' + fmtTime(t.startTime) : ''}</div>
          <button class="dash-trip-status-btn ${t.status === 'in-progress' ? 'complete' : ''}" onclick="event.stopPropagation();cycleTripStatus('${t.id}');renderDashboard()">${statusNextLabel}</button>
        </div>
        <span class="dday-badge ${dd === 0 ? 'today' : ''}" style="flex-shrink:0">${ddText}</span>
      </div>
    </div>`;
  }).join('');
}

// ── Pending Documents ──
function renderDashDocs() {
  const trips   = Store.getTrips();
  const pending = trips.filter(t => !t.preReport || !t.postReport);
  document.getElementById('pending-doc-count').textContent = pending.length;
  const list = document.getElementById('pending-docs-list');
  if (!pending.length) {
    list.innerHTML = '<p class="empty-state">미완료 문서가 없습니다</p>';
    return;
  }
  list.innerHTML = pending.slice(0, 3).map(t => `
    <div style="padding:6px 0;border-bottom:1px solid var(--border-color);font-size:0.85rem">
      <span style="font-weight:500">${esc(t.title)}</span>
      <span style="color:var(--text-muted);margin-left:8px">
        ${!t.preReport ? '📝 사전신청서' : ''} ${!t.postReport ? '📋 보고서' : ''}
      </span>
    </div>
  `).join('');
}

function renderDashCalendar() {
  const now = new Date();
  if (!dashCalYear) { dashCalYear = now.getFullYear(); dashCalMonth = now.getMonth(); }

  const titleEl = document.getElementById('dash-cal-title');
  const gridEl  = document.getElementById('dash-cal-grid');
  if (!titleEl || !gridEl) return;

  titleEl.textContent = `${dashCalYear}년 ${dashCalMonth + 1}월`;

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  let html = dayNames.map(d => `<div class="cal-day-header">${d}</div>`).join('');

  const firstDay = new Date(dashCalYear, dashCalMonth, 1).getDay();
  const daysInMonth = new Date(dashCalYear, dashCalMonth + 1, 0).getDate();
  const prevDays = new Date(dashCalYear, dashCalMonth, 0).getDate();
  const todayStr = today();
  
  // -- Visible date range
  const visibleDates = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    visibleDates.push(isoDate(new Date(dashCalYear, dashCalMonth, 0 - i)));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    visibleDates.push(`${dashCalYear}-${String(dashCalMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  const totalCells = firstDay + daysInMonth;
  const remaining = (7 - totalCells % 7) % 7;
  for (let i = 1; i <= remaining; i++) {
    visibleDates.push(isoDate(new Date(dashCalYear, dashCalMonth + 1, i)));
  }

  // -- Collect events
  const todos = Store.getTodos().filter(t => t.status !== 'done');
  const trips = Store.getTrips();
  let allEvents = [...todos, ...trips].map(t => {
    const { start, end, isTrip } = getEventStartEnd(t);
    return { ...t, _start: start, _end: end, _isTrip: isTrip };
  }).filter(t => t._end >= visibleDates[0] && t._start <= visibleDates[visibleDates.length - 1]);
  
  allEvents.sort((a, b) => {
    if (a._start !== b._start) return a._start.localeCompare(b._start);
    const lenA = diffDays(b._end) - diffDays(b._start);
    const lenB = diffDays(a._end) - diffDays(a._start);
    return lenB - lenA; // longer items first
  });

  // -- Assign Tracks
  const dayTracks = {};
  visibleDates.forEach(d => dayTracks[d] = []);
  allEvents.forEach(evt => {
    let track = 0;
    let found = false;
    while (!found) {
      found = true;
      let d = new Date(evt._start);
      const limit = new Date(evt._end);
      while (d <= limit) {
        const dStr = isoDate(d);
        if (dayTracks[dStr] && dayTracks[dStr][track]) { found = false; break; }
        d.setDate(d.getDate() + 1);
      }
      if (!found) track++;
    }
    let d = new Date(evt._start);
    const limit = new Date(evt._end);
    while (d <= limit) {
      const dStr = isoDate(d);
      if (dayTracks[dStr]) dayTracks[dStr][track] = evt;
      d.setDate(d.getDate() + 1);
    }
  });

  // -- Generate HTML
  const MAX_TRACKS = 5;
  visibleDates.forEach((dateStr, idx) => {
    const isToday = dateStr === todayStr;
    const isOtherMonth = idx < firstDay || idx >= firstDay + daysInMonth;
    const holidayName = typeof getHolidayName === 'function' ? getHolidayName(dateStr) : null;
    const isHoliday = !!holidayName || new Date(dateStr).getDay() === 0;
    const day = parseInt(dateStr.split('-')[2], 10);
    
    let eventsHtml = '';
    const tracks = dayTracks[dateStr];
    let overflowCount = 0;
    
    for (let i = MAX_TRACKS; i < tracks.length; i++) {
        if (tracks[i]) overflowCount++;
    }

    for (let i = 0; i < MAX_TRACKS; i++) {
      const evt = tracks[i];
      if (evt) {
        const typeCls = evt._isTrip ? 'trip' : (evt.type === 'personal' ? 'personal' : 'todo');
        const icon = evt._isTrip ? '✈️ ' : (evt.type==='personal' ? '👤 ' : (evt.repeat && evt.repeat !== 'none' ? '🔁 ' : ''));
        const isStart = dateStr === evt._start;
        const isEnd = dateStr === evt._end;
        let barCls = '';
        if (evt._start !== evt._end) {
          if (isStart) barCls = 'bar-start';
          else if (isEnd) barCls = 'bar-end';
          else barCls = 'bar-mid';
        }
        
        let tx = isStart || new Date(dateStr).getDay() === 0 ? esc(evt.title) : '\u00A0';
        // 대시보드 미니 쫬린더도 상세 패널으로 (대시보드 서첨 및 쫀린더 페이지와 UX 일관성)
        const clickAction = evt._isTrip ? `showTripDetail('${evt.id}')` : `showTodoDetail('${evt.id}')`;
        eventsHtml += `<div class="cal-event ${typeCls} ${barCls}" title="${esc(evt.title)}" onclick="event.stopPropagation();${clickAction}">${icon}${tx}</div>`;
      } else {
        if (tracks.some((t, k) => k > i)) {
            eventsHtml += `<div class="cal-event" style="visibility:hidden">\u00A0</div>`;
        }
      }
    }
    
    if (overflowCount > 0) {
      eventsHtml += `<div class="cal-more-btn" onclick="event.stopPropagation();navigateToDayPanel('${dateStr}')">+${overflowCount}개 더보기</div>`;
    }

    html += `<div class="cal-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isHoliday ? 'holiday' : ''}"
                  onclick="navigateToDayPanel('${dateStr}')">
               <span class="cal-day-num">${day}</span>
               ${holidayName ? `<div style="font-size:0.65rem;color:#E07070;margin-top:-6px;margin-bottom:2px;padding:0 8px">${esc(holidayName)}</div>` : ''}
               ${eventsHtml}
             </div>`;
  });

  gridEl.innerHTML = html;

  // Navigation
  document.getElementById('dash-cal-prev').onclick = () => {
    dashCalMonth--;
    if (dashCalMonth < 0) { dashCalMonth = 11; dashCalYear--; }
    renderDashCalendar();
  };
  document.getElementById('dash-cal-next').onclick = () => {
    dashCalMonth++;
    if (dashCalMonth > 11) { dashCalMonth = 0; dashCalYear++; }
    renderDashCalendar();
  };
  const todayBtn = document.getElementById('dash-cal-today-btn');
  if (todayBtn) todayBtn.onclick = () => {
    const n = new Date();
    dashCalYear  = n.getFullYear();
    dashCalMonth = n.getMonth();
    renderDashCalendar();
  };
}

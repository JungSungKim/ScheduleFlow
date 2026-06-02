/* ================================================
   ScheduleFlow — Calendar Module
   UX-2: Day Detail Side Panel
   UX-3: Recurring TODO display
   ================================================ */

let calYear, calMonth;
let dayPanelDate = null;

// ── Navigate from dashboard to calendar + open day panel ──
function navigateToDayPanel(dateStr) {
  const d  = new Date(dateStr);
  calYear  = d.getFullYear();
  calMonth = d.getMonth();
  navigate('calendar');
  setTimeout(() => onCalDayClick(dateStr), 150);
}

function initCalDate() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
}

// ── Recurrence & Date Match Helper ──
function getEventStartEnd(t) {
  const isTrip = t.destination !== undefined; // Trip has destination
  let start = isTrip ? t.startDate : (t.startDate || t.dueDate || today());
  let end   = isTrip ? t.endDate   : (t.dueDate || t.startDate || today());
  if (start > end) { const tmp=start; start=end; end=tmp; }
  return { start, end, isTrip };
}

// ── Render Calendar ──
function renderCalendar() {
  if (calYear === undefined) initCalDate();
  const grid = document.getElementById('calendar-grid');
  document.getElementById('cal-month-title').textContent = `${calYear}년 ${calMonth + 1}월`;

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  let html = dayNames.map(d => `<div class="cal-day-header">${d}</div>`).join('');

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const prevDays = new Date(calYear, calMonth, 0).getDate();
  const todayStr = today();
  
  // -- 1. Visible date range
  const visibleDates = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = new Date(calYear, calMonth, 0 - i);
    visibleDates.push(isoDate(d));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    visibleDates.push(`${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  const totalCells = firstDay + daysInMonth;
  const remaining = (7 - totalCells % 7) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(calYear, calMonth + 1, i);
    visibleDates.push(isoDate(d));
  }

  // -- 2. Collect and sort events
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

  // -- 3. Assign Tracks
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

  // -- 4. Generate HTML
  const MAX_TRACKS = 3;
  visibleDates.forEach((dateStr, idx) => {
    const isToday = dateStr === todayStr;
    const isActive = dateStr === dayPanelDate;
    const isOtherMonth = idx < firstDay || idx >= firstDay + daysInMonth;
    const holidayName = typeof getHolidayName === 'function' ? getHolidayName(dateStr) : null;
    const isHoliday = !!holidayName || new Date(dateStr).getDay() === 0;
    
    const day = parseInt(dateStr.split('-')[2], 10);
    
    let eventsHtml = '';
    const tracks = dayTracks[dateStr];
    let overflowCount = 0;
    
    // Count overflow
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
        // Phase 2: 캘린더 일정 바 → 상세 패널 (수정폼 직행 → 읽기 먼저)
        const clickAction = evt._isTrip ? `showTripDetail('${evt.id}')` : `showTodoDetail('${evt.id}')`;
        eventsHtml += `<div class="cal-event ${typeCls} ${barCls}" title="${esc(evt.title)}" onclick="event.stopPropagation();${clickAction}">${icon}${tx}</div>`;
      } else {
        if (tracks.some((t, k) => k > i)) {
            // invisible spacer
            eventsHtml += `<div class="cal-event" style="visibility:hidden">\u00A0</div>`;
        }
      }
    }
    
    if (overflowCount > 0) {
      eventsHtml += `<div class="cal-more-btn" onclick="event.stopPropagation();onCalDayClick('${dateStr}')">+${overflowCount}개 더보기</div>`;
    }

    html += `<div class="cal-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isActive ? 'selected' : ''} ${isHoliday ? 'holiday' : ''}"
                  onclick="onCalDayClick('${dateStr}')">
               <span class="cal-day-num">${day}</span>
               ${holidayName ? `<div style="font-size:0.65rem;color:#E07070;margin-top:-6px;margin-bottom:2px;padding:0 8px">${esc(holidayName)}</div>` : ''}
               ${eventsHtml}
             </div>`;
  });

  grid.innerHTML = html;

  // nav buttons
  document.getElementById('cal-prev').onclick = () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  };
  document.getElementById('cal-next').onclick = () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  };
  document.getElementById('cal-today').onclick = () => { initCalDate(); renderCalendar(); };
}

// ── Day Panel ──
function onCalDayClick(dateStr) {
  dayPanelDate = dateStr;
  openDayPanel(dateStr);
  // re-render to highlight selected day
  renderCalendar();
}

function openDayPanel(dateStr) {
  const date = new Date(dateStr);
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const formatted = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;

  document.getElementById('day-panel-title').textContent = formatted;
  document.getElementById('day-panel-date').textContent  = dayNames[date.getDay()];

  const todos = Store.getTodos().filter(t => todoAppearsOn(t, dateStr));
  const trips = Store.getTrips().filter(t => dateStr >= t.startDate && dateStr <= t.endDate);

  let bodyHtml = '';

  // TODO 섹션
  bodyHtml += `<div class="day-panel-section-title">📋 할 일</div>`;
  if (todos.length) {
    bodyHtml += todos.map(t => {
      const statusIcon = t.status === 'done' ? '✓' : t.status === 'in-progress' ? '◐' : '○';
      const repeatIcon = t.repeat && t.repeat !== 'none' ? ' 🔁' : '';
      const prioLabel  = { high: '높음', mid: '보통', low: '낮음' }[t.priority] || '';
      return `
        <div class="day-panel-item" onclick="closeDayPanel();showTodoForm('${t.id}')">
          <span style="font-size:1rem">${statusIcon}</span>
          <div style="flex:1;min-width:0">
            <div class="day-panel-item-text">${esc(t.title)}${repeatIcon}</div>
            <div class="day-panel-item-sub">
              ${t.dueTime ? `<span style="margin-right:6px">🕒 ${fmtTime(t.dueTime)}</span>` : ''}
              <span class="todo-priority ${t.priority}" style="font-size:0.65rem">${prioLabel}</span>
            </div>
          </div>
        </div>`;
    }).join('');
  } else {
    bodyHtml += `<p class="day-panel-empty">이 날 할 일이 없습니다</p>`;
  }

  // 출장 섹션
  bodyHtml += `<div class="day-panel-section-title">✈️ 출장</div>`;
  if (trips.length) {
    bodyHtml += trips.map(t => {
      const statusLabel = { planned: '계획됨', 'in-progress': '진행중', completed: '완료' }[t.status];
      return `
        <div class="day-panel-item" onclick="closeDayPanel();navigate('trips')">
          <span style="font-size:1.2rem">✈️</span>
          <div style="flex:1;min-width:0">
            <div class="day-panel-item-text">${esc(t.title)}</div>
            <div class="day-panel-item-sub">
              ${t.startTime ? `<span style="margin-right:6px">🕒 ${fmtTime(t.startTime)}</span>` : ''}
              📍 ${esc(t.destination)} · ${statusLabel}
            </div>
          </div>
        </div>`;
    }).join('');
  } else {
    bodyHtml += `<p class="day-panel-empty">이 날 출장이 없습니다</p>`;
  }

  document.getElementById('day-panel-body').innerHTML = bodyHtml;

  // footer buttons
  document.getElementById('day-panel-btn-todo').onclick = () => {
    closeDayPanel();
    showTodoForm();
    setTimeout(() => {
      const el = document.getElementById('tf-due');
      if (el) el.value = dateStr;
    }, 60);
  };
  document.getElementById('day-panel-btn-trip').onclick = () => {
    closeDayPanel();
    showTripForm('', dateStr);
  };

  // show panel
  document.getElementById('day-panel-backdrop').style.display = 'block';
  requestAnimationFrame(() => {
    document.getElementById('day-panel').classList.add('open');
  });
}

function closeDayPanel() {
  dayPanelDate = null;
  document.getElementById('day-panel').classList.remove('open');
  document.getElementById('day-panel-backdrop').style.display = 'none';
  renderCalendar();
}

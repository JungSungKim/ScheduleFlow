/* ================================================
   ScheduleFlow — Documents Module (모아소프트 양식)
   ================================================ */

function renderDocuments() {
  const trips = Store.getTrips();
  const sel = document.getElementById('doc-trip-selector');
  if (!trips.length) {
    sel.innerHTML = '<p class="empty-state">출장을 먼저 등록해주세요</p>';
    document.getElementById('doc-editor-area').style.display = 'none';
    return;
  }
  sel.innerHTML = trips.map(t => `
    <div class="doc-trip-item" onclick="selectTripForDoc('${t.id}')">
      <span style="font-size:1.5rem">✈️</span>
      <div>
        <div style="font-weight:600">${esc(t.title)}</div>
        <div style="font-size:0.82rem;color:var(--text-muted)">${fmtDate(t.startDate)} ~ ${fmtDate(t.endDate)} · ${esc(t.destination)}</div>
      </div>
    </div>
  `).join('');
}

function selectTripForDoc(tripId) {
  const trip = Store.getTrips().find(t => t.id === tripId);
  if (!trip) return;
  const area = document.getElementById('doc-editor-area');
  area.style.display = 'block';
  area.innerHTML = `
    <h2 style="margin-bottom:16px">📄 ${esc(trip.title)} — 문서 선택</h2>
    <div style="display:flex;gap:16px;flex-wrap:wrap;">
      <div class="dash-card" style="flex:1;min-width:280px;cursor:pointer" onclick="showPreReport('${tripId}')">
        <div class="dash-card-header"><h3>📝 출장사전신청서</h3></div>
        <p style="font-size:0.85rem">${trip.preReport ? '✅ 작성됨' : '미작성 — 클릭하여 작성'}</p>
      </div>
      <div class="dash-card" style="flex:1;min-width:280px;cursor:pointer" onclick="showPostReport('${tripId}')">
        <div class="dash-card-header"><h3>📋 외근출장보고서</h3></div>
        <p style="font-size:0.85rem">${trip.postReport ? '✅ 작성됨' : '미작성 — 클릭하여 작성'}</p>
      </div>
    </div>`;
}

/* ── 사전신청서 ── */
function showPreReport(tripId) {
  const trip = Store.getTrips().find(t => t.id === tripId);
  if (!trip) return;
  const r = trip.preReport || {};
  const area = document.getElementById('doc-editor-area');
  area.innerHTML = `
    <div class="flex-between mb-16">
      <h2>M_출장사전신청서</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline btn-sm" onclick="selectTripForDoc('${tripId}')">← 돌아가기</button>
        <button class="btn btn-primary btn-sm" onclick="printPreReport('${tripId}')">🖨️ 인쇄/PDF</button>
      </div>
    </div>
    <form id="pre-report-form" class="doc-form">
      <div class="form-row">
        <div class="form-group"><label class="form-label">기안 부서</label><input class="form-input" id="pr-dept" value="${esc(r.dept||'')}"></div>
        <div class="form-group"><label class="form-label">기안자</label><input class="form-input" id="pr-writer" value="${esc(r.writer||'')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">기안 일자</label><input class="form-input" type="date" id="pr-date" value="${r.date||today()}"></div>
        <div class="form-group"><label class="form-label">보존 연한/보안 등급</label><input class="form-input" id="pr-security" value="${esc(r.security||'5년 / S등급')}"></div>
      </div>
      <hr style="border-color:var(--border-color);margin:16px 0">
      <div class="form-row">
        <div class="form-group"><label class="form-label">신청자 부서</label><input class="form-input" id="pr-applicant-dept" value="${esc(r.applicantDept||r.dept||'')}"></div>
        <div class="form-group"><label class="form-label">직급</label><input class="form-input" id="pr-rank" value="${esc(r.rank||'')}"></div>
      </div>
      <div class="form-group"><label class="form-label">성명</label><input class="form-input" id="pr-name" value="${esc(r.name||r.writer||'')}"></div>
      <div class="form-group"><label class="form-label">기간</label><input class="form-input" id="pr-period" value="${esc(r.period||trip.startDate+' ~ '+trip.endDate)}"></div>
      <div class="form-group"><label class="form-label">사업명(계약명)</label><input class="form-input" id="pr-project" value="${esc(r.project||trip.project||'')}"></div>
      <div class="form-group"><label class="form-label">방문처</label><input class="form-input" id="pr-visit" value="${esc(r.visit||trip.destination||'')}"></div>
      <div class="form-group"><label class="form-label">교통수단</label><input class="form-input" id="pr-transport" value="${esc(r.transport||trip.transport||'')}"></div>
      <div class="form-group"><label class="form-label">출장자</label><input class="form-input" id="pr-travelers" value="${esc(r.travelers||trip.companions||'')}"></div>
      <div class="form-group"><label class="form-label">목적</label><textarea class="form-textarea" id="pr-purpose" rows="3">${esc(r.purpose||trip.purpose||'')}</textarea></div>
      <div class="form-group"><label class="form-label">기타</label><textarea class="form-textarea" id="pr-etc" rows="2">${esc(r.etc||'')}</textarea></div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">💾 저장</button>
      </div>
    </form>`;
  document.getElementById('pre-report-form').addEventListener('submit', e => {
    e.preventDefault();
    savePreReport(tripId);
  });
}

function savePreReport(tripId) {
  const trips = Store.getTrips();
  const t = trips.find(x => x.id === tripId);
  if (!t) return;
  t.preReport = {
    dept: document.getElementById('pr-dept').value,
    writer: document.getElementById('pr-writer').value,
    date: document.getElementById('pr-date').value,
    security: document.getElementById('pr-security').value,
    applicantDept: document.getElementById('pr-applicant-dept').value,
    rank: document.getElementById('pr-rank').value,
    name: document.getElementById('pr-name').value,
    period: document.getElementById('pr-period').value,
    project: document.getElementById('pr-project').value,
    visit: document.getElementById('pr-visit').value,
    transport: document.getElementById('pr-transport').value,
    travelers: document.getElementById('pr-travelers').value,
    purpose: document.getElementById('pr-purpose').value,
    etc: document.getElementById('pr-etc').value,
  };
  Store.saveTrips(trips);
  alert('사전신청서가 저장되었습니다.');
}

function printPreReport(tripId) {
  const trip = Store.getTrips().find(t => t.id === tripId);
  if (!trip || !trip.preReport) { alert('먼저 사전신청서를 저장해주세요.'); return; }
  const r = trip.preReport;
  const w = window.open('', '_blank');
  if (!w) { alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.'); return; }
  w.document.write(buildPreReportHTML(r, trip));
  w.document.close();
  setTimeout(() => w.print(), 300);
}

function buildPreReportHTML(r, trip) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>M_출장사전신청서</title>
  <style>
    body{font-family:'Noto Sans KR',sans-serif;padding:40px;color:#222;font-size:13px}
    h1{font-size:22px;margin-bottom:20px;border-bottom:3px solid #222;padding-bottom:8px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    td,th{border:1px solid #888;padding:8px 10px;text-align:left}
    th{background:#f5f5f5;width:120px;font-weight:600}
    .header-info{margin-bottom:24px;font-size:12px}
    .header-info td{border:none;padding:3px 8px}
    .title-row{background:#f9f9f9;font-weight:600;text-align:center;font-size:14px}
    .logo{text-align:right;font-size:18px;font-weight:700;color:#666;margin-top:30px}
  </style></head><body>
  <h1>M_출장사전신청서</h1>
  <table class="header-info"><tr><td><b>문서 번호</b></td><td></td><td><b>결재</b></td><td></td></tr>
    <tr><td><b>기안 부서</b></td><td>${esc(r.dept)}</td><td rowspan="4" colspan="2" style="vertical-align:top"><table style="width:100%"><tr><th>${esc(r.rank)}</th><td></td><td></td></tr><tr><td>${esc(r.name)}</td><td></td><td></td></tr></table></td></tr>
    <tr><td><b>기안자</b></td><td>${esc(r.writer)}</td></tr>
    <tr><td><b>기안 일자</b></td><td>${r.date}</td></tr>
    <tr><td><b>보존 연한/보안 등급</b></td><td>${esc(r.security)}</td></tr></table>
  <p class="title-row" style="padding:10px;border:2px solid #222;margin-bottom:16px">[${esc(r.applicantDept)}] / [외근출장신청서] ${esc(r.period)} / ${esc(r.visit)} / ${esc(r.project)}</p>
  <table>
    <tr><th rowspan="2">신청자</th><th>부서</th><th>직급</th><th>성명</th></tr>
    <tr><td>${esc(r.applicantDept)}</td><td>${esc(r.rank)}</td><td>${esc(r.name)}</td></tr>
    <tr><th>기간</th><td colspan="3">${esc(r.period)}</td></tr>
    <tr><th>사업명(계약명)</th><td colspan="3">${esc(r.project)}</td></tr>
    <tr><th>방문처</th><td colspan="3">${esc(r.visit)}</td></tr>
    <tr><th>교통수단</th><td colspan="3">${esc(r.transport)}</td></tr>
    <tr><th>출장자</th><td colspan="3">${esc(r.travelers)}</td></tr>
    <tr><th>목적</th><td colspan="3" style="white-space:pre-wrap">${esc(r.purpose)}</td></tr>
    <tr><th>기타</th><td colspan="3" style="white-space:pre-wrap">${esc(r.etc)}</td></tr>
  </table>
  <div class="logo">MOASOFT</div></body></html>`;
}

/* ── 출장보고서 ── */
function showPostReport(tripId) {
  const trip = Store.getTrips().find(t => t.id === tripId);
  if (!trip) return;
  const r = trip.postReport || {};
  const schedRows = r.schedule || [{time:'',place:'',task:''}];
  const area = document.getElementById('doc-editor-area');
  area.innerHTML = `
    <div class="flex-between mb-16">
      <h2>M_외근출장보고서(국내)</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline btn-sm" onclick="selectTripForDoc('${tripId}')">← 돌아가기</button>
        <button class="btn btn-primary btn-sm" onclick="printPostReport('${tripId}')">🖨️ 인쇄/PDF</button>
      </div>
    </div>
    <form id="post-report-form">
      <div class="form-row">
        <div class="form-group"><label class="form-label">기안 부서</label><input class="form-input" id="po-dept" value="${esc(r.dept||'')}"></div>
        <div class="form-group"><label class="form-label">기안자</label><input class="form-input" id="po-writer" value="${esc(r.writer||'')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">기안 일자</label><input class="form-input" type="date" id="po-date" value="${r.date||today()}"></div>
        <div class="form-group"><label class="form-label">보존 연한/보안 등급</label><input class="form-input" id="po-security" value="${esc(r.security||'5년 / B등급')}"></div>
      </div>
      <hr style="border-color:var(--border-color);margin:16px 0">
      <div class="form-row">
        <div class="form-group"><label class="form-label">외근·출장지</label><input class="form-input" id="po-place" value="${esc(r.place||trip.destination||'')}"></div>
        <div class="form-group"><label class="form-label">교통수단/동행자</label><input class="form-input" id="po-transport" value="${esc(r.transport||(trip.transport+(trip.companions?' / '+trip.companions:''))||'')}"></div>
      </div>
      <div class="form-group"><label class="form-label">사업명(계약명)</label><input class="form-input" id="po-project" value="${esc(r.project||trip.project||'')}"></div>
      <div class="form-group"><label class="form-label">방문사유</label><input class="form-input" id="po-reason" value="${esc(r.reason||trip.purpose||'')}"></div>
      <div class="form-group"><label class="form-label">외근·출장기간</label><input class="form-input" id="po-period" value="${esc(r.period||trip.startDate+' ~ '+trip.endDate)}"></div>

      <div class="form-group">
        <label class="form-label">시간대별 일정</label>
        <div id="schedule-rows">
          ${schedRows.map((s,i) => scheduleRowHTML(i, s)).join('')}
        </div>
        <button type="button" class="btn btn-sm btn-outline mt-8" onclick="addScheduleRow()">+ 일정 추가</button>
      </div>

      <div class="form-row">
        <div class="form-group"><label class="form-label">업체명</label><input class="form-input" id="po-company" value="${esc(r.company||'')}"></div>
        <div class="form-group"><label class="form-label">업체부서/담당자</label><input class="form-input" id="po-contact" value="${esc(r.contact||'')}"></div>
      </div>
      <div class="form-group"><label class="form-label">업무보고</label><textarea class="form-textarea" id="po-work" rows="4">${esc(r.work||'')}</textarea></div>
      <div class="form-group"><label class="form-label">경과보고</label><textarea class="form-textarea" id="po-progress" rows="4">${esc(r.progress||'')}</textarea></div>
      <div class="form-group"><label class="form-label">이슈사항</label><textarea class="form-textarea" id="po-issues" rows="2">${esc(r.issues||'')}</textarea></div>
      <div class="form-group"><label class="form-label">추후계획</label><textarea class="form-textarea" id="po-plan" rows="2">${esc(r.plan||'')}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">지급요청금액</label><input class="form-input" id="po-amount" value="${esc(r.amount||'')}"></div>
        <div class="form-group"><label class="form-label">사유서</label><input class="form-input" id="po-statement" value="${esc(r.statement||'')}"></div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">💾 저장</button>
      </div>
    </form>`;
  document.getElementById('post-report-form').addEventListener('submit', e => {
    e.preventDefault();
    savePostReport(tripId);
  });
}

function scheduleRowHTML(idx, s) {
  return `<div class="form-row mt-8" data-sched="${idx}">
    <input class="form-input sched-time" placeholder="(예시)7/9 13:00~15:00" value="${esc(s?.time||'')}">
    <input class="form-input sched-place" placeholder="방문선" value="${esc(s?.place||'')}">
    <input class="form-input sched-task" placeholder="업무내용" value="${esc(s?.task||'')}">
  </div>`;
}

function addScheduleRow() {
  const container = document.getElementById('schedule-rows');
  const idx = container.children.length;
  container.insertAdjacentHTML('beforeend', scheduleRowHTML(idx, {}));
}

function getScheduleRows() {
  const rows = [];
  document.querySelectorAll('#schedule-rows [data-sched]').forEach(row => {
    rows.push({
      time: row.querySelector('.sched-time').value,
      place: row.querySelector('.sched-place').value,
      task: row.querySelector('.sched-task').value,
    });
  });
  return rows.filter(r => r.time || r.place || r.task);
}

function savePostReport(tripId) {
  const trips = Store.getTrips();
  const t = trips.find(x => x.id === tripId);
  if (!t) return;
  t.postReport = {
    dept: document.getElementById('po-dept').value,
    writer: document.getElementById('po-writer').value,
    date: document.getElementById('po-date').value,
    security: document.getElementById('po-security').value,
    place: document.getElementById('po-place').value,
    transport: document.getElementById('po-transport').value,
    project: document.getElementById('po-project').value,
    reason: document.getElementById('po-reason').value,
    period: document.getElementById('po-period').value,
    schedule: getScheduleRows(),
    company: document.getElementById('po-company').value,
    contact: document.getElementById('po-contact').value,
    work: document.getElementById('po-work').value,
    progress: document.getElementById('po-progress').value,
    issues: document.getElementById('po-issues').value,
    plan: document.getElementById('po-plan').value,
    amount: document.getElementById('po-amount').value,
    statement: document.getElementById('po-statement').value,
  };
  Store.saveTrips(trips);
  alert('출장보고서가 저장되었습니다.');
}

function printPostReport(tripId) {
  const trip = Store.getTrips().find(t => t.id === tripId);
  if (!trip || !trip.postReport) { alert('먼저 보고서를 저장해주세요.'); return; }
  const r = trip.postReport;
  const w = window.open('', '_blank');
  if (!w) { alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>M_외근출장보고서(국내)</title>
  <style>
    body{font-family:'Noto Sans KR',sans-serif;padding:40px;color:#222;font-size:13px}
    h1{font-size:22px;margin-bottom:20px;border-bottom:3px solid #222;padding-bottom:8px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    td,th{border:1px solid #888;padding:8px 10px;text-align:left}
    th{background:#f5f5f5;width:120px;font-weight:600}
    .title-row{background:#f9f9f9;font-weight:600;text-align:center;font-size:14px;padding:10px;border:2px solid #222;margin-bottom:16px}
    .logo{text-align:right;font-size:18px;font-weight:700;color:#666;margin-top:30px}
  </style></head><body>
  <h1>M_외근출장보고서(국내)</h1>
  <p class="title-row">[${esc(r.dept)}] / [외근출장보고서(국내)] ${esc(r.period)} / ${esc(r.place)} / ${esc(r.project)}</p>
  <table>
    <tr><th>외근·출장지</th><td>${esc(r.place)}</td><th>교통수단/동행자</th><td>${esc(r.transport)}</td></tr>
    <tr><th>사업명(계약명)</th><td colspan="3">${esc(r.project)}</td></tr>
    <tr><th>방문사유</th><td colspan="3">${esc(r.reason)}</td></tr>
    <tr><th>외근·출장기간</th><td colspan="3">${esc(r.period)}</td></tr>
    <tr><th rowspan="${(r.schedule?.length||1)+1}">시간대별</th><th>일정(부터~까지)</th><th>방문선</th><th>업무내용</th></tr>
    ${(r.schedule||[]).map(s=>`<tr><td>${esc(s.time)}</td><td>${esc(s.place)}</td><td>${esc(s.task)}</td></tr>`).join('')}
    <tr><th>업체명</th><td>${esc(r.company)}</td><th>업체부서/담당자</th><td>${esc(r.contact)}</td></tr>
    <tr><th>업무보고</th><td colspan="3" style="white-space:pre-wrap;min-height:100px">${esc(r.work)}</td></tr>
    <tr><th>경과보고</th><td colspan="3" style="white-space:pre-wrap;min-height:100px">${esc(r.progress)}</td></tr>
    <tr><th>이슈사항</th><td colspan="3" style="white-space:pre-wrap">${esc(r.issues)}</td></tr>
    <tr><th>추후계획</th><td colspan="3" style="white-space:pre-wrap">${esc(r.plan)}</td></tr>
  </table>
  <table><tr><th>지급요청금액</th><td>${esc(r.amount)} 원</td></tr>
    <tr><th>사유서</th><td>${esc(r.statement)}</td></tr></table>
  <div class="logo">MOASOFT</div></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

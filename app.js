(() => {
  'use strict';
  const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
  const EN = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const PARTS = ['오전', '오후', '저녁', '밤'];
  const STATUS = { ideas: '나중에', soon: '예정', doing: '진행 중', done: '완료' };
  const COLORS = { ideas: '#aab6ba', soon: '#80b9cf', doing: '#ef8d6b', done: '#8fc5a7' };
  const KIND = { study: '중국어', body: '운동', culture: '취미·사람', life: '생활', rest: '회복' };
  const PHASE = {
    korea: { copy: '중국어와 몸을 중심에 두고, 취미와 사람을 만날 여백을 남긴다.', meta: '08:00 기상 · 23:30 취침', season: [['12월', '생활 기반', '회복 · 운전면허 · 중국어 · 운동'], ['1월', '취미를 실제로', '스키 여행 · 라켓 스포츠 · 모임'], ['2월', '대만으로 전환', '출국 · 집 · 통학과 동네 적응']] },
    taipei: { copy: '수업만 들으러 가지 않는다. 도시와 사람에게 노출되고, 나만의 리듬을 이어간다.', meta: '07:00 기상 · 23:00 취침', season: [['2월 중순', '먼저 살아보기', '집 · 동네 · 통학 동선에 익숙해지기'], ['3월 1일', '대만대 개강', '오전 또는 오후반은 학교가 배정'], ['3월', '생활 학기', '중국어 · 운동 · 사람 · 도시']] }
  };
  const KEY = 'new-season-v2';
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const clone = v => JSON.parse(JSON.stringify(v));
  const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dayDate = (key, index) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + index); return d.toISOString().slice(0, 10); };
  const dateLabel = iso => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
  const dateShort = iso => `${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))}`;
  const validDay = (key, day) => dayDate(key, DAYS.indexOf(day)) <= '2027-03-31';

  function initialData() {
    const weeks = {};
    SEED.weeks.forEach(w => {
      weeks[w.key] = SEED.templates[w.phase].filter(x => validDay(w.key, x.day)).map((x, i) => {
        const item = { ...clone(x), id: `${w.key}-${i}`, status: 'soon' };
        if (w.phase === 'taipei' && w.key < '2027-03-01') {
          if (item.part === '오전' && DAYS.indexOf(item.day) < 5) Object.assign(item, { title: '중국어 자습 · 정착', time: '개강 전 적응 기간', note: '집 · 동네 · 통학 동선 익히기' });
          if (item.part === '오후') { item.title = item.title.replace('복습', '생활 정리'); item.time = item.time.replace('숙제 후', '정리 후').replace('숙제', '할 일'); item.note = item.note.replace('숙제', '할 일'); }
          item.note = item.note.replace('수업 준비', '개강 준비');
        }
        return item;
      });
    });
    return { schema: 2, phase: 'korea', weekKey: SEED.weeks[0].key, day: '월', boardScope: 'week', weeks, projects: clone(SEED.projects) };
  }

  function validate(value) {
    if (!value || value.schema !== 2 || !['korea', 'taipei'].includes(value.phase) || !SEED.weeks.some(w => w.key === value.weekKey) || !DAYS.includes(value.day) || !['week', 'projects'].includes(value.boardScope)) throw Error('형식');
    if (!value.weeks || Object.keys(value.weeks).length !== SEED.weeks.length || !Array.isArray(value.projects) || value.projects.length > 1000) throw Error('범위');
    const ids = new Set();
    function task(t, key) {
      if (!t || typeof t.id !== 'string' || t.id.length > 100 || ids.has(t.id) || !Object.hasOwn(STATUS, t.status) || !Object.hasOwn(KIND, t.kind)) throw Error('카드');
      ids.add(t.id);
      for (const [field, max] of [['title', 80], ['time', 60], ['note', 300]]) {
        if (field !== 'title' && t[field] === undefined) continue;
        if (typeof t[field] !== 'string' || t[field].length > max) throw Error('텍스트');
      }
      if (!t.title.trim()) throw Error('제목');
      if (key && (!DAYS.includes(t.day) || !PARTS.includes(t.part) || !validDay(key, t.day))) throw Error('일정');
      if (!key && !['korea', 'taipei'].includes(t.phase)) throw Error('단계');
    }
    SEED.weeks.forEach(w => { const items = value.weeks[w.key]; if (!Array.isArray(items) || items.length > 1000) throw Error('주간'); items.forEach(t => task(t, w.key)); });
    value.projects.forEach(t => task(t));
    return value;
  }

  let loadIssue = '';
  function load() {
    try { const raw = localStorage.getItem(KEY); return raw ? validate(JSON.parse(raw)) : initialData(); }
    catch { loadIssue = '저장된 기록을 읽을 수 없어 기본안을 표시했어. 저장 권한과 백업 파일을 확인해줘.'; return initialData(); }
  }
  let data = load(), editRef = null, dragging = null, undoAction = null;
  let view = location.hash === '#board' ? 'board' : 'calendar';
  const phaseLastWeek = { korea: '2026-11-30', taipei: '2027-03-01' };
  function warn(message) { $('#storage-warning').hidden = false; $('#storage-warning').textContent = message; }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); $('#storage-warning').hidden = true; return true; }
    catch { warn('저장이 차단됐어. 지금 변경은 화면에만 반영돼. 새로고침 전에 백업을 받아줘.'); return false; }
  }
  function currentWeek() { return SEED.weeks.find(w => w.key === data.weekKey); }
  function phaseWeeks() { return SEED.weeks.filter(w => w.phase === data.phase); }
  function listFor(scope) { return scope === 'projects' ? data.projects : data.weeks[data.weekKey]; }
  function selectedTasks() { return data.boardScope === 'projects' ? data.projects.filter(x => x.phase === data.phase) : data.weeks[data.weekKey]; }
  function toast(message, undo) {
    const el = $('#toast'); $('span', el).textContent = message; undoAction = undo || null; $('button', el).hidden = !undo;
    el.classList.add('is-visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('is-visible'), undo ? 9000 : 2800);
  }
  function savedToast(ok, message, undo) { toast(ok ? message : '화면에 반영했지만 저장하지 못했어. 백업을 받아줘.', undo); }
  function setView(next) {
    view = next;
    $$('.view').forEach(v => { const on = v.id === `${next}-view`; v.hidden = !on; v.classList.toggle('is-active', on); });
    $$('.nav-item').forEach(b => { const on = b.dataset.view === next; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on); });
    $('#page-title').textContent = next === 'calendar' ? '한 주의 리듬' : '움직이는 계획';
    history.replaceState(null, '', `#${next}`);
  }
  function renderHeader() {
    data.phase = currentWeek().phase;
    phaseLastWeek[data.phase] = data.weekKey;
    $$('.phase-btn').forEach(b => { const on = b.dataset.phase === data.phase; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on); });
    const info = PHASE[data.phase];
    $('#phase-copy').textContent = info.copy;
    $('#calendar-meta').textContent = info.meta;
    $('#assumption').textContent = data.phase === 'korea'
      ? '11월 말 전역을 가정한 제안이야. 전역 직후·여행 주간은 가볍게 조정해. 예약된 일정은 아니야.'
      : data.weekKey < '2027-03-01'
        ? '2월 중순 출국을 가정한 적응 기간. 3월 1일 개강 전에는 수업 대신 자습과 정착 시간을 뒀어.'
        : '대만대 CLD 오전반 가정 · 실제 반 배정 전. 오후반은 12:00–14:50으로, 오전 활동과 교체해. 공휴일·휴강은 최종 학사일정에 맞춰 조정해.';
    const weeks = phaseWeeks();
    $('#week-select').innerHTML = weeks.map(w => `<option value="${w.key}" ${w.key === data.weekKey ? 'selected' : ''}>${dateLabel(w.start)} — ${dateLabel(w.end)}</option>`).join('');
    const idx = weeks.findIndex(w => w.key === data.weekKey);
    $('#prev-week').disabled = idx <= 0; $('#next-week').disabled = idx >= weeks.length - 1;
    $('#timezone-label').textContent = data.phase === 'korea' ? '한국 현지 시간' : '타이베이 현지 시간';
    const items = data.weeks[data.weekKey];
    $('#week-progress').textContent = `완료 ${items.filter(x => x.status === 'done').length} / ${items.length}`;
    $('#season-strip').innerHTML = info.season.map(x => `<article class="season-card"><span>${esc(x[0])}</span><h3>${esc(x[1])}</h3><p>${esc(x[2])}</p></article>`).join('');
  }
  function renderCalendar() {
    const tasks = data.weeks[data.weekKey], grid = $('#week-grid');
    if (!validDay(data.weekKey, data.day)) data.day = '월';
    $('#mobile-days').innerHTML = DAYS.map(day => `<button type="button" data-day="${day}" ${validDay(data.weekKey, day) ? '' : 'disabled'} aria-pressed="${day === data.day}" class="${day === data.day ? 'is-active' : ''}">${day}</button>`).join('');
    $$('#mobile-days button').forEach(b => b.onclick = () => { data.day = b.dataset.day; persist(); renderCalendar(); });
    grid.replaceChildren(); grid.append(document.createElement('div'));
    DAYS.forEach((day, i) => { const h = document.createElement('div'); h.className = `day-head ${day === data.day ? 'mobile-active' : ''}`; h.innerHTML = `<strong>${day}</strong><span>${EN[i]} / ${dateShort(dayDate(data.weekKey, i))}</span>`; grid.append(h); });
    PARTS.forEach((part, pi) => {
      const time = document.createElement('div'); time.className = 'time-head';
      const range = [[data.phase === 'korea' ? '08–12' : '07–12'], ['13–17'], ['18–21'], [data.phase === 'korea' ? '21–23:30' : '21–23']][pi];
      time.innerHTML = `<strong>${part}</strong>${range}`; grid.append(time);
      DAYS.forEach(day => {
        const slot = document.createElement('div'); slot.className = `calendar-slot ${day === data.day ? 'mobile-active' : ''}`;
        if (!validDay(data.weekKey, day)) { slot.classList.add('outside-range'); slot.textContent = '계획 범위 밖'; grid.append(slot); return; }
        const matches = tasks.filter(x => x.day === day && x.part === part);
        matches.forEach(item => {
          const c = document.createElement('article'); c.className = `calendar-cell kind-${item.kind} ${item.status === 'done' ? 'is-done' : ''}`; c.dataset.id = item.id;
          c.innerHTML = `<button type="button" class="edit-cell" aria-label="${day} ${part} ${esc(item.title)} 수정"></button><button type="button" class="done-toggle" aria-pressed="${item.status === 'done'}" aria-label="${esc(item.title)} ${item.status === 'done' ? '완료 취소' : '완료 표시'}"></button><div class="content"><span class="slot">${esc(item.time || KIND[item.kind])}</span><h3>${esc(item.title)}</h3><p>${esc(item.note)}</p></div>`;
          $('.edit-cell', c).onclick = () => openEditor(item, 'week');
          $('.done-toggle', c).onclick = () => changeStatus(item, 'week', item.status === 'done' ? 'soon' : 'done');
          slot.append(c);
        });
        if (!matches.length) { const b = document.createElement('button'); b.className = 'empty-slot'; b.textContent = '+ 일정 넣기'; b.onclick = () => openEditor(null, 'week', day, part); slot.append(b); }
        grid.append(slot);
      });
    });
  }
  function renderBoard() {
    $$('.segmented button').forEach(b => { const on = b.dataset.scope === data.boardScope; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on); });
    const board = $('#board'); board.replaceChildren();
    const source = selectedTasks();
    Object.entries(STATUS).forEach(([key, label]) => {
      const col = document.createElement('section'); col.className = 'board-column'; col.dataset.status = key; col.style.setProperty('--column-color', COLORS[key]);
      const cards = source.filter(t => t.status === key);
      col.innerHTML = `<div class="column-head"><h2>${label}</h2><span>${cards.length}</span></div><div class="task-list"></div>`;
      const list = $('.task-list', col);
      cards.forEach(task => {
        const card = document.createElement('article'); card.className = `task-card kind-${task.kind}`; card.draggable = true; card.dataset.id = task.id;
        card.innerHTML = `<div class="task-head"><span class="task-kind">${KIND[task.kind]}</span><button type="button" class="edit-task" aria-label="${esc(task.title)} 수정">수정</button></div><h3>${esc(task.title)}</h3><p>${esc(task.note || '메모 없음')}</p><div class="task-foot"><span class="task-when">${data.boardScope === 'week' ? `${task.day} · ${task.part}` : task.phase === 'korea' ? '한국 생활' : '대만 생활'}</span><select class="status-select" aria-label="${esc(task.title)} 상태">${Object.entries(STATUS).map(([v, l]) => `<option value="${v}" ${v === task.status ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
        $('.edit-task', card).onclick = () => openEditor(task, data.boardScope);
        $('.status-select', card).onchange = e => changeStatus(task, data.boardScope, e.target.value);
        card.ondragstart = e => { dragging = task.id; e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'; card.classList.add('is-dragging'); };
        card.ondragend = () => { dragging = null; card.classList.remove('is-dragging'); $$('.is-over').forEach(x => x.classList.remove('is-over')); };
        list.append(card);
      });
      if (!cards.length) { const p = document.createElement('p'); p.className = 'empty-column'; p.textContent = key === 'done' ? '끝낸 일이 여기에 쌓여.' : '카드를 옮기거나 새로 추가해봐.'; list.append(p); }
      col.ondragover = e => { e.preventDefault(); col.classList.add('is-over'); };
      col.ondragleave = () => col.classList.remove('is-over');
      col.ondrop = e => { e.preventDefault(); const id = dragging || e.dataTransfer.getData('text/plain'); const task = listFor(data.boardScope).find(x => x.id === id); dragging = null; if (task) changeStatus(task, data.boardScope, key); };
      board.append(col);
    });
  }
  function render() { renderHeader(); renderCalendar(); renderBoard(); }
  function changeStatus(task, scope, status) {
    const old = task.status; task.status = status;
    const ok = persist(); render();
    savedToast(ok, `${STATUS[status]}으로 옮겼어.`, () => { task.status = old; persist(); render(); });
  }
  function openEditor(item, scope, day, part) {
    editRef = item ? { id: item.id, scope } : null;
    const f = $('#task-form'); f.reset();
    $('#dialog-caption').textContent = item ? 'EDIT CARD' : 'NEW CARD';
    $('#dialog-title').textContent = item ? '일정 수정' : '삶에 하나 더하기';
    $('#edit-scope').textContent = scope === 'projects' ? '요일을 지정하면 선택한 주의 캘린더에도 올라가.' : `${dateLabel(data.weekKey)} 주간에만 반영돼. 다른 주는 바뀌지 않아.`;
    $('#delete-task').hidden = !item;
    f.elements.status.value = 'soon'; f.elements.kind.value = 'culture'; f.elements.day.value = scope === 'projects' ? '' : (day || data.day); f.elements.part.value = part || '오전';
    if (item) ['title', 'time', 'note', 'kind', 'status', 'day', 'part'].forEach(k => { f.elements[k].value = item[k] || (k === 'part' ? '오전' : ''); });
    [...f.elements.day.options].forEach(o => { o.disabled = !!o.value && !validDay(data.weekKey, o.value); });
    f.elements.title.setCustomValidity('');
    $('#task-dialog').showModal();
  }
  function saveForm(e) {
    e.preventDefault(); const f = e.currentTarget;
    const values = Object.fromEntries(new FormData(f)); values.title = values.title.trim();
    if (!values.title) { f.elements.title.setCustomValidity('할 일 이름을 적어줘.'); f.elements.title.reportValidity(); return; }
    if (values.day && !validDay(data.weekKey, values.day)) return;
    const scope = values.day ? 'week' : 'projects'; let base = {};
    if (editRef) { const oldList = listFor(editRef.scope), idx = oldList.findIndex(x => x.id === editRef.id); if (idx >= 0) base = oldList.splice(idx, 1)[0]; }
    const task = { ...base, ...values, id: base.id || `custom-${crypto.randomUUID()}` };
    if (scope === 'projects') { task.phase = data.phase; delete task.day; delete task.part; }
    else delete task.phase;
    listFor(scope).push(task); data.boardScope = scope;
    const ok = persist(); $('#task-dialog').close(); render();
    if (view === 'calendar' && scope === 'projects') setView('board');
    savedToast(ok, '카드를 저장했어.');
  }
  function deleteCurrent() {
    if (!editRef) return;
    const list = listFor(editRef.scope), idx = list.findIndex(x => x.id === editRef.id); if (idx < 0) return;
    const [removed] = list.splice(idx, 1), ok = persist(); $('#task-dialog').close(); render();
    savedToast(ok, '카드를 삭제했어.', () => { list.splice(idx, 0, removed); persist(); render(); });
  }
  function changeWeek(step) { const list = phaseWeeks(), idx = list.findIndex(w => w.key === data.weekKey), next = list[idx + step]; if (next) { data.weekKey = next.key; persist(); render(); } }
  function exportData() { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), a = document.createElement('a'); const url = URL.createObjectURL(blob); a.href = url; a.download = `new-season-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  async function importData(file) {
    try {
      if (file.size > 2000000) throw Error('크기');
      const next = validate(JSON.parse(await file.text()));
      if (!confirm('현재 브라우저의 기록을 이 백업으로 교체할까? 기존 기록은 먼저 백업해둬.')) return;
      data = clone(next); const ok = persist(); render(); savedToast(ok, '백업을 불러왔어.');
    } catch { warn('백업 형식이나 일정 데이터가 올바르지 않아. 기존 기록은 바꾸지 않았어.'); }
    finally { $('#import-file').value = ''; }
  }
  $$('.nav-item').forEach(b => b.onclick = () => setView(b.dataset.view));
  $('.brand').onclick = e => { e.preventDefault(); setView('calendar'); };
  $$('.phase-btn').forEach(b => b.onclick = () => { data.phase = b.dataset.phase; data.weekKey = phaseLastWeek[data.phase]; persist(); render(); });
  $('#week-select').onchange = e => { data.weekKey = e.target.value; persist(); render(); };
  $('#prev-week').onclick = () => changeWeek(-1); $('#next-week').onclick = () => changeWeek(1);
  $$('.segmented button').forEach(b => b.onclick = () => { data.boardScope = b.dataset.scope; persist(); renderBoard(); });
  $('#add-task').onclick = () => openEditor(null, view === 'calendar' ? 'week' : data.boardScope);
  $('#close-dialog').onclick = () => $('#task-dialog').close(); $('#task-form').onsubmit = saveForm;
  $('#task-form').elements.title.oninput = e => e.target.setCustomValidity('');
  $('#delete-task').onclick = deleteCurrent;
  $('#toast button').onclick = () => { if (undoAction) undoAction(); undoAction = null; $('#toast').classList.remove('is-visible'); };
  $('#export-data').onclick = exportData; $('#import-data').onclick = () => $('#import-file').click();
  $('#import-file').onchange = e => { if (e.target.files[0]) importData(e.target.files[0]); };
  window.addEventListener('storage', e => { if (e.key !== KEY || !e.newValue) return; try { data = validate(JSON.parse(e.newValue)); render(); toast('다른 탭에서 바꾼 기록을 반영했어.'); } catch { warn('다른 탭의 기록 형식을 확인할 수 없어.'); } });
  render(); setView(view); if (loadIssue) warn(loadIssue);
})();

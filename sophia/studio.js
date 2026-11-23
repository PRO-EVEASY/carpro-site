(function studioApp() {
  'use strict';

  const app = document.querySelector('#main');
  const dialog = document.querySelector('#dialog');
  const dialogTitle = document.querySelector('#dialog-title');
  const dialogBody = document.querySelector('#dialog-body');
  const state = window.Sophia;
  const views = ['overview', 'programs', 'library', 'customers'];
  const icons = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 9 9 5 9-5" transform="translate(0 -1) scale(1 .94)"/>',
    video: '<rect x="2.5" y="4.5" width="19" height="15" rx="3"/><path d="m10 9 5 3-5 3z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M2.5 20c0-4 2.5-6 6.5-6s6.5 2 6.5 6m0-14a3 3 0 0 1 0 6m2 3c2.6.7 4 2.3 4 5"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M4 21c0-4.5 3-7 8-7s8 2.5 8 7"/>',
    external: '<path d="M13 4H5v15h15v-8m-4-7h5v5m0-5-10 10"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    left: '<path d="m14.5 5-7 7 7 7"/>',
    home: '<path d="m2.5 11 9.5-8 9.5 8M5 9v12h14V9m-9 12v-7h4v7"/>',
    gym: '<path d="M2 10v4m3-8v12m3-10v8m0-4h8m0-4v8m3-10v12m3-8v4"/>',
    edit: '<path d="M4 20l4.4-1L20 7.5 16.5 4 5 15.6 4 20Zm10.7-14.2 3.5 3.5"/>',
    upload: '<path d="M12 15V3m-4.5 4.5L12 3l4.5 4.5M4 15v5h16v-5"/>',
    play: '<path d="m8 4 12 8-12 8V4Z"/>',
    file: '<path d="M14 3H5v18h14V8Zm0 0v5h5m-10 4h6m-6 4h5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  };
  const strokes = [0, 1, 2, 3, 4, 5].map(n => `<path d="M-45 ${155 + n * 10} C60 ${138 + n * 12} 94 ${148 - n * 18} 141 ${90 - n * 9} S226 ${16 + n * 4} 339 ${61 + n * 9} S479 ${22 + n * 11} 520 ${-14 + n * 15}"/>`).join('');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const glyph = name => `<svg aria-hidden="true" viewBox="0 0 24 24">${icons[name] || ''}</svg>`;
  const tile = name => `<span class="tile">${glyph(name)}</span>`;
  const action = (id, title, icon, variant = 'text-button', attrib = '') => `<button type="button" class="${variant}" data-action="${id}" ${attrib}>${icon ? glyph(icon) : ''}${esc(title)}</button>`;
  const pill = active => `<span class="pill${active ? '' : ' off'}">${active ? 'גישה פעילה' : 'גישה מושהית'}</span>`;
  document.querySelectorAll('i[data-icon]').forEach(el => { el.innerHTML = glyph(el.dataset.icon); });

  if (!state) {
    app.innerHTML = '<h1>טעינת הסטודיו נכשלה</h1><p class="support">אפשר לטעון מחדש את הדף ולנסות שוב.</p>';
    return;
  }
  if (new URLSearchParams(location.search).get('tour')==='studio') {
    const link=document.querySelector('.other-nav a:last-child');
    link.href='presentation.html#studio';
    link.querySelector('span').textContent='חזרה לסיור';
  }
  let programId = '';
  let userFilter = 'all';
  let userQuery = '';
  let mediaFilter = 'all';
  let mediaState = 'all';
  let media = new Map();
  let stateSnapshot = '';
  let dbPromise;
  let mediaError = false;
  let mediaChangedDuringDialog = false;
  let objectUrl = '';
  let noticeTimer;
  let dialogTrigger;
  let savedLesson;
  const programs = () => state.programs();
  const customers = () => state.customers();
  const byId = id => programs().find(p => p.id === id);
  const viewId = () => {
    const hash = location.hash.slice(1).split('/')[0];
    return views.includes(hash) ? hash : 'overview';
  };
  const programIcon = p => p.id.startsWith('gym') ? 'gym' : 'home';
  const duration = s => Number(s.minutes)<1 ? `${Math.round(Number(s.minutes)*60)} שניות` : `${esc(s.minutes)} דק׳`;
  const keyFor = (p, s) => `${p}/${s}`;
  const orderedWeek = sessions => [...new Set(sessions.map(s => Number(s.week) || 1))].sort((a,b) => a-b);
  function dateLabel(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? esc(value) : esc(new Intl.DateTimeFormat('he-IL', {day:'numeric',month:'short',year:'numeric'}).format(date));
  }
  function showNotice(message) {
    clearTimeout(noticeTimer);
    document.querySelector('#notice').textContent = message;
    noticeTimer = setTimeout(() => { document.querySelector('#notice').textContent = ''; }, 4800);
  }
  function pageHead(en, title, rhs = '') {
    return `<div class="page-head"><div><p class="eyebrow" lang="en" dir="ltr">${en}</p><h1>${title}</h1></div>${rhs}</div>`;
  }
  function metric(title, number, icon) {
    return `<div class="metric"><div><div class="metric-title">${title}</div><strong>${number}</strong></div>${tile(icon)}</div>`;
  }
  function programRow(p) {
    return `<a class="program-row" href="#programs/${encodeURIComponent(p.id)}"><img class="program-thumb" src="assets/${encodeURIComponent(p.id)}.webp" alt="" loading="lazy"><div class="row-text"><h3>${esc(p.name)}</h3><p>${p.sessions.length} אימונים · ${orderedWeek(p.sessions).length} שבועות</p></div>${glyph('left')}</a>`;
  }
  function purchaseRow(c) {
    return `<div class="purchase-row"><div class="row-text"><h3>${esc(c.name)}</h3><p>${esc(byId(c.programId)?.name || '')}</p></div>${pill(c.active)}</div>`;
  }
  function overview() {
    const list = programs();
    const people = customers();
    const latest = [...people].sort((a,b) => (Date.parse(b.date)||0) - (Date.parse(a.date)||0)).slice(0,4);
    const lessonCount = list.reduce((n,p) => n + p.sessions.length, 0);
    return pageHead('STUDIO OVERVIEW','סקירת הסטודיו', action('add','הוספת אימון','plus','button')) +
      `<section class="hero"><div><p class="eyebrow" lang="en" dir="ltr">SOPHIA DIGITAL</p><h2>שלום, סופיה.</h2><p>התוכניות, האימונים והמתאמנות שלך במקום אחד.</p><div class="hero-actions"><a class="hero-link" href="#programs">לעריכת התוכניות</a></div></div><div class="hero-art" aria-hidden="true"><svg viewBox="0 0 500 200" preserveAspectRatio="xMidYMid slice">${strokes}</svg></div></section>` +
      `<div class="metrics">${metric('תוכניות אימון',list.length,'layers')}${metric('אימונים בקטלוג',lessonCount,'video')}${metric('הרשאות פעילות',people.filter(c=>c.active).length,'users')}</div>` +
      `<div class="overview-grid"><section class="panel"><div class="section-title"><h2>התוכניות שלי</h2><a class="text-button" href="#programs">לכל התוכניות ${glyph('left')}</a></div>${list.map(programRow).join('')}</section><section class="panel"><div class="section-title"><h2>רכישות אחרונות</h2><a class="text-button" href="#customers">לכל הרכישות ${glyph('left')}</a></div>${latest.length ? latest.map(purchaseRow).join('') : '<div class="empty purchases-empty"><p>הרכישות יופיעו כאן אחרי הרשמה לתוכנית.</p><a class="text-button" href="index.html">לאתר המכירות</a></div>'}</section></div>`;
  }
  const options = (list, selected, makeLabel) => list.map(item => `<option value="${esc(item.id)}"${item.id === selected ? ' selected' : ''}>${esc(makeLabel(item))}</option>`).join('');
  const attribs = (pid, sid) => `data-program="${esc(pid)}" data-session="${esc(sid)}"`;
  function programPage() {
    const list = programs();
    const hashId = location.hash.split('/')[1];
    const p = byId(hashId) || byId(programId) || list[0];
    if (!p) return pageHead('PROGRAMS','תוכניות ואימונים') + '<p class="empty">עדיין אין תוכניות בקטלוג.</p>';
    programId = p.id;
    const weekly = orderedWeek(p.sessions).map(week => {
      const rows = p.sessions.filter(s => (Number(s.week) || 1) === week).map((s,i) => {
        const override = media.has(keyFor(p.id,s.id));
        const detail = override ? 'סרטון מהסטודיו' : duration(s)+(s.videoUrl ? ' · וידאו משויך' : ' · ממתין לסרטון');
        return `<div class="lesson-row"><span class="index">${String(i+1).padStart(2,'0')}</span><div class="row-text"><div class="lesson-title">${esc(s.title)}</div><p>${detail}</p></div>${action('rename','עריכה','edit','text-button',attribs(p.id,s.id)+' aria-label="עריכה של '+esc(s.title)+'"')}</div>`;
      }).join('');
      return `<section class="week"><h3>שבוע ${esc(week)}</h3>${rows}</section>`;
    }).join('');
    return pageHead('TRAINING PROGRAMS','תוכניות ואימונים',action('add','הוספת אימון','plus','button')) +
      `<div class="panel"><div class="section-title program-select"><label for="program-select">בחירת תוכנית</label><select id="program-select">${options(list,p.id,x=>x.name)}</select></div><div class="course-summary">${tile(programIcon(p))}<div class="row-text"><h2>${esc(p.name)}</h2><p>${p.sessions.length} אימונים · ${orderedWeek(p.sessions).length} שבועות</p></div></div>${weekly || '<p class="empty">אפשר להוסיף אימון ראשון לתוכנית.</p>'}</div>`;
  }
  function customersPage() {
    const filters = [['all','כל ההרשאות'],['active','פעילות'],['paused','מושהות']].map(([id,label]) =>
      `<button class="chip" type="button" data-action="user-filter" data-filter="${id}" aria-pressed="${id===userFilter}">${label}</button>`).join('');
    const matches = customers().filter(c =>
      (userFilter === 'all' || (userFilter === 'active') === Boolean(c.active)) &&
      (`${c.name} ${byId(c.programId)?.name || ''}`).toLocaleLowerCase().includes(userQuery.toLocaleLowerCase())
    ).sort((a,b) => (Date.parse(b.date)||0) - (Date.parse(a.date)||0));
    const rows = matches.map(c => {
      const price = Number.isFinite(c.price) ? `<small class="demo-price">מחיר הדגמה · ${esc(new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',minimumFractionDigits:0,maximumFractionDigits:2}).format(c.price))}</small>` : '';
      return `<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(byId(c.programId)?.name || '')}${price}</td><td>${dateLabel(c.date)}</td><td>${pill(c.active)}</td><td>${action('toggle',c.active?'השהיית גישה':'הפעלת גישה','','access-button',`data-customer="${esc(c.id)}" aria-label="${c.active?'השהיית גישה':'הפעלת גישה'} עבור ${esc(c.name)} לתוכנית ${esc(byId(c.programId)?.name || '')}"`)}</td></tr>`;
    }).join('');
    return pageHead('MEMBERS &amp; PURCHASES','רכישות והרשאות') +
      `<section class="panel"><div class="section-title"><h2>גישת מתאמנות לתוכניות</h2><span class="pill muted">${matches.length} רשומות</span></div>
      <form class="search-row" id="customer-search"><label class="sr-only" for="user-query">חיפוש לפי שם או תוכנית</label><input id="user-query" type="search" placeholder="חיפוש לפי שם או תוכנית" value="${esc(userQuery)}"><button class="soft" type="submit">חיפוש</button>${userQuery ? action('clear-search','ניקוי','', 'text-button') : ''}</form>
      <div class="chips" aria-label="סינון הרשאות">${filters}</div><div class="table-scroll"><table><caption class="sr-only">רכישות הדגמה ומצב הגישה לכל תוכנית</caption><thead><tr><th scope="col">שם</th><th scope="col">תוכנית</th><th scope="col">תאריך הצטרפות</th><th scope="col">הרשאה</th><th scope="col">פעולה</th></tr></thead><tbody>${rows}</tbody></table>${rows ? '' : '<p class="empty">לא נמצאו רשומות מתאימות.</p>'}</div></section>`;
  }
  function libraryPage() {
    const list = programs();
    const filtered = mediaFilter === 'all' ? list : list.filter(p => p.id === mediaFilter);
    const states = [['all','כל האימונים'],['ready','עם סרטון'],['pending','ממתינים לסרטון']];
    const filters = states.map(([id,label]) => `<button class="chip" type="button" data-action="media-state" data-filter="${id}" aria-pressed="${mediaState===id}">${label}</button>`).join('');
    const sections = filtered.map(p => {
      const rows = p.sessions.filter(s => {
        const hasVideo = Boolean(s.videoUrl || media.has(keyFor(p.id,s.id)));
        return mediaState === 'all' || (mediaState === 'ready') === hasVideo;
      }).map(s => {
        const entry = media.get(keyFor(p.id,s.id));
        const ready = Boolean(entry || s.videoUrl);
        const attrs = attribs(p.id,s.id);
        const source = entry ? esc(entry.filename) : !ready ? 'ממתין לסרטון' : s.demo ? 'שיעור הדגמה מובנה' : 'זמין לצפייה';
        return `<div class="video-row">${tile(ready?'play':'video')}<div class="row-text"><h3>${esc(s.title)}</h3><p>שבוע ${esc(s.week)} · ${entry ? '' : duration(s)+' · '}${source}</p></div><div class="actions">${ready ? action('play','צפייה','play','text-button',attrs) : ''}${action('upload',ready ? 'החלפה' : 'צירוף וידאו','upload','text-button',attrs)}</div></div>`;
      }).join('');
      return rows ? `<section class="media-course"><h2>${esc(p.name)}</h2>${rows}</section>` : '';
    }).join('');
    return pageHead('VIDEO LIBRARY','ספריית וידאו') +
      `<section class="panel"><div class="section-title"><h2>סרטוני האימונים</h2><div class="program-select"><label for="media-select" class="sr-only">סינון לפי תוכנית</label><select id="media-select"><option value="all">כל התוכניות</option>${options(list,mediaFilter,p=>p.name)}</select></div></div>
      <p class="section-copy">${mediaError ? 'הדפדפן חסם את אחסון הקבצים. אפשר לנסות בדפדפן שתומך באחסון מקומי.' : 'כל סרטון שתצרפי לאימון יהיה זמין לצפייה גם באזור המתאמנת בדפדפן הזה.'}</p><div class="chips" role="group" aria-label="סינון לפי מצב הסרטון">${filters}</div>${sections || '<p class="empty">אין אימונים המתאימים לסינון הזה.</p>'}</section>`;
  }
  const snapshot = () => JSON.stringify([programs(),customers()]);

  function render() {
    const view = viewId();
    document.querySelectorAll('[data-view]').forEach(a => {
      if (a.dataset.view === view) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
    const pages = {overview,programs:programPage,library:libraryPage,customers:customersPage};
    app.innerHTML = pages[view]();
    stateSnapshot = snapshot();
    document.title = `${app.querySelector('h1')?.textContent || 'Sophia Studio'} · Sophia Studio`;
  }
  function openDialog(title, body) {
    dialogTrigger = document.activeElement;
    dialogTitle.textContent = title;
    dialogBody.innerHTML = body;
    dialog.showModal();
  }
  function formButtons(title) {
    return `<p class="form-error" role="alert"></p><div class="form-actions"><button type="submit" class="button">${title}</button>${action('close','ביטול','','soft')}</div>`;
  }
  function addDialog() {
    const list = programs();
    const id = byId(programId)?.id || list[0]?.id;
    if (!id) return;
    openDialog('הוספת אימון',`<form class="form" id="add-form">
      <label class="field">תוכנית<select name="program" required>${options(list,id,p=>p.name)}</select></label>
      <label class="field">שם האימון<input name="title" type="text" maxlength="85" required placeholder="לדוגמה, אימון כוח לכל הגוף"></label>
      <div class="pair"><label class="field">שבוע<input name="week" type="number" min="1" max="52" value="1" required></label><label class="field">משך בדקות<input name="minutes" type="number" min="1" max="240" value="30" required></label></div>${formButtons('הוספת האימון')}</form>`);
  }
  function editDialog(pid,sid) {
    const p = byId(pid);
    const s = p?.sessions.find(item=>item.id===sid);
    if (!s) return;
    openDialog('עריכת שם האימון',`<form class="form" id="edit-form" ${attribs(pid,sid)}><p class="support">${esc(p.name)} · שבוע ${esc(s.week)}</p><label class="field">שם האימון<input name="title" value="${esc(s.title)}" maxlength="85" required></label>${formButtons('שמירת השינוי')}</form>`);
  }
  function database() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve,reject) => {
      const request = indexedDB.open('sophia-studio-media-v1',1);
      request.onupgradeneeded = () => { request.result.createObjectStore('sessions',{keyPath:'key'}); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('media storage blocked'));
    });
    return dbPromise;
  }
  async function readMedia() {
    const db = await database();
    return new Promise((resolve,reject) => {
      const req = db.transaction('sessions').objectStore('sessions').getAll(IDBKeyRange.upperBound('\uffff',true));
      req.onsuccess = () => resolve(new Map(req.result.map(m=>[m.key,m])));
      req.onerror = () => reject(req.error);
    });
  }
  async function storeMedia(record) {
    const db = await database();
    // Keep large byte buffers outside the range used to list the library.
    const bytesKey='\uffffbytes/'+record.key;
    function commit(value,bytes) {
      return new Promise((resolve,reject)=>{
        const tx=db.transaction('sessions','readwrite');
        tx.oncomplete=()=>resolve(value);
        tx.onerror=tx.onabort=event=>reject(tx.error || event.target.error);
        const store=tx.objectStore('sessions');
        try {
          store.put(value);
          if (bytes) store.put({key:bytesKey,bytes});
          else store.delete(bytesKey);
        } catch (e) { tx.abort(); reject(e); }
      });
    }
    try { return await commit(record); }
    catch (e) {
      if (!['UnknownError','DataCloneError'].includes(e?.name)) throw e;
      // Some WebKit data stores accept ArrayBuffer but cannot persist File or Blob.
      const bytes=await record.file.arrayBuffer();
      return commit({key:record.key,filename:record.filename,type:record.file.type,bytesKey},bytes);
    }
  }
  async function mediaFile(entry) {
    if (entry.file instanceof Blob) return entry.file;
    const db=await database();
    return new Promise((resolve,reject)=>{
      const req=db.transaction('sessions').objectStore('sessions').get(entry.bytesKey);
      req.onerror=()=>reject(req.error);
      req.onsuccess=()=>req.result?.bytes instanceof ArrayBuffer ? resolve(new Blob([req.result.bytes],{type:entry.type})) : reject(new Error('Missing video data'));
    });
  }
  function uploadDialog(pid,sid) {
    const s = byId(pid)?.sessions.find(item=>item.id===sid);
    if (!s) return;
    openDialog('צירוף סרטון לאימון',`<form id="upload-form" class="form" ${attribs(pid,sid)}><p class="support">${esc(s.title)} · קובץ מקומי לסביבת ההדגמה</p><label class="field">קובץ וידאו<input name="file" type="file" accept="video/*,.mp4,.webm,.mov,.m4v" required></label>${formButtons('שמירת הסרטון')}</form>`);
  }
  async function previewVideo(pid,sid) {
    const entry = media.get(keyFor(pid,sid));
    const s = byId(pid)?.sessions.find(item=>item.id===sid);
    if (!s || (!entry && !s.videoUrl)) return;
    openDialog(s.title,'<video controls playsinline></video><p class="form-error" role="alert"></p>');
    const v = dialogBody.querySelector('video');
    const error = dialogBody.querySelector('.form-error');
    v.setAttribute('aria-label',s.title);
    v.addEventListener('error',()=>{ error.textContent='הדפדפן לא הצליח לנגן את הקובץ. אפשר להחליף אותו בסרטון MP4 או WebM נתמך.'; });
    try {
      if (entry) {
        const file=await mediaFile(entry);
        if (!dialog.open || !v.isConnected) return;
        objectUrl=URL.createObjectURL(file);
      }
      const source = objectUrl || s.videoUrl;
      const info = state.configureLessonVideo(v,source);
      if (info) {
        const details=document.createElement('details');
        const summary=document.createElement('summary');
        const description=document.createElement('p');
        summary.textContent='הנחיות התרגול בטקסט';
        description.textContent=info.transcript;
        details.className='studio-transcript';
        details.append(summary,description);
        v.after(details);
      }
      v.src = source;
    } catch { error.textContent='טעינת הסרטון מהאחסון המקומי נכשלה. אפשר לצרף אותו מחדש.'; }
  }
  function navigateProgram(pid) {
    programId = pid;
    const hash = `#programs/${encodeURIComponent(pid)}`;
    if (location.hash === hash) render();
    else location.hash = hash;
  }
  document.addEventListener('change', event => {
    const el = event.target;
    if (el.id === 'program-select') navigateProgram(el.value);
    if (el.id === 'media-select') { mediaFilter = el.value; render(); document.querySelector('#media-select').focus(); }
  });
  document.addEventListener('click', event => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const {action:cmd,program:pid,session:sid} = el.dataset;
    if (cmd === 'close') dialog.close();
    if (cmd === 'add') addDialog();
    if (cmd === 'rename') editDialog(pid,sid);
    if (cmd === 'upload') uploadDialog(pid,sid);
    if (cmd === 'play') previewVideo(pid,sid);
    if (cmd === 'clear-search') { userQuery=''; render(); document.querySelector('#user-query').focus(); }
    if (cmd === 'media-state') {
      mediaState = el.dataset.filter;
      render();
      document.querySelector(`[data-action="media-state"][data-filter="${mediaState}"]`).focus();
    }
    if (cmd === 'user-filter') {
      userFilter=el.dataset.filter;
      render();
      document.querySelector(`[data-filter="${userFilter}"]`).focus();
    }
    if (cmd === 'toggle') {
      const c = customers().find(x => String(x.id) === el.dataset.customer);
      if (!c) return;
      const enabled = !c.active;
      state.setAccess(c.id,enabled);
      render();
      [...document.querySelectorAll('[data-customer]')].find(b=>b.dataset.customer===String(c.id))?.focus();
      if (document.activeElement === document.body) document.querySelector('[data-action="user-filter"][aria-pressed="true"]')?.focus();
      showNotice(enabled ? 'הגישה לתוכנית הופעלה.' : 'הגישה לתוכנית הושהתה.');
    }
  });
  document.addEventListener('submit',async event => {
    const form = event.target;
    event.preventDefault();
    if (form.id === 'customer-search') {
      userQuery=document.querySelector('#user-query').value.trim();
      render();
      document.querySelector('#user-query').focus();
      return;
    }
    if (!['add-form','edit-form','upload-form'].includes(form.id)) return;
    const fields = new FormData(form);
    const error = form.querySelector('.form-error');
    const button = form.querySelector('[type=submit]');
    const {program:pid,session:sid} = form.dataset;
    const title = String(fields.get('title') || '').trim();
    if (form.id !== 'upload-form' && !title) {
      error.textContent='יש להזין שם לאימון.';
      form.elements.title.focus();
      return;
    }
    button.disabled=true;
    try {
      if (form.id === 'add-form') {
        const selected = String(fields.get('program'));
        const id=state.addSession(selected,{title,week:Number(fields.get('week')),minutes:Number(fields.get('minutes'))});
        programId=selected;
        const url=new URL(location.href);
        url.hash='programs/'+encodeURIComponent(selected);
        if (location.href!==url.href) history.pushState(null,'',url);
        render();
        savedLesson=id;
        showNotice('האימון נוסף לתוכנית.');
      }
      if (form.id === 'edit-form') {
        state.setSessionTitle(pid,sid,title);
        render();
        showNotice('שם האימון עודכן.');
      }
      if (form.id === 'upload-form') {
        const file=fields.get('file');
        if (!file || !file.size || (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name))) {
          error.textContent='יש לבחור קובץ וידאו תקין.';
          return;
        }
        const record={key:keyFor(pid,sid),file,filename:file.name};
        const saved=await storeMedia(record);
        media.set(record.key,saved);
        try { localStorage.setItem('sophia.media-change.v1',String(Date.now())); } catch {}
        mediaError=false;
        render();
        showNotice('הסרטון נשמר ושויך לאימון.');
      }
      dialog.close();
    } catch {
      error.textContent=form.id==='upload-form' ? 'שמירת הסרטון נכשלה. כדאי לבדוק מקום פנוי והרשאות אחסון בדפדפן.' : 'השינוי לא נשמר. אפשר לנסות שוב.';
    } finally {
      button.disabled=false;
    }
  });
  dialog.addEventListener('close',() => {
    const player = dialogBody.querySelector('video');
    if (player) { player.pause(); player.removeAttribute('src'); player.load(); }
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl=''; }
    dialogBody.innerHTML='';
    if (snapshot() !== stateSnapshot || mediaChangedDuringDialog) render();
    mediaChangedDuringDialog=false;
    if (savedLesson) {
      const edited = [...app.querySelectorAll('[data-action="rename"]')].find(b=>b.dataset.session===savedLesson);
      edited?.focus();
      savedLesson=null;
    } else if (dialogTrigger && !dialogTrigger.isConnected) {
      const restored = [...app.querySelectorAll('[data-action]')].find(b =>
        b.dataset.action === dialogTrigger.dataset.action && b.dataset.program === dialogTrigger.dataset.program && b.dataset.session === dialogTrigger.dataset.session
      );
      (restored || app.querySelector('[aria-pressed="true"]') || app).focus({preventScroll:true});
    }
    dialogTrigger=null;
  });
  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo({top:0});
    app.focus({preventScroll:true});
  });
  async function refreshMedia() {
    try {
      media = await readMedia();
      mediaError = false;
    } catch {
      mediaError = true;
    }
    if (['programs','library'].includes(viewId())) {
      if (dialog.open) mediaChangedDuringDialog=true;
      else render();
    }
  }
  window.addEventListener('storage',event => {
    if (event.key === 'sophia.media-reset.v1') {
      if (dialog.open) dialog.close();
      media.clear();
      render();
      refreshMedia();
      showNotice('נתוני ההדגמה אופסו בדפדפן הזה.');
    } else if (event.key === 'sophia.media-change.v1') {
      refreshMedia();
    } else if (!dialog.open && snapshot() !== stateSnapshot) render();
  });
  window.addEventListener('pageshow',event => {
    if (event.persisted && !dialog.open) {
      render();
      refreshMedia();
    }
  });
  render();
  refreshMedia();
})();


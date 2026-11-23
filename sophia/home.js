(() => {
  'use strict';

  const api = window.Sophia;
  const $ = selector => document.querySelector(selector);
  const dialog = $('#overlay');
  const body = $('#dialog-body');
  const photos = {
    'home-1': 'מתיחת צד על מזרן בסטודיו ביתי',
    'gym-1': 'אימון משקולות בחדר כושר',
    'home-2': 'משקולות ומזרן אימון באור בוקר',
    'gym-2': 'אחיזה במשקולת בחדר הכושר'
  };
  const icons = {
    user: '<circle cx="12" cy="8" r="3.3"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    chevron: '<path d="m14.5 6-6 6 6 6"/>',
    compare: '<path d="M4 6h16M4 18h16"/><circle cx="8" cy="6" r="2.5" fill="var(--paper)"/><circle cx="16" cy="18" r="2.5" fill="var(--paper)"/>'
  };
  document.querySelectorAll('[data-icon]').forEach(node => {
    node.className = 'ui-icon';
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = '<svg viewBox="0 0 24 24">' + icons[node.dataset.icon] + '</svg>';
  });

  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[char]);
  const programs = () => api.programs();
  const program = id => programs().find(p => p.id === id);
  const openingSession = p => p?.sessions.find(s => s.videoUrl === 'assets/shoulder-warmup.mp4');
  const weeks = p => new Set(p.sessions.map(session => session.week)).size;
  const duration = minutes => minutes < 1 ? Math.round(minutes * 60) + ' שניות' : minutes + ' דקות';
  function workoutLength(p) {
    const minutes = p.sessions.map(session => session.minutes).filter(n => n >= 1);
    if (!minutes.length) return duration(p.sessions[0]?.minutes || p.minutes);
    const shortest = Math.min(...minutes), longest = Math.max(...minutes);
    const range = shortest === longest ? shortest : shortest + '–' + longest;
    return '<bdi dir="ltr">' + range + '</bdi> דק׳';
  }

  let filter = 'הכול';
  let route = null;
  let opener = null;
  let clickedOpener = null;
  let directProgram = false;
  document.addEventListener('click', event => {
    if (!dialog.open) clickedOpener = event.target.closest('#cards [data-plan], #find-plan, #faq-finder, #compare, #sample-class, #coach, #film');
  }, true);
  let restoring = false;
  function catalog() {
    const items = programs().filter(p => filter === 'הכול' || p.place === filter);
    $('#results').textContent = items.length + ' תוכניות';
    $('#cards').innerHTML = items.map(p => `
      <a class="card" data-plan="${p.id}" href="?program=${p.id}">
        <div class="card-photo">
          <img src="assets/${p.id}.webp" width="768" height="512" loading="lazy" alt="">
          <span class="card-tag">${safe(p.level)}</span>
        </div>
        <div class="card-info">
          <span class="edition" dir="ltr" lang="en">${safe(p.edition)}</span>
          <strong class="card-name">${safe(p.name)}</strong>
          <span class="card-meta">${weeks(p)} שבועות · ${workoutLength(p)} לאימון</span>
          <span class="card-kit">${safe(p.equipment)}</span>
          <span class="card-base">לפרטי התוכנית <i aria-hidden="true">←</i></span>
        </div>
      </a>`).join('');
    document.querySelectorAll('[data-filter]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
  }

  function routeUrl(next) {
    const url = new URL(location.href);
    if (next?.id) url.searchParams.set('program', next.id);
    else url.searchParams.delete('program');
    return url;
  }

  function storeRoute(next, replace = false) {
    const current = history.state?.sophiaStore;
    const depth = replace && current ? current.depth : (current?.depth || 0) + 1;
    const state = { ...history.state, sophiaStore:{route:next,depth} };
    const method = replace ? 'replaceState' : 'pushState';
    try { history[method](state, '', routeUrl(next)); }
    catch { try { history[method](state, ''); } catch {} }
  }

  function show(markup, next, replace = false) {
    if (!restoring && (!route || JSON.stringify(route) !== JSON.stringify(next))) storeRoute(next, replace);
    if (!dialog.open) {
      directProgram = !clickedOpener && next.type === 'detail';
      opener = clickedOpener || (directProgram && document.querySelector('#cards [data-plan="' + next.id + '"]')) || document.activeElement;
      clickedOpener = null;
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    }
    route = next;
    dialog.removeAttribute('data-keyboard');
    dialog.dataset.view = next.type;
    body.querySelector('video')?.pause();
    body.innerHTML = markup;
    dialog.scrollTop = 0;
    const title = $('#dialog-title');
    title.tabIndex = -1;
    title.focus({preventScroll:true});
  }

  function dismiss() {
    const depth = history.state?.sophiaStore?.depth;
    if (depth) history.go(-depth);
    else hideDialog();
  }
  function hideDialog() {
    if (!dialog.open) return;
    dialog.close();
    restoreOpener();
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
  dialog.querySelector('.modal-x').addEventListener('click', dismiss);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss();
  });
  function restoreOpener() {
    if (dialog.open) return;
    body.querySelector('video')?.pause();
    body.replaceChildren();
    route = null;
    document.body.style.overflow = '';
    if (opener?.isConnected) opener.focus({preventScroll:!directProgram});
    opener = null;
    directProgram = false;
  }
  dialog.addEventListener('close', restoreOpener);

  function detail(id, match = false) {
    const p = program(id);
    if (!p) return;
    const first = p.sessions.filter(s => s.week === 1);
    const enrolled = api.enrolled().includes(id);
    const paused = api.customers().some(order => order.programId === id && !order.active);
    const sample = openingSession(p);
    const action = enrolled ? `<a class="btn btn-ink" href="member.html?program=${id}">לאימון שלי</a>` :
      paused ? '<span class="modal-note">הגישה לתוכנית מושהית בדמו.</span>' :
      '<button type="button" data-action="checkout" class="btn btn-ink">להצטרפות לתוכנית</button>';
    show(`<article class="course-preview">
      <figure class="course-image">
        <img src="assets/${id}.webp" width="768" height="512" alt="${photos[id]}">
        <figcaption lang="en" dir="ltr">${safe(p.edition)}</figcaption>
      </figure>
      <div class="course-content">
        <h2 id="dialog-title">${safe(p.name)}<span class="dot">.</span></h2>
        ${match ? '<p class="match-note">מתאימה למקום ולרמה שבחרת.</p>' : ''}
        <p class="course-description">${safe(p.description)}</p>
        <dl class="course-facts">
          <div><dt>רמת ניסיון</dt><dd>${safe(p.level)}</dd></div>
          <div><dt>משך התוכנית</dt><dd>${weeks(p)} שבועות</dd></div>
          <div><dt>אורך אימון</dt><dd>${workoutLength(p)}</dd></div>
        </dl>
        <p class="course-equipment"><strong>ציוד</strong> ${safe(p.equipment)}</p>
        <details class="week"><summary>הצצה לשבוע הראשון</summary><ul class="syllabus">
        ${first.map(s => `<li><span>${safe(s.title)}</span><small>${duration(s.minutes)}</small></li>`).join('')}</ul>
        <small class="syllabus-total">${p.sessions.length} אימונים בתוכנית המלאה</small></details>
        ${sample ? `<button type="button" class="sample-link" data-action="sample"><span class="sample-play" aria-hidden="true"></span><span><strong>נסי את שיעור הפתיחה</strong><small>${safe(sample.title)} · ${duration(sample.minutes)}</small></span></button>` : ''}
        <div class="modal-foot product-action">${action}<div><strong class="price" dir="ltr">₪${p.price}</strong><small class="demo-price">מחיר בדמו · ללא חיוב</small></div></div>
        <div class="course-share"><button type="button" data-action="share">שיתוף התוכנית</button><span role="status"></span></div>
        <label class="manual-link" hidden>קישור להעתקה ידנית<input type="text" dir="ltr" readonly></label>
      </div></article>`, {type:'detail', id, match});
  }

  async function shareProgram(id) {
    const status = body.querySelector('.course-share [role=status]');
    const manual = body.querySelector('.manual-link');
    const relative = 'index.html?program=' + encodeURIComponent(id);
    const online = /^https?:$/.test(location.protocol);
    const url = online ? new URL(relative,location.href).href : relative;
    manual.hidden = true;
    status.textContent = '';
    if (online && navigator.share) {
      try { await navigator.share({title:program(id).name + ' · SOPHIA DIGITAL',url}); return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = 'הקישור הועתק.';
    } catch {
      if (!manual.isConnected) return;
      manual.hidden = false;
      const input = manual.querySelector('input');
      input.value = url;
      input.focus();
      input.select();
    }
  }

  function checkout(id) {
    const p = program(id);
    const name = api.currentName();
    show(`<div class="modal-pad checkout-pad"><div class="eyebrow" dir="ltr" lang="en">Studio Checkout</div>
      <h2 id="dialog-title">הצטרפות לתוכנית<span class="dot">.</span></h2>
      <p class="order-summary"><span>${safe(p.name)} · ${safe(p.level)}</span><strong class="price" dir="ltr">₪${p.price}</strong></p>
      <div class="purchase-layout"><form id="purchase"><label>שם שיופיע באזור האישי<input type="text" name="name" maxlength="45" placeholder="אפשר לבחור שם לדוגמה" value="${name === 'אורחת' ? '' : safe(name)}" autocomplete="off" enterkeyhint="done" required></label>
      <p class="modal-note">רכישת הדגמה ללא חיוב. אין צורך בפרטי אשראי.</p>
      <button class="btn btn-rose" type="submit">אישור רכישת הדגמה</button>
      <p class="error" role="status" id="order-status"></p></form><button type="button" class="purchase-decline" data-action="decline">בדיקת תשלום שנדחה</button></div></div>`, {type:'checkout', id});
    $('#purchase').addEventListener('submit', event => {
      event.preventDefault();
      const label = event.currentTarget.elements.name.value.trim();
      if (!label) { $('#order-status').textContent = 'הזיני שם לדוגמה כדי להמשיך.'; return; }
      try { api.enroll(id, label); confirmed(id); }
      catch (error) { $('#order-status').textContent = error.message; }
    });
  }

  // While the keyboard is visible, Safari pans the visual viewport inside the fixed layout viewport.
  const viewport = window.visualViewport;
  let keyboardFrame = 0;
  function fitCheckout() {
    keyboardFrame = 0;
    const field = body.querySelector('#purchase input[name=name]');
    const fieldWasActive = field && (field === document.activeElement || dialog.hasAttribute('data-keyboard'));
    const shown = Boolean(viewport && dialog.open && fieldWasActive &&
      Math.abs(viewport.scale - 1) < .04 && innerHeight - viewport.height > 100);
    dialog.toggleAttribute('data-keyboard', shown);
    if (shown) {
      // iOS can include the form accessory bar inside visualViewport.height.
      const room = Math.max(100, viewport.height - 66);
      dialog.style.setProperty('--keyboard-room', room + 'px');
      const top = viewport.offsetTop + 5 + Math.max(0, (room - dialog.offsetHeight) / 2);
      dialog.style.setProperty('--keyboard-top', top + 'px');
    }
  }
  function queueKeyboardFit() {
    if (!keyboardFrame) keyboardFrame = requestAnimationFrame(fitCheckout);
  }
  viewport?.addEventListener('resize', queueKeyboardFit);
  viewport?.addEventListener('scroll', queueKeyboardFit);
  dialog.addEventListener('focusin', queueKeyboardFit);
  dialog.addEventListener('focusout', queueKeyboardFit);

  function confirmed(id) {
    show(`<div class="modal-pad"><img width="56" height="52" src="assets/brand-trophy.png" alt="">
      <h2 id="dialog-title">האימון שלך פתוח<span class="dot">.</span></h2>
      <p>תוכנית ${safe(program(id).name)} מחכה לך באזור האישי. רכישת ההדגמה נשמרה בדפדפן הזה.</p>
      <div class="modal-foot"><a class="btn btn-ink" href="member.html?program=${id}">לאימון הראשון שלי</a><a class="text-link" href="studio.html">לסטודיו הניהול בדמו</a></div></div>`, {type:'confirmed',id}, true);
  }

  function finder(place = '', level = '') {
    show(`<div class="modal-pad"><div class="eyebrow" dir="ltr" lang="en">Program Finder</div>
      <h2 id="dialog-title">מה מתאים לך<span class="dot">?</span></h2><p>בחרי מקום ורמת ניסיון כדי למצוא את המסלול שלך.</p>
      <form id="finder"><fieldset><legend>איפה תרצי להתאמן?</legend><div class="choices"><label><input required type="radio" name="place" value="בית" ${place === 'בית' ? 'checked' : ''}>בבית</label><label><input type="radio" name="place" value="חדר כושר" ${place === 'חדר כושר' ? 'checked' : ''}>בחדר הכושר</label></div></fieldset>
      <fieldset><legend>מה רמת הניסיון שלך?</legend><div class="choices"><label><input required type="radio" name="level" value="מתחילות" ${level === 'מתחילות' ? 'checked' : ''}>בתחילת הדרך</label><label><input type="radio" name="level" value="מתקדמות" ${level === 'מתקדמות' ? 'checked' : ''}>יש לי ניסיון</label></div></fieldset>
      <button class="btn btn-ink">הציגי לי את התוכנית</button></form></div>`, {type:'finder', place, level});
    $('#finder').addEventListener('change', event => {
      const values = new FormData(event.currentTarget);
      route = { type:'finder', place:values.get('place') || '', level:values.get('level') || '' };
      storeRoute(route, true);
    });
    $('#finder').addEventListener('submit', event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const p = programs().find(p => p.place === values.get('place') && p.level === values.get('level'));
      if (p) detail(p.id, true);
    });
  }

  function compare(left, right) {
    const all = programs();
    const choices = all.filter(p => filter === 'הכול' || filter === p.place);
    const one = program(left) || choices[0];
    const two = program(right) || choices.find(p => p.id !== one.id) || all.find(p => p.id !== one.id);
    const options = (selected, other) => all.map(p => `<option value="${p.id}" ${p.id === selected.id ? 'selected' : ''} ${p.id === other.id ? 'disabled' : ''}>${safe(p.name)}</option>`).join('');
    const facts = [
      ['מקום', p => safe(p.place)], ['רמה', p => safe(p.level)], ['משך אימון', workoutLength],
      ['ציוד', p => safe(p.equipment)], ['משך התוכנית', p => weeks(p) + ' שבועות'],
      ['אימונים', p => p.sessions.length], ['מחיר בדמו', p => '<bdi>₪' + p.price + '</bdi>']
    ];
    const table = () => {
      const [a,b] = [...body.querySelectorAll('select')].map(select => program(select.value));
      $('#compare-table').innerHTML = `<thead><tr><th scope="col">מאפיין</th>${[a,b].map(p => `<th scope="col"><img class="compare-photo" src="assets/${p.id}.webp" width="144" height="70" alt="">${safe(p.name)}</th>`).join('')}</tr></thead>
        <tbody>${facts.map(([label, value]) => `<tr><th scope="row">${label}</th><td>${value(a)}</td><td>${value(b)}</td></tr>`).join('')}
        <tr><th scope="row">פרטים</th>${[a,b].map(p => `<td><a data-plan="${p.id}" href="?program=${p.id}" aria-label="לתוכנית ${safe(p.name)}">לתוכנית</a></td>`).join('')}</tr></tbody>`;
    };
    show(`<div class="modal-pad"><div class="eyebrow" dir="ltr" lang="en">Compare Programs</div>
      <h2 id="dialog-title">השוואת תוכניות<span class="dot">.</span></h2>
      <div class="compare-form"><label>תוכנית ראשונה<select name="one">${options(one,two)}</select></label><label>תוכנית שנייה<select name="two">${options(two,one)}</select></label></div>
      <table id="compare-table" class="compare-table" aria-label="השוואה בין שתי התוכניות שנבחרו"></table>
      <p class="demo-price">כל המחירים להמחשה. ההתנסות בדמו ללא חיוב.</p></div>`, {type:'compare', left:one.id, right:two.id});
    table();
    $('#dialog-body .compare-form').addEventListener('change', () => {
      const [a,b] = [...body.querySelectorAll('select')];
      [...a.options].forEach(o => o.disabled = o.value === b.value);
      [...b.options].forEach(o => o.disabled = o.value === a.value);
      route = {...route, left:a.value, right:b.value};
      storeRoute(route,true);
      table();
    });
  }

  function coaching() {
    const sent = api.coachingRequested();
    show(`<div class="modal-pad"><div class="eyebrow" dir="ltr" lang="en">Personal Coaching</div>
      <h2 id="dialog-title">${sent ? 'ההתעניינות נשמרה' : 'ליווי אישי עם סופיה'}<span class="dot">.</span></h2>
      <p>${sent ? 'הבקשה נשמרה בדפדפן הזה כחלק מההדגמה.' : 'הליווי האישי הוא מסלול נפרד מתוכניות הווידאו. אפשר לשמור התעניינות לדוגמה במכשיר הזה.'}</p>
      ${sent ? '<button type="button" class="btn btn-ink" data-action="dismiss">סיום</button>' : '<button type="button" class="btn btn-ink" data-action="interest">שמירת התעניינות לדוגמה</button>'}</div>`, {type:'coach'});
  }

  function preview(id, fromDetails = true) {
    const sample = id && openingSession(program(id));
    if (id && !sample) { detail(id); return; }
    const returning = sample && fromDetails;
    const enrolled = returning && api.enrolled().includes(id);
    const paused = returning && api.customers().some(order => order.programId === id && !order.active);
    const title = sample ? safe(sample.title) : 'תנועה עם סופיה';
    const transcript = '<details class="warmup-text"><summary>הנחיות התרגול בטקסט</summary><p>עמדי בנוחות כשהידיים לצדי הגוף. הרימי אותן לצדדים במשך שלוש שניות, עד לגובה שנוח לך, והורידי אותן במשך שלוש שניות. חזרי על התנועה ארבע פעמים.</p></details>';
    const filmDescription = '<details class="warmup-text"><summary>תיאור הסרט בטקסט</summary><p>מתאמנת מבצעת מכרע צד בסטודיו מואר. אחרי תקריב של מזרן ומשקולות ורודות נראית מתיחת צד בישיבה. בחדר הכושר יד ניגשת למשקולת ומתאמנת מרימה אותה. מאמנת ומתאמנת יושבות ומשוחחות. הסרט נחתם בלוגו של סופיה.</p></details>';
    const src = sample ? safe(sample.videoUrl) : 'assets/studio-film.mp4';
    show(`<div class="modal-pad"><div class="eyebrow" dir="ltr" lang="en">${sample ? 'Opening Session' : 'Studio Film'}</div>
      <h2 id="dialog-title">${title}<span class="dot">.</span></h2>
      <p>${sample ? 'תרגול מודרך באיור ובצלילים · ' + duration(sample.minutes) + ' · ללא ציוד' : 'סרט הסטודיו · 18 שניות · מוזיקה מקורית'}</p>
      <video class="preview-video" controls playsinline preload="metadata" ${sample ? 'poster="assets/shoulder-warmup.jpg"' : 'poster="assets/studio-film-poster.webp"'} aria-label="${title}">
      <source src="${src}" type="video/mp4"></video>
      ${sample ? transcript : filmDescription}
      ${returning ? `<div class="trial-actions"><button type="button" class="text-link" data-action="return">חזרה לפרטי התוכנית</button>${enrolled ? `<a class="btn btn-ink" href="member.html?program=${id}">לאימון שלי</a>` : paused ? '' : '<button type="button" class="btn btn-ink" data-action="checkout">להצטרפות בדמו</button>'}</div>` : ''}</div>`, sample ? {type:'sample',id,fromDetails} : {type:'preview'});
    const video = body.querySelector('video');
    if (sample) api.configureLessonVideo(video, sample.videoUrl);
    if (!restoring) video.play().catch(() => {});
  }

  const render = r => {
    switch (r?.type) {
      case 'detail': return detail(r.id, r.match);
      case 'checkout': return api.enrolled().includes(r.id) ? confirmed(r.id) : checkout(r.id);
      case 'confirmed': return api.enrolled().includes(r.id) ? confirmed(r.id) : detail(r.id);
      case 'finder': return finder(r.place, r.level);
      case 'compare': return compare(r.left, r.right);
      case 'coach': return coaching();
      case 'preview': return preview();
      case 'sample': return preview(r.id, r.fromDetails);
    }
  };
  function restore(r) {
    restoring = true;
    try { render(r); } finally { restoring = false; }
  }

  function openPlanLink(event) {
    const link = event.target.closest('[data-plan]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    detail(link.dataset.plan);
  }
  $('#cards').addEventListener('click', openPlanLink);
  body.addEventListener('click', event => {
    if (event.target.closest('[data-plan]')) { openPlanLink(event); return; }
    switch (event.target.closest('[data-action]')?.dataset.action) {
      case 'checkout': checkout(route.id); break;
      case 'share': shareProgram(route.id); break;
      case 'decline': $('#order-status').textContent = 'עסקת ההדגמה נדחתה. אפשר לנסות שוב כדי לפתוח את התוכנית.'; break;
      case 'dismiss': dismiss(); break;
      case 'interest': api.requestCoaching(); coaching(); break;
      case 'sample': preview(route.id); break;
      case 'return': history.back(); break;
    }
  });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    catalog();
  }));
  $('#find-plan').addEventListener('click', () => finder());
  $('#faq-finder').addEventListener('click', () => finder());
  $('#sample-class').addEventListener('click', () => preview(programs()[0].id, false));
  $('#compare').addEventListener('click', () => compare());
  $('#coach').addEventListener('click', coaching);
  $('#film').addEventListener('click', () => preview());

  const mobile = $('#mobile-menu'), menu = $('#menu-btn');
  function setMenu(on) {
    mobile.hidden = !on;
    menu.setAttribute('aria-expanded', String(on));
    menu.setAttribute('aria-label', on ? 'סגירת תפריט' : 'פתיחת תפריט');
  }
  menu.addEventListener('click', () => setMenu(mobile.hidden));
  mobile.addEventListener('click', () => setMenu(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !mobile.hidden) { setMenu(false); menu.focus(); }
  });
  window.addEventListener('popstate', () => {
    const next = history.state?.sophiaStore?.route;
    if (next) restore(next);
    else hideDialog();
  });

  catalog();
  const saved = history.state?.sophiaStore?.route;
  const initial = new URL(location.href).searchParams.get('program');
  if (saved && (!saved.id || program(saved.id))) restore(saved);
  else if (program(initial)) {
    // A shared program link gets a catalog entry so Back and Close both return to the collection.
    try {
      const url = routeUrl(null);
      url.hash = 'programs';
      history.replaceState(history.state, '', url);
    } catch {}
    detail(initial);
  }
})();

(() => {
  "use strict";

  const api = window.Sophia;
  const main = document.querySelector("#member-main");
  if (!api) {
    main.textContent = "לא הצלחנו לטעון את אזור האימונים. אפשר לרענן את הדף ולנסות שוב.";
    return;
  }

  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    library: '<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
    user: '<circle cx="12" cy="7.5" r="3.5"/><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2z"/>',
    arrow: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    play: '<path d="M6 4.2a.8.8 0 0 1 1.2-.7l13.1 7.8a.8.8 0 0 1 0 1.4L7.2 20.5a.8.8 0 0 1-1.2-.7z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    grid: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18m-12 0v11"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>'
  };
  const icon = name => '<svg aria-hidden="true" viewBox="0 0 24 24">' + (paths[name] || "") + '</svg>';
  document.querySelectorAll("[data-icon]").forEach(el => { el.innerHTML = icon(el.dataset.icon); });
  const escape = val => String(val ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const player = document.querySelector("#player-dialog");
  const resetDialog = document.querySelector("#reset-dialog");
  const video = document.querySelector("#workout-video");
  const note = document.querySelector("#video-note");
  const completeButton = document.querySelector("#video-complete");
  const sampleId = "sophia-member-preview-time-v1";
  const lastId = "sophia-member-last-v1";
  const recentId = "sophia-member-recent-by-program-v1";
  const demoVideo = "assets/breathing-demo.mp4";
  if (new URLSearchParams(location.search).get("tour")==="workout") {
    const link=document.querySelector(".m-catalog-link");
    link.href="presentation.html#workout";
    link.textContent="חזרה לסיור";
  }
  const pageLabels = {home:"האימון שלי",library:"הספרייה שלי",account:"החשבון שלי"};
  const programImages = {"home-1":"assets/home-1.webp","home-2":"assets/home-2.webp","gym-1":"assets/gym-1.webp","gym-2":"assets/gym-2.webp"};

  let active = null;
  let blobUrl = null;
  let playVersion = 0;
  let previousTick = -1;
  const linkedProgram = () => new URLSearchParams(location.search).get("program");
  let chosenProgram = linkedProgram();
  let chosenWeek = new URLSearchParams(location.search).get("week");
  let noticeTimer;
  let returnFocus;
  let dataFingerprint = "";
  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private mode can disable storage. */ }
  }
  const tab = () => Object.hasOwn(pageLabels,location.hash.slice(1)) ? location.hash.slice(1) : "home";
  const allPrograms = () => api.programs();
  const owned = () => {
    const ids = new Set(api.enrolled());
    return allPrograms().filter(p => ids.has(p.id));
  };
  const pausedPrograms = () => {
    const ids = new Set(api.customers().filter(order => !order.active).map(order => order.programId));
    return allPrograms().filter(p => ids.has(p.id));
  };
  const sessions = program => Array.isArray(program.sessions) ? program.sessions : [];
  const done = program => new Set(api.completed(program.id));
  const photo = program => programImages[program?.id] || "assets/home-1.webp";
  const week = session => String(session.week || 1);
  const minLabel = session => {
    const minutes = Number(session.minutes);
    if (!minutes || minutes < 0) return "";
    return minutes < 1 ? Math.round(minutes * 60) + " שניות" : minutes + " דקות";
  };
  let mediaKeys = new Set();
  const uploaded = (p,s) => mediaKeys.has(p.id+"/"+s.id);
  const available = (p,s) => Boolean(s.videoUrl || uploaded(p,s));
  const saved = (p,s) => Number(api.progressTime(p.id,s.id)) || 0;
  const clock = n => Math.floor(n/60) + ":" + String(Math.floor(n%60)).padStart(2,"0");

  function announce(message) {
    const status = document.querySelector("#member-status");
    status.textContent = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { status.textContent = ""; },4000);
  }

  function intro(en,title,subtitle) {
    return '<div class="m-intro"><div><span class="m-eyebrow" dir="ltr" lang="en">'+en+'</span><h1>'+escape(title)+'</h1><p>'+escape(subtitle)+'</p></div></div>';
  }

  function selectProgram(id) {
    chosenProgram = id;
    chosenWeek = null;
    const url = new URL(location.href);
    url.searchParams.set("program",id);
    url.searchParams.delete("week");
    history.replaceState(history.state,"",url);
  }

  function nextSession(programs) {
    const last = read(lastId,{});
    const recent = programs.find(p => p.id===last.program);
    const byProgram = read(recentId,{});
    const ordered = recent ? [recent,...programs.filter(p => p !== recent)] : programs;
    for (const p of ordered) {
      const finished = done(p);
      const ready = sessions(p).filter(s => available(p,s) && !finished.has(s.id));
      const recentSession = byProgram[p.id] || (last.program===p.id ? last.session : null);
      const next = ready.find(s => s.id===recentSession) || ready[0];
      if (next) return {program:p,session:next};
    }
    const first = ordered.find(p => sessions(p).some(s => available(p,s)));
    if (!first) return null;
    const playable=sessions(first).filter(s=>available(first,s));
    return {program:first,session:playable.find(s=>s.id===byProgram[first.id]) || playable[0]};
  }

  function practiceButtonAttributes(item) {
    return item ? 'data-action="play" data-program="'+escape(item.program.id)+'" data-session="'+escape(item.session.id)+'"' : 'data-action="preview"';
  }

  function hero(item) {
    const attrs = practiceButtonAttributes(item);
    const title = item ? item.session.title : "רגע של נשימה";
    const previous = item ? saved(item.program,item.session) : Number(read(sampleId,0));
    const completed = item && done(item.program).has(item.session.id);
    const action = previous > 0 && !completed ? "המשך צפייה" : completed ? "צפייה חוזרת" : item ? "התחלת האימון" : "לתרגול ההיכרות";
    const eyebrow = item ? completed ? "WATCH AGAIN" : "UP NEXT" : "STUDIO PREVIEW";
    const sub = item ? escape(item.program.name) : "תרגול נשימה מונפש בקצב קבוע, זמין גם לפני בחירת תוכנית.";
    const duration = item ? uploaded(item.program,item.session) ? "" : minLabel(item.session) : "24 שניות";
    return '<article class="m-hero"><div class="m-hero-photo"><img src="'+photo(item?.program)+'" alt=""></div><div class="m-hero-copy"><span class="m-eyebrow" dir="ltr" lang="en">'+eyebrow+'</span><h2>'+escape(title)+'</h2><p>'+sub+'</p><div class="m-meta">'+(duration ? '<span>'+icon("clock")+duration+'</span>' : '')+(item ? '<span>'+icon("grid")+'שבוע '+escape(week(item.session))+'</span>' : '')+'</div><button class="m-primary-play" '+attrs+'><span class="m-play-dot">'+icon("play")+'</span>'+action+'</button></div><button class="m-hero-visual-play" '+attrs+' aria-label="'+action+'">'+icon("play")+'</button></article>';
  }

  function stats(programs) {
    return programs.reduce((acc,p) => {
      const finished = done(p);
      acc.total += sessions(p).length;
      acc.count += sessions(p).filter(s => finished.has(s.id)).length;
      return acc;
    },{total:0,count:0});
  }

  function progressCard(programs) {
    const {total,count} = stats(programs);
    const percent = total ? Math.round(100*count/total) : 0;
    const detail = total ? count+' מתוך '+total+' אימונים הושלמו' : "המעקב נפתח עם ההצטרפות לתוכנית.";
    return '<aside class="m-progress-card"><div><span class="m-eyebrow" dir="ltr" lang="en">MY PROGRESS</span><h2>ההתקדמות שלי</h2></div><div class="m-progress-visual"><div class="m-progress-ring" role="meter" aria-label="אחוז האימונים שהושלמו" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percent+'" style="--fill:'+percent+'%"><span dir="ltr">'+percent+'%</span></div><p><b>אימונים שהושלמו</b>מתוך התוכניות שלי</p></div><p class="m-progress-info">'+detail+'</p></aside>';
  }

  function programCards(programs) {
    const ids = new Set(owned().map(p => p.id));
    const paused = new Set(pausedPrograms().map(p => p.id));
    return '<div class="m-program-grid">'+programs.map(p => {
      const available = ids.has(p.id);
      const content = '<img class="m-thumb" alt="" src="'+photo(p)+'"><span class="m-program-words"><strong>'+escape(p.name)+'</strong><small>'+(available ? 'פתיחה בספרייה' : paused.has(p.id) ? 'גישה מושהית · לפרטים' : 'לפרטי התוכנית')+'</small></span><span class="m-state-icon">'+icon(available?"arrow":"lock")+'</span>';
      return available ? '<button class="m-program" data-action="open-library" data-program="'+escape(p.id)+'">'+content+'</button>' : '<a class="m-program" href="'+(paused.has(p.id) ? '#account' : 'index.html?program='+encodeURIComponent(p.id))+'">'+content+'</a>';
    }).join("")+'</div>';
  }

  function sectionHead(eng,heading,link,target) {
    return '<div class="m-section-head"><div><span class="m-eyebrow" dir="ltr" lang="en">'+eng+'</span><h2 class="m-section-title">'+heading+'</h2></div>'+(link ? '<a class="m-text-link" href="'+target+'">'+link+icon("arrow")+'</a>' : '')+'</div>';
  }

  function homeView() {
    const programs = owned();
    const requested = programs.find(p => p.id===linkedProgram());
    const upcoming = nextSession(requested ? [requested] : programs);
    const name = String(api.currentName() || "").trim().split(/\s+/)[0];
    const subtitle = name && name!=="אורחת" ? "היי "+name+", כאן מחכים לך האימונים והתוכניות שלך." : "האימון הבא, התוכניות וההתקדמות שלך במקום אחד.";
    return intro("MY WORKOUT","האימון שלי",subtitle)+'<div class="m-home-grid">'+hero(upcoming)+progressCard(programs)+'</div><sophia-planner data-program="'+escape(upcoming?.program.id || '')+'"></sophia-planner><section class="m-section">'+sectionHead("PROGRAM LIBRARY",programs.length ? "התוכניות שלי" : "תוכניות האימון",programs.length ? "לספרייה שלי" : "לכל התוכניות",programs.length ? "#library" : "index.html#programs")+programCards(programs.length ? programs : allPrograms())+'</section>';
  }

  function libraryView() {
    const mine = owned();
    const start = intro("MY LIBRARY","הספרייה שלי","כל האימונים שלך מסודרים לפי תוכנית ושבוע.");
    if (!mine.length) {
      const paused = pausedPrograms();
      const title = paused.length ? "הגישה לאימונים מושהית" : "הספרייה מחכה לתוכנית הראשונה שלך";
      const message = paused.length ? "ההתקדמות שלך נשמרה. אחרי חידוש הגישה בסטודיו תוכלי להמשיך מאותה נקודה." : "אחרי ההצטרפות, האימונים בתוכנית ייפתחו כאן.";
      return start+'<section class="m-empty"><span class="m-empty-icon">'+icon("lock")+'</span><div><h2>'+title+'</h2><p>'+message+'</p></div><a class="m-button m-ink" href="index.html#programs">לתוכניות באתר'+icon("arrow")+'</a></section>'+programCards(allPrograms());
    }
    const p = mine.find(p => p.id === chosenProgram) || nextSession(mine)?.program || mine[0];
    chosenProgram = p.id;
    const list = sessions(p);
    const weeks = [...new Set(list.map(week))].sort((a,b) => Number(a)-Number(b));
    if (!weeks.includes(chosenWeek)) {
      const pending = list.find(s => available(p,s) && !done(p).has(s.id));
      chosenWeek = pending ? week(pending) : weeks[0];
    }
    const finished = done(p);
    const options = mine.map(opt => '<option value="'+escape(opt.id)+'" '+(opt.id===p.id ? "selected" : "")+'>'+escape(opt.name)+'</option>').join("");
    const tabs = weeks.map(w => '<button data-action="week" aria-pressed="'+(w===chosenWeek)+'" data-week="'+escape(w)+'">שבוע '+escape(w)+'</button>').join("");
    const rows = list.filter(s => week(s) === chosenWeek).map(s => {
      const time = saved(p,s);
      const ready = available(p,s);
      const status = finished.has(s.id) ? icon("check")+'<span>הושלם</span>' : time && ready ? 'המשך מ־<bdi>'+clock(time)+'</bdi>' : '';
      let detail = minLabel(s);
      if (uploaded(p,s)) detail='סרטון מהסטודיו';
      else if (!ready) detail+=' · הסרטון טרם נוסף';
      else detail+=s.demo ? ' · שיעור הדגמה' : ' · זמין לצפייה';
      const tag = ready ? 'button' : 'div';
      const attrs = ready ? practiceButtonAttributes({program:p,session:s}) : '';
      return '<'+tag+' class="m-session'+(ready ? '' : ' m-pending')+'" '+attrs+'><span class="m-lesson-glyph">'+icon(ready ? "play" : "clock")+'</span><span class="m-session-name"><strong>'+escape(s.title)+'</strong><small>'+detail+'</small></span><span class="m-session-status">'+status+'</span></'+tag+'>';
    }).join("");
    const count = list.filter(s => finished.has(s.id)).length;
    const summary = '<header class="m-course-summary"><img src="'+photo(p)+'" alt=""><div><span class="m-course-meta">'+escape(p.level)+' · '+weeks.length+' שבועות</span><h2>'+escape(p.name)+'</h2><p>'+count+' מתוך '+list.length+' אימונים הושלמו</p><progress value="'+count+'" max="'+Math.max(1,list.length)+'" aria-label="התקדמות בתוכנית"></progress></div></header>';
    const picker = mine.length>1 ? '<div class="m-program-picker"><label for="member-program">בחירת תוכנית</label><select id="member-program">'+options+'</select></div>' : '';
    return start+picker+'<section class="m-course-shell">'+summary+'<div class="m-course-lessons"><div class="m-week-tabs" role="group" aria-label="בחירת שבוע">'+tabs+'</div>'+(rows ? '<div class="m-sessions">'+rows+'</div>' : '<p>האימונים לתוכנית הזו יופיעו כאן לאחר הוספתם בסטודיו.</p>')+'</div></section>';

  }

  function accountView() {
    const name = String(api.currentName() || "").trim();
    const mine = owned();
    const paused = pausedPrograms();
    const data = stats([...mine,...paused]);
    const access = paused.length ? '<section class="m-account-block"><h2>תוכניות שהגישה אליהן מושהית</h2><p>ההתקדמות נשמרת גם כשהגישה מושהית. ניתן לחדש את הגישה במסך הרכישות בסטודיו.</p>'+paused.map(p => '<div class="m-account-row"><strong>'+escape(p.name)+'</strong><span>גישה מושהית</span></div>').join("")+'</section>' : "";
    return intro("MY ACCOUNT","החשבון שלי","פרטי ההדגמה והתוכניות שנשמרו במכשיר הזה.")+
      '<section class="m-account-block"><div class="m-account-head"><span class="m-avatar" aria-hidden="true">'+(name ? escape(Array.from(name)[0]) : icon("user"))+'</span><div><h2>'+escape(name || "פרופיל מקומי")+'</h2><p>האזור האישי ב־Sophia Digital</p></div></div><div class="m-account-row"><span>תוכניות בספרייה</span><b>'+mine.length+'</b></div><div class="m-account-row"><span>אימונים שהושלמו</span><b>'+data.count+'</b></div><a class="m-text-link" href="#library">לספרייה שלי'+icon("arrow")+'</a></section>'+access+
      '<section class="m-account-block"><h2>נתוני ההדגמה</h2><p>כאן אפשר לאפס את כל ההדגמה בדפדפן הזה, כולל התוכניות והסרטונים שנערכו בסטודיו.</p><button class="m-button m-outline" data-action="ask-reset">איפוס נתוני ההדגמה</button></section>';
  }

  function fingerprint() {
    const programs = allPrograms();
    return JSON.stringify([programs,api.customers(),api.currentName(),owned().map(p => api.completed(p.id))]);
  }
  function render() {
    const current = tab();
    main.innerHTML = current === "library" ? libraryView() : current === "account" ? accountView() : homeView();
    document.querySelectorAll("[data-tab]").forEach(a => {
      if (a.dataset.tab===current) a.setAttribute("aria-current","page");
      else a.removeAttribute("aria-current");
    });
    document.title = pageLabels[current]+" · Sophia Digital";
    dataFingerprint = fingerprint();
  }
  function refresh() {
    if (document.visibilityState==="hidden") return;
    if (player.open && active?.item && !owned().some(p => p.id===active.item.program.id)) {
      active.ready=false;
      video.pause();
      player.close();
      announce("הגישה לתוכנית עודכנה.");
      return;
    }
    if (!player.open && !resetDialog.open && fingerprint()!==dataFingerprint) render();
  }

  // The studio and member screens share the same local IndexedDB media records.
  function openMediaDatabase() {
    if (!window.indexedDB) return Promise.resolve(null);
    return new Promise((resolve,reject) => {
      const request = indexedDB.open("sophia-studio-media-v1",1);
      let blocked = false;
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions",{keyPath:"key"});
      };
      request.onsuccess = () => {
        if (blocked) request.result.close();
        else resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => { blocked = true; reject(new Error("Database blocked")); };
    });
  }

  async function loadMediaKeys() {
    let db;
    try {
      db = await openMediaDatabase();
      if (!db) return;
      const keys = await new Promise((resolve,reject) => {
        const request = db.transaction("sessions").objectStore("sessions").getAllKeys(IDBKeyRange.upperBound("\uffff",true));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (keys.length === mediaKeys.size && keys.every(key => mediaKeys.has(key))) return;
      mediaKeys = new Set(keys);
      if (!player.open && !resetDialog.open) render();
    } catch { /* Built-in lessons remain available without IndexedDB. */ }
    finally { db?.close(); }
  }

  async function studioFile(program,session) {
    let db;
    try {
      db = await openMediaDatabase();
      if (!db) return null;
      return await new Promise((resolve,reject) => {
        const tx = db.transaction("sessions","readonly");
        const store=tx.objectStore("sessions");
        const request=store.get(program+"/"+session);
        request.onsuccess=()=>{
          const record=request.result;
          if (!record?.bytesKey) { resolve(record?.file instanceof Blob ? record.file : null); return; }
          const raw=store.get(record.bytesKey);
          raw.onerror=()=>reject(raw.error);
          raw.onsuccess=()=>resolve(raw.result?.bytes instanceof ArrayBuffer ? new Blob([raw.result.bytes],{type:record.type}) : null);
        };
        tx.onabort = request.onerror = () => reject(tx.error || request.error);
      });
    } catch { return null; }
    finally { db?.close(); }
  }

  async function resetDemo(button) {
    button.disabled = true;
    const message = document.querySelector("#reset-message");
    message.hidden = true;
    let db;
    try {
      db = await openMediaDatabase();
      if (db) await new Promise((resolve,reject) => {
        const tx = db.transaction("sessions","readwrite");
        tx.oncomplete = resolve;
        tx.onerror = tx.onabort = () => reject(tx.error);
        tx.objectStore("sessions").clear();
      });
      api.reset();
      mediaKeys.clear();
      write("sophia.media-reset.v1",Date.now());
      write(lastId,null); write(recentId,null); write(sampleId,0);
      write("sophia.member.schedule.v1",null);
      chosenProgram=chosenWeek=null;
      const url = new URL(location.href);
      url.searchParams.delete("program");
      url.searchParams.delete("week");
      history.replaceState(history.state,"",url);
      resetDialog.close();
      location.hash="home";
      render();
      announce("נתוני ההדגמה אופסו.");
    } catch {
      message.hidden = false;
    } finally {
      db?.close();
      button.disabled = false;
    }
  }

  function sourceUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const url = new URL(value,document.baseURI);
      return ["http:","https:"].includes(url.protocol) || (url.protocol==="file:" && !/^[a-z][\w+-]*:/i.test(value)) ? url.href : "";
    } catch { return ""; }
  }

  function persistTime() {
    if (!active || !video.currentSrc || !active.ready || !Number.isFinite(video.currentTime)) return;
    const seconds = video.ended ? 0 : Math.floor(video.currentTime);
    if (seconds === previousTick) return;
    previousTick = seconds;
    if (active.item) api.setProgressTime(active.item.program.id,active.item.session.id,seconds);
    else write(sampleId,seconds);
  }

  function startPlayer(button) {
    const program = owned().find(p => p.id===button.dataset.program);
    const session = program && sessions(program).find(s => s.id===button.dataset.session);
    const item = program && session ? {program,session} : null;
    if (button.dataset.action==="play" && !item) { render(); return; }
    active = {item, ready:false};
    const transcript = document.querySelector("#video-transcript");
    transcript.hidden = true;
    transcript.open = false;
    video.hidden = false;
    if (item) {
      write(lastId,{program:program.id,session:session.id});
      write(recentId,{...read(recentId,{}),[program.id]:session.id});
    }
    previousTick = -1;
    returnFocus = button;
    const title = item ? session.title : "רגע של נשימה";
    document.querySelector("#player-title").textContent = title;
    document.querySelector("#video-label").textContent = "טוען את הסרטון…";
    note.textContent = "";
    completeButton.hidden = true;
    completeButton.disabled = !!item && done(program).has(session.id);
    completeButton.innerHTML = icon("check")+(completeButton.disabled ? "האימון הושלם" : "סימון האימון כהושלם");
    player.showModal();
    history.pushState({...history.state, sophiaPlayer:true},"",location.href);
    const version = ++playVersion;
    const lookup = item ? studioFile(program.id,session.id) : Promise.resolve(null);
    lookup.then(file => {
      if (!player.open || version!==playVersion) return;
      const url = item ? sourceUrl(session.videoUrl) : "";
      if (item && !file && !url) {
        video.hidden = true;
        document.querySelector("#video-label").textContent = "הסרטון טרם נוסף לאימון";
        note.textContent = "אפשר לבחור אימון אחר בספרייה.";
        return;
      }
      completeButton.hidden = !item;
      completeButton.disabled = true;
      if (file) blobUrl = URL.createObjectURL(file);
      const source = blobUrl || url || demoVideo;
      const info = api.configureLessonVideo(video,source);
      transcript.hidden = !info;
      transcript.querySelector("p").textContent=info?.transcript || "";
      document.querySelector("#video-label").textContent = info?.label || session?.title || title;
      note.textContent = info?.note || "נקודת העצירה נשמרת בדפדפן הזה.";
      const resume = item ? saved(program,session) : Number(read(sampleId,0));
      video.onloadedmetadata = () => {
        if (version!==playVersion) return;
        if (Number.isFinite(resume) && resume>0 && resume<video.duration-.4) video.currentTime=resume;
        active.ready = true;
        completeButton.disabled = Boolean(item && done(program).has(session.id));
        video.play().catch(error => {
          if (version===playVersion && error.name==="NotAllowedError") {
            note.textContent += " להתחלת הצפייה לחצי על כפתור ההפעלה בנגן.";
          }
        });
      };
      video.onerror = () => {
        if (version===playVersion) { completeButton.hidden = true; note.textContent="הדפדפן לא הצליח להפעיל את הקובץ. אפשר לבדוק את הפורמט בספריית הווידאו של הסטודיו."; }
      };
      video.src = source;
      video.load();
    });
  }

  function closedPlayer() {
    if (history.state?.sophiaPlayer) history.back();
    api.configureLessonVideo(video,null);
    playVersion++;
    persistTime();
    video.onloadedmetadata = video.onerror = null;
    active=null;
    video.pause();
    video.removeAttribute("src");
    video.removeAttribute("poster");
    video.load();
    if (blobUrl) {URL.revokeObjectURL(blobUrl); blobUrl=null;}
    const action = returnFocus?.dataset.action;
    const id = returnFocus?.dataset.session;
    render();
    const equivalent = [...main.querySelectorAll("button[data-action]")].find(el => el.dataset.action===action && el.dataset.session===id);
    (equivalent || main.querySelector(".m-primary-play") || main).focus({preventScroll:true});
  }

  document.addEventListener("click",event => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    switch (target.dataset.action) {
      case "play":
      case "preview":
        startPlayer(target); break;
      case "close-player":
        player.close(); break;
      case "complete":
        if (active?.item && active.ready) {
          const {program,session} = active.item;
          if (!owned().some(p => p.id===program.id)) { player.close(); break; }
          api.markComplete(program.id,session.id);
          player.close();
          announce("האימון סומן כהושלם.");
        }
        break;
      case "open-library":
        selectProgram(target.dataset.program);
        if (tab()==="library") render(); else location.hash="library";
        break;
      case "week": {
        chosenWeek=target.dataset.week;
        const url=new URL(location.href);
        url.searchParams.set("program",chosenProgram);
        url.searchParams.set("week",chosenWeek);
        history.replaceState(history.state,"",url);
        render();
        [...main.querySelectorAll('[data-action="week"]')].find(el => el.dataset.week===chosenWeek)?.focus({preventScroll:true});
        break;
      }
      case "ask-reset":
        resetDialog.showModal(); break;
      case "cancel-reset":
        resetDialog.close(); break;
      case "confirm-reset":
        resetDemo(target); break;
    }
  });
  main.addEventListener("change",event => {
    if (event.target.id==="member-program") { selectProgram(event.target.value); render(); main.querySelector("select")?.focus(); }
  });
  video.addEventListener("timeupdate",persistTime);
  video.addEventListener("pause",persistTime);
  video.addEventListener("ended",persistTime);
  player.addEventListener("close",closedPlayer);
  [player,resetDialog,document.querySelector("#schedule-dialog")].forEach(dlg => dlg.addEventListener("click",event => {
    if (event.target!==dlg) return;
    const rect = dlg.getBoundingClientRect();
    if (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) dlg.close();
  }));
  document.addEventListener("sophia-member-notice",event=>announce(event.detail));
  window.addEventListener("pagehide",persistTime);
  window.addEventListener("focus",refresh);
  window.addEventListener("popstate",()=>{ if (player.open && !history.state?.sophiaPlayer) player.close(); });
  window.addEventListener("storage",event=>{
    refresh();
    if (event.key === "sophia.media-change.v1" || event.key === "sophia.media-reset.v1") loadMediaKeys();
  });
  window.addEventListener("pageshow",()=>{ refresh(); loadMediaKeys(); });
  document.addEventListener("visibilitychange",()=>{ if (document.hidden) persistTime(); else refresh(); });
  window.addEventListener("hashchange",()=>{ if(player.open) player.close(); render(); window.scrollTo(0,0); main.focus({preventScroll:true}); });
  if (history.state?.sophiaPlayer) {
    const {sophiaPlayer,...otherState}=history.state;
    history.replaceState(otherState,"",location.href);
  }
  render();
  loadMediaKeys();
})();

(() => {
  "use strict";

  const api = window.Sophia;
  const key = "sophia.member.schedule.v1";
  const dialog = document.querySelector("#schedule-dialog");
  if (!api || !dialog) return;
  const form = dialog.querySelector("form");
  const fields = form.elements;
  const error = dialog.querySelector('[role="alert"]');
  const overlap = dialog.querySelector("#schedule-overlap");
  let editing;
  let trigger;
  let expiryTimer;
  const esc = value => String(value ?? "").replace(/[&<>"']/g,c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const calendarIcon = '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-12 5h2"/></svg>';
  const enrolled = () => {
    const orders = new Map(api.customers().filter(o => o.active).map(o => [o.programId,o.id]));
    return api.programs().filter(p => orders.has(p.id)).map(p => ({...p,orderId:orders.get(p.id)}));
  };
  function read() {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }
  function current() {
    const item = read();
    if (!item || !Number.isFinite(item.start) || !Number.isFinite(new Date(item.start).getTime()) ||
        !Number.isSafeInteger(item.minutes) || item.minutes<1 || item.minutes>1440 ||
        !/^[a-f0-9]{32}@sophia-digital\.local$/.test(item.uid) || !Number.isSafeInteger(item.sequence) ||
        item.start+item.minutes*60000<=Date.now()) return null;
    return enrolled().some(p => p.id===item.program && p.orderId===item.order) ? item : null;
  }
  function save(item) {
    if (item) localStorage.setItem(key,JSON.stringify(item));
    else localStorage.removeItem(key);
    document.querySelector("sophia-planner")?.refresh();
  }
  function status(text) {
    document.dispatchEvent(new CustomEvent("sophia-member-notice",{detail:text}));
  }
  const pad = n => String(n).padStart(2,"0");
  const dateInput = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  const timeInput = d => pad(d.getHours())+":"+pad(d.getMinutes());
  const zoneLabel = date => new Intl.DateTimeFormat("he-IL",{timeZoneName:"long"}).formatToParts(date).find(part=>part.type==="timeZoneName")?.value || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
  const localLabel = ms => new Intl.DateTimeFormat("he-IL",{weekday:"short",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit",timeZoneName:"short",hourCycle:"h23"}).format(ms);

  function localChoices() {
    const input = fields.day.value+"T"+fields.time.value;
    const first = new Date(input);
    if (!Number.isFinite(first.getTime()) || dateInput(first)+"T"+timeInput(first)!==input) return [];
    // During a backward clock change, the same local time can refer to two instants.
    const tomorrow = new Date(first);
    tomorrow.setDate(tomorrow.getDate()+1);
    const difference = tomorrow.getTimezoneOffset()-first.getTimezoneOffset();
    const later = new Date(first.getTime()+difference*60000);
    return difference>0 && dateInput(later)+"T"+timeInput(later)===input ? [first,later] : [first];
  }
  function updateTime(selectedTime) {
    const choices = localChoices();
    overlap.hidden = choices.length<2;
    dialog.querySelector("#schedule-zone").textContent="לפי השעה במכשיר · "+zoneLabel(choices[0] || new Date());
    fields.offset.replaceChildren();
    for (const d of choices) {
      const minutes = -d.getTimezoneOffset();
      const label = "UTC"+(minutes>=0?"+":"−")+pad(Math.floor(Math.abs(minutes)/60))+":"+pad(Math.abs(minutes)%60);
      const occurrence = choices.length<2 ? "" : d===choices[0] ? "לפני החלפת השעון · " : "אחרי החלפת השעון · ";
      fields.offset.add(new Option(occurrence+label,String(d.getTime())));
    }
    if (choices.some(d => d.getTime()===selectedTime)) fields.offset.value=String(selectedTime);
  }
  function durationHint() {
    const p = enrolled().find(p => p.id===fields.program.value);
    dialog.querySelector("#schedule-duration").textContent=p ? (fields.program.options.length===1 ? p.name+" · " : "")+p.minutes+" דקות ביומן" : "";
  }
  function openForm(button) {
    const programs = enrolled();
    if (!programs.length) return;
    editing = current();
    trigger = button;
    const preferred = editing?.program || document.querySelector("sophia-planner")?.dataset.program;
    fields.program.replaceChildren(...programs.map(p => new Option(p.name,p.id)));
    fields.program.value=programs.some(p=>p.id===preferred) ? preferred : programs[0].id;
    fields.program.closest("label").hidden=programs.length<2;
    const date = editing ? new Date(editing.start) : new Date();
    if (!editing) { date.setDate(date.getDate()+1); date.setHours(18,0,0,0); }
    fields.day.min=dateInput(new Date());
    fields.day.value=dateInput(date);
    fields.time.value=timeInput(date);
    dialog.querySelector("#schedule-title").textContent=editing ? "שינוי מועד האימון" : "לקבוע את האימון הבא";
    dialog.querySelector("#schedule-export-note").hidden=!editing?.exported;
    error.textContent="";
    durationHint();
    updateTime(editing?.start);
    dialog.showModal();
    history.pushState({...history.state,sophiaScheduleDialog:true},"",location.href);
    fields.day.focus();
  }
  function icsText(value) {
    return String(value).replace(/\\/g,"\\\\").replace(/\r\n|[\r\n]/g,"\\n").replace(/[;,]/g,c=>"\\"+c);
  }
  function fold(line) {
    const encoder = new TextEncoder();
    let size=0, result="";
    for (const char of line) {
      const bytes=encoder.encode(char).length;
      if (size+bytes>75) { result+="\r\n "; size=1; }
      result+=char; size+=bytes;
    }
    return result;
  }
  function exportItem() {
    const item=current();
    if (!item) return;
    const p=enrolled().find(p=>p.id===item.program);
    const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Sophia Digital//Training Planner//HE","CALSCALE:GREGORIAN","BEGIN:VEVENT","UID:"+item.uid,"DTSTAMP:"+stamp(Date.now()),"SEQUENCE:"+item.sequence,"DTSTART:"+stamp(item.start),"DTEND:"+stamp(item.start+item.minutes*60000),"SUMMARY:"+icsText("אימון · "+p.name),"DESCRIPTION:"+icsText("אימון בתוכנית "+p.name+" של Sophia Digital."),"END:VEVENT","END:VCALENDAR"];
    const url=URL.createObjectURL(new Blob([lines.map(fold).join("\r\n")+"\r\n"],{type:"text/calendar;charset=utf-8"}));
    const link=document.createElement("a");
    link.href=url;
    link.download="sophia-workout-"+dateInput(new Date(item.start))+".ics";
    document.body.append(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    try { save({...item,exported:true}); } catch { /* The file is already available. */ }
    document.querySelector('sophia-planner [data-planner="export"]')?.focus({preventScroll:true});
    status("קובץ האירוע מוכן לפתיחה ביומן.");
  }
  class WorkoutPlanner extends HTMLElement {
    connectedCallback() { this.refresh(); }
    disconnectedCallback() { clearTimeout(expiryTimer); }
    refresh() {
      clearTimeout(expiryTimer);
      const programs=enrolled();
      this.hidden=!programs.length;
      if (this.hidden) { this.replaceChildren(); return; }
      const item=current();
      if (!item) {
        this.innerHTML='<button class="m-plan-start" data-planner="open">'+calendarIcon+'לקבוע את האימון הבא</button>';
        return;
      }
      const p=programs.find(p=>p.id===item.program);
      this.innerHTML='<div class="m-plan-saved"><span class="m-plan-icon">'+calendarIcon+'</span><div class="m-plan-text"><strong>האימון שקבעת</strong><time datetime="'+new Date(item.start).toISOString()+'">'+esc(localLabel(item.start))+'</time><small>'+esc(p.name)+' · '+item.minutes+' דקות</small></div><div class="m-plan-actions"><button class="m-button m-ink" data-planner="export">ייצוא ליומן</button><button data-planner="open">שינוי מועד</button><button data-planner="cancel">ביטול המועד</button></div></div>';
      expiryTimer=setTimeout(()=>this.refresh(),Math.min(2147483647,item.start+item.minutes*60000-Date.now()+100));
    }
  }
  customElements.define("sophia-planner", WorkoutPlanner);
  document.addEventListener("click",e=>{
    const button=e.target.closest("[data-planner]");
    if (!button) return;
    if (button.dataset.planner==="open") openForm(button);
    if (button.dataset.planner==="close") dialog.close();
    if (button.dataset.planner==="export") exportItem();
    if (button.dataset.planner==="cancel") {
      const last=current();
      try { save(null); } catch { status("ביטול המועד לא נשמר בדפדפן."); return; }
      document.querySelector('sophia-planner button')?.focus({preventScroll:true});
      status(last?.exported ? "המועד בוטל באתר. אם ייבאת את האירוע, מחקי אותו גם ביומן." : "מועד האימון בוטל.");
    }
  });
  form.addEventListener("input",e=>{
    error.textContent="";
    if (e.target===fields.program) durationHint();
    if (e.target===fields.day || e.target===fields.time) updateTime();
  });
  form.addEventListener("submit",e=>{
    e.preventDefault();
    const choices=localChoices();
    if (!choices.length) { error.textContent="השעה הזו אינה קיימת בתאריך שנבחר באזור הזמן שלך. בחרי שעה אחרת."; fields.time.focus(); return; }
    const selected=choices.find(d=>d.getTime()===Number(fields.offset.value));
    if (!selected) { updateTime(); error.textContent="אזור הזמן במכשיר השתנה. בדקי את השעה ושמרי שוב."; return; }
    if (selected.getTime()<=Date.now()) { error.textContent="בחרי מועד עתידי לאימון."; fields.day.focus(); return; }
    const p=enrolled().find(p=>p.id===fields.program.value);
    if (!p) { error.textContent="הגישה לתוכנית השתנתה. סגרי את החלון ובחרי תוכנית פעילה."; return; }
    const previous=current();
    if (previous?.uid!==editing?.uid || previous?.sequence!==editing?.sequence) {
      error.textContent="המועד עודכן בכרטיסייה אחרת. סגרי את החלון כדי לראות את השינוי."; return;
    }
    const uid=previous?.uid || Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,"0")).join("")+"@sophia-digital.local";
    const item={program:p.id,order:p.orderId,start:selected.getTime(),minutes:p.minutes,uid,sequence:previous ? previous.sequence+1 : 0,exported:!!previous?.exported};
    try { save(item); } catch { error.textContent="שמירת המועד בדפדפן נכשלה. בדקי אם אחסון מקומי זמין."; return; }
    dialog.close();
    status("מועד האימון נשמר.");
  });
  dialog.addEventListener("close",()=>{
    if (history.state?.sophiaScheduleDialog) history.back();
    const button=trigger?.isConnected ? trigger : document.querySelector('sophia-planner [data-planner="open"]');
    button?.focus({preventScroll:true}); trigger=null;
  });
  window.addEventListener("popstate",()=>{ if (dialog.open && !history.state?.sophiaScheduleDialog) dialog.close(); });
  if (history.state?.sophiaScheduleDialog) {
    const {sophiaScheduleDialog,...otherState}=history.state;
    history.replaceState(otherState,"",location.href);
  }
  window.addEventListener("storage",e=>{if(e.key===key)document.querySelector("sophia-planner")?.refresh();});
  function refreshVisible() {
    const planner=document.querySelector("sophia-planner");
    if (!planner || document.hidden || dialog.open) return;
    const item=current();
    const label=item ? localLabel(item.start) : null;
    if ((planner.querySelector("time")?.textContent ?? null)!==label) planner.refresh();
  }
  window.addEventListener("pageshow",refreshVisible);
  window.addEventListener("focus",refreshVisible);
  document.addEventListener("visibilitychange",refreshVisible);
})();

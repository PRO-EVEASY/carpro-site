(() => {
  "use strict";
  const api=window.Sophia;
  if (!api) return;
  const byId=id=>document.getElementById(id);
  const scenes={
    website:{number:"01",name:"אתר המכירות",heading:"מתחילות בבחירת תוכנית",direction:"באתר אפשר להשוות בין תוכניות לבית ולחדר הכושר. בחרי איזו תוכנית להציג וצרי לה רכישת הדגמה ללא חיוב.",next:"workout",nextLabel:"אל האימון שלי"},
    workout:{number:"02",name:"האימון שלי",heading:"נכנסות לאימון הראשון",direction:"פתחי את הנגן וסמני אימון כהושלם. ההתקדמות של התוכנית מתעדכנת כאן אחרי הסימון.",next:"studio",nextLabel:"אל הסטודיו של סופיה"},
    studio:{number:"03",name:"הסטודיו של סופיה",heading:"פוגשות את המתאמנת בסטודיו",direction:"בטבלת הרכישות חפשי את שם המתאמנת שמופיע כאן. בשורה שלה אפשר לראות את התוכנית ואת מצב הגישה.",next:"website",nextLabel:"חזרה לאתר המכירות"}
  };
  const small=matchMedia("(max-width:720px)");
  const frame=byId("frame");
  const sceneId=()=>Object.hasOwn(scenes,location.hash.slice(1)) ? location.hash.slice(1) : "website";
  const programs=api.programs();
  const records=()=>api.customers();
  const orderFor=id=>records().find(o=>o.programId===id);
  const storageKey="sophia.tour.program.v1";
  let stored;
  try {stored=sessionStorage.getItem(storageKey);} catch {}
  let selected=programs.find(p=>p.id===stored) || programs.find(p=>!orderFor(p.id)) || programs.find(p=>orderFor(p.id)?.active) || programs[0];
  let viewportUrl="";
  let observedOrders = new Set(records().map(o=>o.id));
  function select(id) {
    const program = programs.find(p=>p.id===id);
    if (!program) return;
    selected = program;
    byId("program").value = program.id;
    try {sessionStorage.setItem(storageKey,program.id);} catch {}
  }
  const sampleName=()=>api.currentName() && api.currentName()!=="אורחת" ? api.currentName() : "נועה לדוגמה";
  const iframeUrl=(scene)=>scene==="website" ? "index.html" : scene==="workout" ? "member.html?program="+encodeURIComponent(selected.id) : "studio.html#customers";
  const directUrl=(route,id)=>{
    if (!small.matches || id==="website") return route;
    const url = new URL(route,location.href);
    url.searchParams.set("tour",id);
    return url.pathname.split("/").pop()+url.search+url.hash;
  };
  function row(title,value) {
    const div=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");
    dt.textContent=title;dd.textContent=value;div.append(dt,dd);return div;
  }
  function detail() {
    const id=sceneId(),order=orderFor(selected.id), facts=byId("facts"),next=byId("next"),button=byId("create");
    const currentProgram=api.programs().find(p=>p.id===selected.id);
    const sessionIds=new Set((currentProgram?.sessions || []).map(s=>s.id));
    const count=api.completed(selected.id).filter(s=>sessionIds.has(s)).length;
    const active=Boolean(order?.active);
    facts.replaceChildren(row("שם המתאמנת",order?.name || sampleName()));
    if (id==="workout" && active) facts.append(row("התקדמות בתוכנית",count+" מתוך "+sessionIds.size+" אימונים"));
    else facts.append(row("מצב הגישה",order ? active ? "גישה פעילה" : "גישה מושהית" : "טרם נרכשה"));
    if (id==="studio" && order) facts.append(row("תאריך הרכישה",new Intl.DateTimeFormat("he-IL").format(new Date(order.date))));
    button.hidden=id!=="website" || Boolean(order);
    const scene=scenes[id];
    byId("direction").textContent=scene.direction;
    if (id==="website" && order) byId("direction").textContent=active ? "כבר קיימת רכישת הדגמה לתוכנית שבחרת. אפשר להמשיך לאימון או לבחור תוכנית אחרת וליצור רכישה חדשה." : "הגישה לתוכנית הזו הושהתה בסטודיו. בחרי תוכנית אחרת כדי להדגים הרשמה חדשה.";
    if (id==="workout" && !active) byId("direction").textContent="כדי להציג אימון של התוכנית הזו, חזרי לאתר המכירות ובחרי תוכנית עם גישה פעילה או צרי רכישת הדגמה.";
    if (id==="studio" && !order) byId("direction").textContent="טבלת הסטודיו מציגה את הרכישות שנשמרו בדפדפן הזה. כדי להוסיף את התוכנית שבחרת, חזרי לשלב אתר המכירות.";
    const paused = id==="website" && order && !active;
    const destination = paused ? "studio" : id==="workout" && !active ? "website" : scene.next;
    next.hidden = id==="website" && !order;
    next.href="#"+destination;
    next.textContent=(paused ? "לניהול הגישה בסטודיו" : id==="workout" && !active ? "חזרה ליצירת רכישה" : scene.nextLabel)+" ←";
    const direct=id==="workout"&&!active ? "member.html#library" : iframeUrl(id);
    const link = byId("open");
    link.href=directUrl(direct,id);
    link.target=small.matches && id!=="website" ? "_self" : "_blank";
    byId("open-label").textContent=id==="workout" ? "פתיחת אזור האימון" : id==="studio" ? "פתיחת הסטודיו" : "פתיחת אתר המכירות";
    byId("compact-hint").textContent=id==="website" ? "אתר המכירות נפתח בכרטיסייה נפרדת." : "במסך שייפתח יש קישור חזרה לסיור.";
    if (!small.matches && viewportUrl!==direct) {
      viewportUrl=direct;
      frame.src=direct;
    }
    if (small.matches && viewportUrl) {
      viewportUrl=""; frame.removeAttribute("src");
    }
  }
  function updateScene() {
    const id=sceneId(),s=scenes[id];
    byId("scene-num").textContent="SCENE "+s.number+" / 03";
    byId("scene-num").dir="ltr";byId("scene-num").lang="en";
    byId("guide-heading").textContent=s.heading;
    byId("screen-title").textContent=s.name;
    frame.title="תצוגה פעילה של "+s.name;
    byId("status").textContent="";
    document.querySelectorAll("[data-step]").forEach(a=>{
      if (a.dataset.step===id) a.setAttribute("aria-current","step");
      else a.removeAttribute("aria-current");
    });
    detail();
  }
  function size(phone) {
    byId("viewport").classList.toggle("phone",phone);
    byId("wide").setAttribute("aria-pressed",String(!phone));
    byId("phone").setAttribute("aria-pressed",String(phone));
  }
  for (const p of programs) {
    const opt=document.createElement("option");
    opt.value=p.id;opt.textContent=p.name;byId("program").append(opt);
  }
  select(selected.id);
  byId("program").addEventListener("change",e=>{
    select(e.target.value);
    byId("status").textContent="";detail();
  });
  byId("create").addEventListener("click",()=>{
    if (orderFor(selected.id)) {detail();return;}
    try {
      api.enroll(selected.id,sampleName());
      observedOrders=new Set(records().map(o=>o.id));
      detail();
      byId("status").textContent="נוצרה רכישת הדגמה עבור "+orderFor(selected.id).name+". אפשר להמשיך לאימון.";
      byId("next").focus({preventScroll:true});
      if (!small.matches) frame.src=iframeUrl("website");
    } catch(e) {
      byId("status").textContent=e.message || "יצירת הרכישה לא הושלמה.";
    }
  });
  byId("wide").addEventListener("click",()=>size(false));
  byId("phone").addEventListener("click",()=>size(true));
  window.addEventListener("hashchange",()=>{updateScene();byId("guide-heading").focus({preventScroll:true});});
  function syncPurchases() {
    const orders = records();
    const added = orders.find(o=>!observedOrders.has(o.id));
    observedOrders = new Set(orders.map(o=>o.id));
    if (sceneId()==="website" && added) select(added.programId);
    detail();
  }
  frame.addEventListener("load",()=>{
    if (small.matches || !viewportUrl) return;
    try {
      const url = new URL(frame.contentWindow.location.href);
      const page = url.pathname.split("/").pop();
      const destination = {"index.html":"website","member.html":"workout","studio.html":"studio"}[page];
      if (destination && destination!==sceneId()) {
        const id = url.searchParams.get("program");
        if (id) select(id);
        location.hash=destination;
      }
    } catch { /* Direct links work even when local-file frames have opaque origins. */ }
  });
  window.addEventListener("storage",syncPurchases);
  window.addEventListener("focus",detail);
  window.addEventListener("pageshow",detail);
  document.addEventListener("visibilitychange",()=>{if (!document.hidden) detail();});
  small.addEventListener("change",detail);
  updateScene();
})();

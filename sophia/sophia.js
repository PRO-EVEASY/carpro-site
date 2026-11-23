/* The public demo keeps each visitor's workout data in their own browser. */
(() => {
  'use strict';
  const key = 'sophia.digital.demo.v1';
  const warmup = {title:'חימום כתפיים בעמידה',minutes:0.5,demo:true,videoUrl:'assets/shoulder-warmup.mp4'};
  const recovery = {title:'התאוששות עם שלושה מחזורי נשימה',minutes:0.4,demo:true,videoUrl:'assets/breathing-demo.mp4'};
  const specs = [
    ['home-1','יסודות בבית','בית','מתחילות','Home Foundations',190,'להכיר את התנועות הבסיסיות ולמצוא קצב שאפשר לחזור אליו.','מזרן וכיסא יציב',18,[
      [warmup,'קימה וישיבה עם כיסא',recovery],
      ['העברת משקל מצד לצד','גשר אגן על המזרן','דחיפה מול הקיר'],
      ['כריעה לכיסא בירידה איטית','נגיעות עקב בשכיבה','צעדי צד עם עצירה'],
      ['מכיסא לעמידה ולצעד קדימה','גשר אגן עם עצירה למעלה','רצף מסכם בעמידה ועל המזרן']
    ]],
    ['gym-1','יסודות בחדר הכושר','חדר כושר','מתחילות','Gym Foundations',220,'להיכנס לחדר הכושר עם סדר ברור, מהחימום ועד התרגיל האחרון.','משקולות יד וספסל',25,[
      [warmup,'היכרות עם הספסל ומשקולות היד',recovery],
      ['חתירה ביד אחת בתמיכת ספסל','לחיצת חזה עם משקולות יד','כריעה מול ספסל'],
      ['כפיפת ירך עם משקולות יד','חתירה עם עצירה קצרה','מכרע בתמיכת הספסל'],
      ['שילוב כריעה וכפיפת ירך','לחיצה וחתירה לסירוגין','סבב סיכום עם ספסל ומשקולות']
    ]],
    ['home-2','כוח בבית','בית','מתקדמות','Home Strength',240,'להעמיק את העבודה בבית עם רצפים ארוכים יותר ושילוב משקולות.','מזרן וזוג משקולות',28,[
      [warmup,'כריעה באחיזת גביע עם משקולת',recovery],
      ['מכרע לאחור עם שתי משקולות','לחיצת חזה בשכיבה על המזרן','ייצוב הליבה עם משקולת בצד אחד'],
      ['דדליפט רומני בעמידת פסיעה','חתירה לסירוגין בהטיית הגו','כריעה עם עצירה בתחתית'],
      ['שילוב מכרע ולחיצת כתף','סבב ליבה במשקל גוף','רצף כוח מסכם עם זוג משקולות']
    ]],
    ['gym-2','כוח בחדר הכושר','חדר כושר','מתקדמות','Gym Strength',280,'לבנות רצף עבודה מדורג עם משקולות ומכשירים, צעד אחר צעד.','משקולות ומכשירי חדר כושר',35,[
      [warmup,'חתירה בישיבה מול כבל',recovery],
      ['לחיצת רגליים בטווח נשלט','משיכת פולי עליון','לחיצת חזה במכשיר'],
      ['דדליפט רומני עם משקולות יד','חתירה חד־צדדית בכבל','מכרע לאחור עם עצירה'],
      ['משיכה אנכית וחתירה ברצף','שני סטים לרגליים במכשירים','אימון מסכם בתחנות כוח']
    ]]
  ];
  const base = specs.map(([id,name,place,level,edition,price,description,equipment,minutes,weeks]) => ({
    id,name,place,level,edition,price,description,equipment,minutes,
    sessions:weeks.flatMap((lessons,w)=>lessons.map((lesson,i)=>({
      id:id+'-s'+(3*w+i+1),week:w+1,
      ...(typeof lesson==='string' ? {title:lesson,minutes:minutes+i*2} : lesson)
    })))
  }));

  function cycles(count,start,phase,up,down) {
    return Array.from({length:count},(_,i)=>{
      const t=start+i*phase*2;
      return [[t,t+phase,up],[t+phase,t+phase*2,down]];
    }).flat();
  }
  const builtInMedia = new Map([
    [warmup.videoUrl,{
      label:'תרגול מודרך באיור · 30 שניות',poster:'assets/shoulder-warmup.jpg',
      note:'ארבע חזרות בעמידה, ללא ציוד. עקבי אחרי האיור והצלילים בקצב שנוח לך.',
      transcript:'עמדי בנוחות, כפות הרגליים על הרצפה והידיים לצידי הגוף. הרימי את הידיים לצדדים במשך שלוש שניות, עד לגובה שנוח לך. הורידי אותן במשך שלוש שניות. חזרי על התנועה ארבע פעמים וסיימי עם הידיים לצידי הגוף.',
      cues:[[0,3,'עמדי בנוחות כשהידיים לצידי הגוף.'],...cycles(4,3,3,'הרימי ידיים לצדדים עד לגובה שנוח לך.','החזירי את הידיים באיטיות לצידי הגוף.'),[27,30,'התרגול הסתיים.']]
    }],
    [recovery.videoUrl,{
      label:'תרגול נשימה מונפש · 24 שניות',poster:'assets/breathing-poster.jpg',
      note:'שאפי כשהעיגול מתרחב והצליל עולה. נשפי כשהם חוזרים יחד.',
      transcript:'העיגול מתרחב במשך ארבע שניות ומתכווץ במשך ארבע שניות. שאפי עם ההתרחבות ונשפי עם ההתכווצות, בקצב שנוח לך. בתרגול שלושה מחזורים.',
      cues:cycles(3,0,4,'שאיפה · העיגול מתרחב.','נשיפה · העיגול מתכווץ.')
    }]
  ]);
  const generatedTracks = new WeakMap();
  function configureLessonVideo(video,source) {
    const url=source ? new URL(source,document.baseURI).href : '';
    const key=Array.from(builtInMedia.keys()).find(path=>url===new URL(path,document.baseURI).href);
    const info=builtInMedia.get(key);
    let track=generatedTracks.get(video);
    if (track) {
      track.mode='hidden';
      for (const cue of Array.from(track.cues || [])) track.removeCue(cue);
      track.mode='disabled';
    }
    if (!info) { video.removeAttribute('poster'); return null; }
    video.poster=info.poster;
    if (window.VTTCue) {
      if (!track) {
        track=video.addTextTrack('captions','עברית','he');
        generatedTracks.set(video,track);
      }
      for (const [start,end,text] of info.cues) track.addCue(new VTTCue(start,end,text));
    }
    return info;
  }
  const seed = () => ({version:1,name:'',orders:[],edits:{},added:{},done:{},times:{},coaching:false});
  const tabKey = key + '.temporary';
  let memory = seed();
  let memoryOnly = false;

  function unpack(raw) {
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.version !== 1) return null;
    const state = seed();
    if (typeof s.name === 'string') state.name = s.name;
    if (Array.isArray(s.orders)) state.orders = s.orders.filter(order =>
      order && typeof order.id === 'string' && base.some(p => p.id === order.programId));
    for (const field of ['edits','added','done','times']) {
      if (s[field] && typeof s[field] === 'object' && !Array.isArray(s[field])) state[field] = s[field];
    }
    state.coaching = s.coaching === true;
    return state;
  }

  function read() {
    if (memoryOnly) return memory;
    try {
      const temporary = unpack(sessionStorage.getItem(tabKey));
      if (temporary) return temporary;
    } catch {}
    try { return unpack(localStorage.getItem(key)) || seed(); }
    catch { return memory; }
  }

  function update(fn, {requireStorage = false} = {}) {
    let state = read();
    if (requireStorage) state = JSON.parse(JSON.stringify(state));
    fn(state);
    const json = JSON.stringify(state);
    try {
      localStorage.setItem(key, json);
      memoryOnly = false;
      try { sessionStorage.removeItem(tabKey); } catch {}
    } catch {
      // Some in-app browsers permit tab storage while persistent writes are restricted.
      try { sessionStorage.setItem(tabKey, json); memoryOnly = false; }
      catch {
        if (requireStorage) throw Error('ההצטרפות לא נשמרה. הפעילי שמירת נתוני אתר בהגדרות הדפדפן או פתחי את הקישור בדפדפן אחר ונסי שוב.');
        memoryOnly = true;
      }
    }
    memory = state;
    window.dispatchEvent(new Event('sophia-change'));
  }
  const hasProgram=id=>base.some(p=>p.id===id);
  function programs() {
    const state=read();
    return base.map(p=>({...p,sessions:[...p.sessions,...(state.added[p.id]||[])].map(s=>({...s,title:state.edits[p.id+'/'+s.id]||s.title}))}));
  }
  function hasSession(p,s){return programs().find(row=>row.id===p)?.sessions.some(row=>row.id===s);}
  function enroll(programId,name) {
    if(!hasProgram(programId))throw Error('התוכנית לא נמצאה');
    const label=Array.from(String(name || '').trim()).slice(0,45).join('') || 'אורחת';
    update(s=>{
      s.name=label;
      const existing=s.orders.find(o=>o.programId===programId);
      if(existing){if(!existing.active)throw Error('הגישה לתוכנית הושהתה. אפשר לעדכן אותה בסטודיו.');return;}
      s.orders.unshift({id:globalThis.crypto?.randomUUID?.()||'order-'+Date.now(),name:label,programId,date:new Date().toISOString(),active:true,price:base.find(p=>p.id===programId).price});
    }, {requireStorage:true});
  }
  function addSession(p,session){
    const title=String(session.title||'').trim().slice(0,85),minutes=Number(session.minutes),week=Number(session.week);
    if(!hasProgram(p)||!title||!Number.isInteger(week)||week<1||week>52||!Number.isInteger(minutes)||minutes<1||minutes>240)throw Error('בדקי את פרטי האימון.');
    const id='lesson-'+(globalThis.crypto?.randomUUID?.()||String(Date.now()));
    update(s=>{(s.added[p]||=[]).push({id,title,minutes,week})});return id;
  }
  function reset(){
    try { localStorage.removeItem(key); } catch {}
    try { sessionStorage.removeItem(tabKey); } catch {}
    memory = seed();
    memoryOnly = false;
    window.dispatchEvent(new Event('sophia-change'));
  }
  window.Sophia={programs,enroll,reset,customers:()=>read().orders.map(o=>({...o})),
    configureLessonVideo:(video,source)=>configureLessonVideo(video,source),
    enrolled:()=>read().orders.filter(o=>o.active).map(o=>o.programId),currentName:()=>read().name||'אורחת',
    setAccess:(id,active)=>update(s=>{const o=s.orders.find(o=>o.id===id);if(o)o.active=Boolean(active);}),
    setSessionTitle:(p,id,title)=>{const name=String(title||'').trim().slice(0,85);if(!hasSession(p,id)||!name)throw Error('שם האימון חסר');update(s=>{s.edits[p+'/'+id]=name;});},
    addSession, completed:p=>[...(read().done[p]||[])],completedCount:p=>(read().done[p]||[]).length,
    markComplete:(p,id)=>{if(hasSession(p,id))update(s=>{const list=s.done[p]||=[];if(!list.includes(id))list.push(id);});},
    progressTime:(p,id)=>Number(read().times[p+'/'+id]||0),
    setProgressTime:(p,id,seconds)=>{if(Number.isFinite(seconds)&&seconds>=0)update(s=>{s.times[p+'/'+id]=seconds;});},
    requestCoaching:()=>update(s=>{s.coaching=true;}),coachingRequested:()=>read().coaching
  };
})();

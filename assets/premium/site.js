'use strict';
(() => {
  const contact = { international: '972506530471', national: '0506530471', label: '050-653-0471' };
  const defaultMessage = 'שלום CockpitPro, אשמח לפרטים על שדרוג המולטימדיה ברכב שלי.';
  const waUrl = message => `https://wa.me/${contact.international}?text=${encodeURIComponent(message)}`;
  document.querySelectorAll('[data-whatsapp]').forEach(a => { a.href = waUrl(defaultMessage); });
  document.querySelectorAll('[data-wa-message]').forEach(a => { a.href = waUrl(a.dataset.waMessage); });
  document.querySelectorAll('[data-phone]').forEach(a => { a.href = `tel:${contact.national}`; const s = a.querySelector('span[dir]'); if (s) s.textContent = contact.label; else a.textContent = contact.label; });
  document.getElementById('year').textContent = new Date().getFullYear();

  // Reviewed owner footage; brand films are explicitly identified.
  const videos = [
  {
    "id": "skywell-et5",
    "file": "assets/premium/installations/skywell-et5.mp4",
    "poster": "assets/premium/skywell-et5-poster.jpg",
    "filter": "skywell",
    "category": "SKYWELL ET5 · מולטימדיה",
    "title": "SKYWELL ET5. החבילה בפעולה.",
    "subtitle": "מסך בית בעברית, סרטונים ומוזיקה",
    "duration": "1:45",
    "caption": "הדגמה ערוכה מתוך SKYWELL ET5: מסך הבית בעברית, KosherTube ו־YouTube Music. קטעי המתנה לטעינה הוסרו מהסרטון. התאמת האפליקציות נבדקת לפי גרסת המערכת.",
    "wide": false,
    "start": 0
  },
  {
    "id": "chery-split",
    "file": "assets/premium/installations/chery-split.mp4",
    "poster": "assets/premium/chery-split-poster.jpg",
    "filter": "chery",
    "category": "CHERY · פיצול מסך",
    "title": "ניווט ווידאו. זה לצד זה.",
    "subtitle": "שני שימושים על המסך המקורי",
    "duration": "0:12",
    "caption": "תיעוד ברכב צ׳רי: מפת ניווט לצד וידאו על המסך הראשי. אפשרויות התצוגה מותאמות לדגם ולמערכת.",
    "wide": false,
    "start": 0
  },
  {
    "id": "chery-controls",
    "file": "assets/premium/installations/chery-controls.mp4",
    "poster": "assets/premium/chery-controls-poster.jpg",
    "filter": "chery",
    "category": "CHERY · המסך ולוח השעונים",
    "title": "מהמסך אל לוח השעונים.",
    "subtitle": "אפליקציות, מגע ומעבר בין תצוגות",
    "duration": "0:34",
    "caption": "תיעוד ברכב צ׳רי: בחירת יישום, הפעלת וידאו ותצוגה גם בלוח השעונים. התמיכה תלויה בדגם הרכב ובמערכת.",
    "wide": false,
    "start": 0
  },
  {
    "id": "aiways-full-tour",
    "file": "assets/premium/installations/aiways-full-tour.mp4",
    "poster": "assets/premium/aiways-full-tour-poster.jpg",
    "filter": "aiways",
    "category": "AIWAYS U5 · סיור בחבילה",
    "title": "AIWAYS U5. כל החוויה.",
    "subtitle": "אפליקציות, ניווט, מוזיקה וטלוויזיה",
    "duration": "0:40",
    "caption": "סקירת CockpitPro ב־AIWAYS U5: רשת יישומים, ניווט ומוזיקה ותיעוד CockpitPro TV.",
    "wide": false,
    "start": 0
  },
  {
    "id": "aiways-cockpit-tv",
    "file": "assets/premium/installations/aiways-cockpit-tv.mp4",
    "poster": "assets/premium/aiways-cockpit-tv-poster.jpg",
    "filter": "aiways",
    "category": "AIWAYS U5 · CockpitPro TV",
    "title": "טלוויזיה שמותאמת למסך.",
    "subtitle": "ממשק CockpitPro TV בפעולה",
    "duration": "0:32",
    "caption": "תיעוד ערוך של CockpitPro TV ב־AIWAYS U5, כולל תפריטי תוכן ובחירה במסך המגע.",
    "wide": true,
    "start": 0
  },
  {
    "id": "chery-night-navigation",
    "file": "assets/premium/installations/chery-night-navigation.mp4",
    "poster": "assets/premium/chery-night-navigation-poster.jpg",
    "filter": "chery",
    "category": "CHERY · ניווט בלוח השעונים",
    "title": "הניווט מול העיניים.",
    "subtitle": "מפה בלוח השעונים, וידאו במסך הראשי",
    "duration": "0:14",
    "caption": "תיעוד לילה ברכב צ׳רי: מפת ניווט בלוח השעונים בזמן שהמסך הראשי מציג וידאו. התאמה לפי הדגם.",
    "wide": false,
    "start": 0
  },
  {
    "id": "aiways-tv-demo",
    "file": "assets/premium/installations/aiways-tv-demo.mp4",
    "poster": "assets/premium/aiways-tv-demo-poster.jpg",
    "filter": "aiways",
    "category": "AIWAYS U5 · מסך המגע",
    "title": "בוחרים תוכן. ונכנסים לצפות.",
    "subtitle": "מבט מקרוב על ממשק הטלוויזיה",
    "duration": "0:29",
    "caption": "תיעוד של ממשק הטלוויזיה ובחירת תכנים במסך הרכב. זהו אותו ממשק המוצג בסרטון CockpitPro הערוך של AIWAYS U5.",
    "wide": true,
    "start": 0
  },
  {
    "id": "chery-cluster",
    "file": "assets/premium/installations/chery-cluster.mp4",
    "poster": "assets/premium/chery-cluster-poster.jpg",
    "filter": "chery",
    "category": "CHERY · תצוגת ניווט",
    "title": "שתי תצוגות. רכב אחד.",
    "subtitle": "וידאו במסך הראשי וניווט בלוח השעונים",
    "duration": "0:18",
    "caption": "תיעוד ברכב צ׳רי של הווידאו במסך הראשי ומפת הניווט בלוח השעונים. הדגם המדויק אינו מצוין בתיעוד.",
    "wide": false,
    "start": 0
  },
  {
    "id": "applications",
    "file": "eveasynew.mp4",
    "poster": "assets/premium/apps-poster.jpg",
    "filter": "apps",
    "category": "יישומים ומולטימדיה",
    "title": "האפליקציות. על המסך שלכם.",
    "subtitle": "הצצה למערכת היישומים המותקנת ברכב",
    "duration": "0:17",
    "caption": "מסך האפליקציות בהתקנה קיימת. האפשרויות בפועל תלויות בהתאמה לרכב."
  },
  {
    "id": "home",
    "file": "eveasy.mp4",
    "poster": "assets/premium/home-poster.jpg",
    "filter": "apps",
    "category": "מסך הבית",
    "title": "ממשק שמרגיש אישי.",
    "subtitle": "מסך בית בעיצוב שעושה את ההבדל",
    "duration": "0:24",
    "caption": "ממשק הבית על מסך המולטימדיה בהתקנה קיימת."
  },
  {
    "id": "voyah",
    "file": "assets/premium/voyah-500-brand-film.mp4",
    "poster": "assets/premium/voyah-500-poster.jpg",
    "filter": "brand",
    "category": "VOYAH · סרטון תדמית",
    "title": "VOYAH. חוויית CockpitPro.",
    "subtitle": "סרטון התדמית המעודכן לחבילת ההתקנה",
    "duration": "0:24",
    "caption": "סרטון תדמית של CockpitPro ל־VOYAH. התאמת חבילת האפליקציות נבדקת לפי דגם הרכב וגרסת המערכת."
  }
];
  const grid = document.getElementById('video-grid');
  const count = document.getElementById('gallery-count');
  const dialog = document.getElementById('video-dialog');
  const player = document.getElementById('showcase-player');
  const title = document.getElementById('video-title');
  const category = document.getElementById('video-category');
  const caption = document.getElementById('video-caption');
  const error = document.getElementById('video-error');
  let activeTrigger = null;
  function element(tag, cls, text) { const n=document.createElement(tag); if(cls)n.className=cls;if(text)n.textContent=text;return n; }
  function icon(name) { const ns='http://www.w3.org/2000/svg'; const s=document.createElementNS(ns,'svg');const u=document.createElementNS(ns,'use');u.setAttribute('href',`#i-${name}`);s.append(u);s.setAttribute('aria-hidden','true');return s; }
  function openVideo(video, trigger) {
    activeTrigger=trigger;title.textContent=video.title;category.textContent=video.category;caption.textContent=video.caption;error.hidden=true;
    document.getElementById('video-direct').href=video.file;
    player.poster=video.poster;player.onloadedmetadata=()=>{if(video.start)player.currentTime=Math.min(video.start,Math.max(0,player.duration-.5));};player.src=video.file;
    dialog.showModal();document.documentElement.style.overflow='hidden';
    player.play().catch(()=>{});
  }
  document.querySelectorAll('[data-feature-video]').forEach(button=>{
    const video=videos.find(v=>v.id===button.dataset.featureVideo);
    if(video)button.addEventListener('click',()=>openVideo(video,button));
  });
  for(const video of videos) {
    const card=element('article','video-card');card.dataset.category=video.filter;if(video.wide)card.classList.add('video-wide');
    const button=element('button','video-open');button.type='button';button.setAttribute('aria-label',`ניגון סרטון: ${video.title}`);
    const image=element('img');image.src=video.poster;image.alt=video.subtitle;image.loading='lazy';image.decoding='async';image.width=576;image.height=1024;
    button.style.setProperty('--poster',`url("${new URL(video.poster,document.baseURI).href}")`);
    const play=element('span','play-control');play.append(icon('play'));
    button.append(image,play,element('span','duration',video.duration),element('span','video-badge',video.category));
    button.addEventListener('click',()=>openVideo(video,button));
    const info=element('div','video-info');const copy=element('div');copy.append(element('h3','',video.title),element('p','',video.subtitle));info.append(copy,icon('arrow'));card.append(button,info);grid.append(card);
  }
  count.textContent=`${videos.length} סרטונים לצפייה`;
  for(const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click',()=>{
    const filter=button.dataset.filter;let visible=0;
    document.querySelectorAll('[data-filter]').forEach(b=>{const selected=b===button;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
    grid.querySelectorAll('.video-card').forEach(card=>{card.hidden=filter!=='all'&&card.dataset.category!==filter;if(!card.hidden)visible++;});
    count.textContent=`${visible} סרטונים לצפייה`;
  });
  dialog.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{player.pause();player.onloadedmetadata=null;player.removeAttribute('src');player.load();document.documentElement.style.overflow='';if(activeTrigger)activeTrigger.focus();});
  player.addEventListener('error',()=>{if(dialog.open&&player.hasAttribute('src'))error.hidden=false;});

  const form=document.getElementById('contact-form');
  const brand=document.getElementById('brand');
  const note=document.getElementById('brand-note');
  brand.addEventListener('change',()=>{const driver=['צ׳רי','אומודה','ג׳אקו'].includes(brand.value);note.classList.toggle('driver',driver);note.textContent=driver?'כולל בדיקת התאמה לאפליקציית הגדרות נהג בדגם שלכם.':brand.value==='סקייוול'?'חבילת מולטימדיה ל־SKYWELL ET5, לפי גרסת המערכת.':'נתאים חבילת מולטימדיה לרכב שלכם, בהתאם לדגם ולגרסת המערכת.';});
  document.querySelectorAll('[data-contact-brand]').forEach(link=>link.addEventListener('click',()=>{brand.value=link.dataset.contactBrand;form.elements.model.value=link.dataset.contactModel||'';brand.dispatchEvent(new Event('change'));}));
  form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const values=new FormData(form);const message=`שלום CockpitPro, אשמח לשדרג את המולטימדיה ברכב שלי.\nמותג: ${values.get('brand')}\nדגם: ${String(values.get('model')).trim()}\nשנת ייצור: ${values.get('year')}\nעיר: ${String(values.get('city')).trim()}\nאשמח לפרטים על החבילה ב־500 ₪ בתשלום חד־פעמי לכל החיים.`;window.location.assign(waUrl(message));});
})();

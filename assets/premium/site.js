'use strict';
(() => {
  const contact = { international: '972506530471', national: '0506530471', label: '050-653-0471' };
  const defaultMessage = 'שלום CockpitPro, אשמח לפרטים על שדרוג המולטימדיה ברכב שלי.';
  const waUrl = message => `https://wa.me/${contact.international}?text=${encodeURIComponent(message)}`;
  document.querySelectorAll('[data-whatsapp]').forEach(a => { a.href = waUrl(defaultMessage); });
  document.querySelectorAll('[data-wa-message]').forEach(a => { a.href = waUrl(a.dataset.waMessage); });
  document.querySelectorAll('[data-phone]').forEach(a => { a.href = `tel:${contact.national}`; const s = a.querySelector('span[dir]'); if (s) s.textContent = contact.label; else a.textContent = contact.label; });
  document.getElementById('year').textContent = new Date().getFullYear();

  // Reviewed existing footage plus one locally available owner brand film.
  // The VOYAH film is labelled as an advertisement, not an installation demo.
  const videos = [
    { id:'applications', file:'eveasynew.mp4', poster:'assets/premium/apps-poster.jpg', filter:'apps', category:'יישומים ומולטימדיה', title:'האפליקציות. על המסך שלכם.', subtitle:'הצצה למערכת היישומים המותקנת ברכב', duration:'0:17', caption:'סרטון קיים של העסק: מסך האפליקציות במערכת הרכב. האפשרויות בפועל תלויות בהתאמה לרכב.' },
    { id:'home', file:'eveasy.mp4', poster:'assets/premium/home-poster.jpg', filter:'interface', category:'מסך הבית', title:'ממשק שמרגיש אישי.', subtitle:'מסך בית בעיצוב שעושה את ההבדל', duration:'0:24', caption:'סרטון קיים של העסק: ממשק הבית על מסך המולטימדיה. הממשק המוצג הוא דוגמה להתקנה קיימת.' },
    { id:'voyah', file:'assets/premium/voyah-brand-film.mp4', poster:'assets/premium/voyah-poster.jpg', filter:'brand', category:'VOYAH · סרטון תדמית', title:'VOYAH. חוויית CockpitPro.', subtitle:'סרטון תדמית לחבילת ההתקנה', duration:'0:03', caption:'סרטון תדמית של CockpitPro ל־VOYAH. התאמת חבילת האפליקציות נבדקת לפי דגם הרכב וגרסת המערכת.' }
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
    player.poster=video.poster;player.src=video.file;
    dialog.showModal();document.documentElement.style.overflow='hidden';
    player.play().catch(()=>{});
  }
  document.querySelectorAll('[data-feature-video]').forEach(button=>{
    const video=videos.find(v=>v.id===button.dataset.featureVideo);
    if(video)button.addEventListener('click',()=>openVideo(video,button));
  });
  for(const video of videos) {
    const card=element('article','video-card');card.dataset.category=video.filter;
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
  dialog.addEventListener('close',()=>{player.pause();player.removeAttribute('src');player.load();document.documentElement.style.overflow='';if(activeTrigger)activeTrigger.focus();});
  player.addEventListener('error',()=>{if(dialog.open&&player.hasAttribute('src'))error.hidden=false;});

  const form=document.getElementById('contact-form');
  const brand=document.getElementById('brand');
  const note=document.getElementById('brand-note');
  brand.addEventListener('change',()=>{const driver=['צ׳רי','אומודה','ג׳אקו'].includes(brand.value);note.classList.toggle('driver',driver);note.textContent=driver?'כולל בדיקת התאמה לאפליקציית הגדרות נהג בדגם שלכם.':'נתאים חבילת מולטימדיה לרכב שלכם, בהתאם לדגם ולגרסת המערכת.';});
  form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const values=new FormData(form);const message=`שלום CockpitPro, אשמח לשדרג את המולטימדיה ברכב שלי.\nמותג: ${values.get('brand')}\nדגם: ${String(values.get('model')).trim()}\nשנת ייצור: ${values.get('year')}\nעיר: ${String(values.get('city')).trim()}\nאשמח לפרטים על החבילה ב־500 ₪ בתשלום חד־פעמי לכל החיים.`;window.location.assign(waUrl(message));});
})();

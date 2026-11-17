'use strict';

// Sources are attached only after an explicit play request. Posters may load lazily.
const cards = [...document.querySelectorAll('.video-card')];
const videos = cards.map(card => card.querySelector('video'));
const filters = [...document.querySelectorAll('[data-filter]')];
const count = document.querySelector('#gallery-count');

function pauseAll(except) {
  for (const video of videos) if (video !== except) video.pause();
}

for (const card of cards) {
  const launch = card.querySelector('.video-launch');
  const video = card.querySelector('video');
  const error = card.querySelector('.video-error');
  launch.addEventListener('click', () => {
    pauseAll(video);
    error.hidden = true;
    video.src = video.dataset.src;
    video.hidden = false;
    launch.hidden = true;
    video.focus({ preventScroll: true });
    video.play().catch(() => {
      // The native controls remain usable when a browser declines scripted playback.
      if (video.error) error.hidden = false;
    });
  });
  video.addEventListener('play', () => pauseAll(video));
  video.addEventListener('error', () => { error.hidden = false; });
}

for (const filter of filters) {
  filter.addEventListener('click', () => {
    for (const button of filters) button.setAttribute('aria-pressed', String(button === filter));
    let shown = 0;
    for (const card of cards) {
      card.hidden = filter.dataset.filter !== 'all' && card.dataset.category !== filter.dataset.filter;
      if (card.hidden) card.querySelector('video').pause();
      else shown++;
    }
    count.textContent = shown === 1 ? 'סרטון אחד לצפייה' : `${shown} סרטונים לצפייה`;
  });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAll(); });
window.addEventListener('pagehide', () => pauseAll());
document.querySelector('.gallery-tools').hidden = false;

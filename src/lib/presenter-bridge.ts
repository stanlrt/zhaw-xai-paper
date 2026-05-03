import {Presenter} from '@motion-canvas/core';

const channel = new BroadcastChannel('mc-slides');
const STORAGE_KEY = 'mc-presenter-slide';
let lastInfo: any = null;

function attach(instance: any) {
  if (instance.__mcBridged) return;
  instance.__mcBridged = true;
  (window as any).__mcPresenter = instance;

  let restoredOnce = false;

  instance.onSlidesChanged.subscribe((slides: any[]) => {
    const ids = slides.map(s => s.id ?? s.name ?? String(s));
    channel.postMessage({type: 'slides', ids});

    // After first slides-changed, try to restore last position from localStorage
    if (!restoredOnce) {
      restoredOnce = true;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && ids.includes(saved)) {
          // Tiny delay so presenter has finished its boot sequence
          setTimeout(() => {
            try {
              instance.requestSlide(saved);
            } catch {}
          }, 60);
        }
      } catch {}
    }
  }, true);

  instance.onInfoChanged.subscribe((info: any) => {
    lastInfo = info;
    if (info.currentSlideId) {
      try {
        localStorage.setItem(STORAGE_KEY, info.currentSlideId);
      } catch {}
    }
    channel.postMessage({
      type: 'info',
      currentSlideId: info.currentSlideId,
      nextSlideId: info.nextSlideId,
      isWaiting: info.isWaiting,
      index: info.index,
      count: info.count,
    });
  }, true);
}

const origPresent = Presenter.prototype.present;
Presenter.prototype.present = function (settings: any) {
  attach(this);
  return origPresent.call(this, settings);
};

channel.addEventListener('message', e => {
  if (e.data?.type === 'sync') {
    if (lastInfo) {
      channel.postMessage({
        type: 'info',
        currentSlideId: lastInfo.currentSlideId,
        nextSlideId: lastInfo.nextSlideId,
        isWaiting: lastInfo.isWaiting,
        index: lastInfo.index,
        count: lastInfo.count,
      });
    }
    return;
  }
  if (e.data?.type === 'reset-slide') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    return;
  }
  const p: any = (window as any).__mcPresenter;
  if (!p) return;
  switch (e.data?.type) {
    case 'next':
      p.requestNextSlide();
      break;
    case 'prev':
      p.requestPreviousSlide();
      break;
    case 'goto':
      if (e.data.id) p.requestSlide(e.data.id);
      break;
  }
});

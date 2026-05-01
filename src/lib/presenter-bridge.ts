import {Presenter} from '@motion-canvas/core';

const CHANNEL = 'mc-slides';
const channel = new BroadcastChannel(CHANNEL);

const origPresent = Presenter.prototype.present;
Presenter.prototype.present = function (settings: any) {
  this.onInfoChanged.subscribe(info => {
    channel.postMessage({
      type: 'info',
      currentSlideId: info.currentSlideId,
      nextSlideId: info.nextSlideId,
      isWaiting: info.isWaiting,
      index: info.index,
      count: info.count,
    });
  });
  this.onSlidesChanged.subscribe(slides => {
    channel.postMessage({
      type: 'slides',
      ids: slides.map((s: any) => s.id ?? s.name ?? String(s)),
    });
  });
  (window as any).__mcPresenter = this;
  return origPresent.call(this, settings);
};

channel.addEventListener('message', e => {
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

console.log('[mc-bridge] presenter bridge installed');

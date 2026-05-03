import {Presenter} from '@motion-canvas/core';

const channel = new BroadcastChannel('mc-slides');
let lastInfo: any = null;

function attach(instance: any) {
  if (instance.__mcBridged) return;
  instance.__mcBridged = true;
  (window as any).__mcPresenter = instance;

  instance.onInfoChanged.subscribe((info: any) => {
    lastInfo = info;
    channel.postMessage({
      type: 'info',
      currentSlideId: info.currentSlideId,
      nextSlideId: info.nextSlideId,
      isWaiting: info.isWaiting,
      index: info.index,
      count: info.count,
    });
  }, true);

  instance.onSlidesChanged.subscribe((slides: any[]) => {
    channel.postMessage({
      type: 'slides',
      ids: slides.map(s => s.id ?? s.name ?? String(s)),
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

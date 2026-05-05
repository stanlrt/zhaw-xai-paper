import {Presenter} from '@motion-canvas/core';

const channel = new BroadcastChannel('mc-slides');
const STORAGE_KEY = 'mc-presenter-slide';
const FS_KEY = 'mc-presenter-fullscreen';
let lastInfo: any = null;
let lastSlideIds: string[] = [];

function attach(instance: any) {
  if (instance.__mcBridged) return;
  instance.__mcBridged = true;
  (window as any).__mcPresenter = instance;

  // Capture the saved slide BEFORE onInfoChanged starts overwriting it
  // with the boot slide.
  let savedTarget: string | null = null;
  try {
    savedTarget = localStorage.getItem(STORAGE_KEY);
  } catch {}
  let restoredOnce = false;
  let restoreReached = !savedTarget;

  instance.onSlidesChanged.subscribe((slides: any[]) => {
    const ids = slides.map(s => s.id ?? s.name ?? String(s));
    lastSlideIds = ids;
    channel.postMessage({type: 'slides', ids});

    if (!restoredOnce && ids.length > 0) {
      restoredOnce = true;
      if (savedTarget && ids.includes(savedTarget)) {
        // Defer past first paint — seek replays frames from scene start
        // and blocks the main thread; running it inside present() boot
        // freezes the tab long enough for the browser to kill it.
        setTimeout(() => {
          try {
            instance.requestSlide(savedTarget!);
          } catch {}
        }, 200);
      } else {
        restoreReached = true;
      }
    }
  }, true);

  instance.onInfoChanged.subscribe((info: any) => {
    lastInfo = info;
    if (info.currentSlideId) {
      // Don't clobber the saved target while the bootup seek is still
      // catching up to it — otherwise reload-after-reload walks back
      // toward slide 1.
      if (!restoreReached && info.currentSlideId === savedTarget) {
        restoreReached = true;
      }
      if (restoreReached) {
        try {
          localStorage.setItem(STORAGE_KEY, info.currentSlideId);
        } catch {}
      }
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

const PROTO = Presenter.prototype as any;
if (!PROTO.__bridgePatched) {
  PROTO.__bridgePatched = true;
  const origPresent = PROTO.present;
  PROTO.present = function (settings: any) {
    attach(this);
    return origPresent.call(this, settings);
  };
}

// Fullscreen persistence: track state, restore on next user gesture after reload.
function setupFullscreenRestore() {
  const onChange = () => {
    try {
      if (document.fullscreenElement) {
        localStorage.setItem(FS_KEY, '1');
      } else {
        localStorage.removeItem(FS_KEY);
      }
    } catch {}
  };
  document.addEventListener('fullscreenchange', onChange);

  let want = false;
  try {
    want = localStorage.getItem(FS_KEY) === '1';
  } catch {}
  if (!want) return;

  const tryEnter = () => {
    if (document.fullscreenElement) return cleanup();
    const el = document.documentElement;
    el.requestFullscreen?.().then(cleanup).catch(() => {});
  };
  const handlers: Array<[string, EventListener]> = [
    ['keydown', tryEnter],
    ['pointerdown', tryEnter],
    ['click', tryEnter],
  ];
  const cleanup = () => {
    for (const [ev, fn] of handlers) window.removeEventListener(ev, fn, true);
  };
  for (const [ev, fn] of handlers) window.addEventListener(ev, fn, true);
}

if (typeof window !== 'undefined' && !(window as any).__mcBridgeFsInit) {
  (window as any).__mcBridgeFsInit = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupFullscreenRestore, {once: true});
  } else {
    setupFullscreenRestore();
  }
}

channel.addEventListener('message', e => {
  if (e.data?.type === 'sync') {
    if (lastSlideIds.length) {
      channel.postMessage({type: 'slides', ids: lastSlideIds});
    }
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

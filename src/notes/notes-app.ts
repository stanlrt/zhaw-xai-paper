import notes from 'virtual:slide-notes';

const channel = new BroadcastChannel('mc-slides');

const $status = document.getElementById('status')!;
const $counter = document.getElementById('counter')!;
const $timer = document.getElementById('timer')!;
const $curId = document.getElementById('current-id')!;
const $curNotes = document.getElementById('current-notes')!;
const $curOwner = document.getElementById('current-owner')!;
const $nextId = document.getElementById('next-id')!;
const $nextNotes = document.getElementById('next-notes')!;
const $nextOwner = document.getElementById('next-owner')!;

let startTime: number | null = null;

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function tick() {
  $timer.textContent = startTime === null ? '00:00' : fmt(Date.now() - startTime);
}
setInterval(tick, 500);

function render(info: {
  currentSlideId: string | null;
  nextSlideId: string | null;
  index: number | null;
  count: number;
}) {
  $status.textContent = info.currentSlideId ? 'live' : 'waiting';
  $status.dataset.state = info.currentSlideId ? 'live' : 'waiting';

  $counter.textContent =
    info.index !== null && info.count
      ? `${info.index + 1} / ${info.count}`
      : '— / —';

  const cur = info.currentSlideId;
  const nxt = info.nextSlideId;
  const curMeta = cur ? notes[cur] : undefined;
  const nxtMeta = nxt ? notes[nxt] : undefined;

  $curId.textContent = cur ?? '—';
  $curNotes.textContent = curMeta?.notes ?? '(no notes)';
  $curOwner.textContent = curMeta?.owner ?? '';
  $nextId.textContent = nxt ?? '—';
  $nextNotes.textContent = nxtMeta?.notes ?? '';
  $nextOwner.textContent = nxtMeta?.owner ?? '';
}

channel.addEventListener('message', e => {
  if (e.data?.type === 'info') {
    if (startTime === null && e.data.currentSlideId) startTime = Date.now();
    render(e.data);
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === ' ') {
    channel.postMessage({type: 'next'});
    e.preventDefault();
  } else if (e.key === 'ArrowLeft') {
    channel.postMessage({type: 'prev'});
    e.preventDefault();
  } else if (e.key.toLowerCase() === 'r') {
    startTime = Date.now();
  }
});

render({currentSlideId: null, nextSlideId: null, index: null, count: 0});

let synced = false;
let attempts = 0;
const syncTimer = setInterval(() => {
  if (synced || attempts++ > 40) {
    clearInterval(syncTimer);
    return;
  }
  channel.postMessage({type: 'sync'});
}, 250);
channel.addEventListener('message', e => {
  if (e.data?.type === 'info') synced = true;
});

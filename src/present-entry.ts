import { Presenter } from "@motion-canvas/core";
import "./lib/presenter-bridge";
import project from "./project?project";

const presenter = new Presenter(project);
const canvas = presenter.stage.finalBuffer;

document.documentElement.style.height = "100%";
document.body.style.margin = "0";
document.body.style.height = "100vh";
document.body.style.background = "#000";
document.body.style.overflow = "hidden";
document.body.style.display = "flex";
document.body.style.alignItems = "center";
document.body.style.justifyContent = "center";
canvas.style.maxWidth = "100vw";
canvas.style.maxHeight = "100vh";
canvas.style.width = "auto";
canvas.style.height = "auto";
canvas.style.display = "block";
document.body.appendChild(canvas);

const settings = {
  ...project.meta.getFullRenderingSettings(),
  name: project.name,
  slide: null,
};
presenter.present(settings);

// Manual cursor tracking so Right/Left skip instantly even mid-animation.
// Motion Canvas's requestNextSlide/requestPreviousSlide use the live
// currentSlideId which is null during an in-flight animation — that's what
// caused the "jump to scene 0" bug. We track the last known marker the
// presenter was paused at, then derive the target from that.
let slides: { id: string }[] = [];
let cursor = 0;

presenter.onSlidesChanged.subscribe((s) => {
  slides = s as { id: string }[];
});
presenter.onInfoChanged.subscribe((info) => {
  if (info.isWaiting && info.currentSlideId != null) {
    const i = slides.findIndex((s) => s.id === info.currentSlideId);
    if (i >= 0) cursor = i;
  }
});

function goNext() {
  if (!slides.length) return;
  if (cursor < slides.length - 1) {
    cursor++;
    presenter.requestSlide(slides[cursor].id);
  }
}
function goPrev() {
  if (!slides.length) return;
  if (cursor > 0) {
    cursor--;
    presenter.requestSlide(slides[cursor].id);
  }
}

// Mid-animation, requestSlide for "prev" via cursor doesn't work because
// the cursor is still anchored at the marker BEFORE the in-flight anim's
// target. Workaround per user: skip forward (lands at target marker),
// then skip back twice — net -1 from anim target.
function goPrevAuto() {
  const info = presenter.onInfoChanged.current;
  if (!info || info.isWaiting) {
    goPrev();
    return;
  }
  const sub = presenter.onInfoChanged.subscribe((next) => {
    if (!next.isWaiting) return;
    sub();
    goPrev();
  });
  goNext();
}

window.addEventListener("keydown", (e) => {
  const tag = ((e.target as Element | null)?.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  switch (e.key) {
    case " ":
      // resume() plays the current animation through to the next marker.
      presenter.resume();
      e.preventDefault();
      break;
    case "ArrowRight":
    case "PageDown":
      goNext();
      e.preventDefault();
      break;
    case "ArrowLeft":
    case "PageUp":
      goPrevAuto();
      e.preventDefault();
      break;
    case "Home":
    case "r":
    case "R":
      cursor = 0;
      presenter.requestFirstSlide();
      e.preventDefault();
      break;
    case "End":
    case "l":
    case "L":
      cursor = Math.max(0, slides.length - 1);
      presenter.requestLastSlide();
      e.preventDefault();
      break;
    case "f":
    case "F":
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
      break;
    case "n":
    case "N":
      window.open("./notes.html", "mc-notes", "noopener");
      break;
  }
});

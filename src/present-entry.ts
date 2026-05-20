import { Presenter } from "@motion-canvas/core";
import "./lib/presenter-bridge";
import project from "./project?project";
import slideNotes from "virtual:slide-notes";

interface SlideInfo {
  id: string;
  scene: unknown;
}

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
let slides: SlideInfo[] = [];
let cursor = 0;

presenter.onSlidesChanged.subscribe((s) => {
  slides = s as unknown as SlideInfo[];
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

// --- PDF export ---------------------------------------------------------
// Exports one page per scene at its FINAL animated state (the scene's last
// beginSlide marker — everything before it has played). Intermediate
// markers within a scene (e.g. the pipeline diagram's build-up steps) are
// skipped, so the pipeline becomes a single page with the full diagram.
let exporting = false;

type Info = { isWaiting: boolean; currentSlideId: string | null };
function waitForInfo(pred: (info: Info) => boolean) {
  const cur = () => presenter.onInfoChanged.current as Info;
  return new Promise<void>((resolve) => {
    if (pred(cur())) return resolve();
    const sub = presenter.onInfoChanged.subscribe((info) => {
      if (pred(info as Info)) {
        sub();
        resolve();
      }
    });
  });
}
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function exportPdf(withNotes = false) {
  if (exporting) return;
  if (!slides.length) {
    await waitForInfo(() => slides.length > 0);
  }
  exporting = true;

  // Group markers by scene, in presentation order. Image = scene's last
  // marker (full anim done). Notes = all markers' notes concatenated.
  const order: unknown[] = [];
  const markersByScene = new Map<unknown, SlideInfo[]>();
  for (const s of slides) {
    if (!markersByScene.has(s.scene)) {
      order.push(s.scene);
      markersByScene.set(s.scene, []);
    }
    markersByScene.get(s.scene)!.push(s);
  }

  const { jsPDF } = await import("jspdf");
  const canvas = presenter.stage.finalBuffer as HTMLCanvasElement;
  const w = canvas.width;
  const h = canvas.height;
  const orientation = w >= h ? "landscape" : "portrait";
  // Caption band beneath the slide image when exporting notes.
  const CAP_H = withNotes ? Math.round(h * 0.22) : 0;
  const pageH = h + CAP_H;
  let pdf: InstanceType<typeof jsPDF> | null = null;

  for (const scene of order) {
    const markers = markersByScene.get(scene)!;
    const last = markers[markers.length - 1];

    presenter.requestSlide(last.id);
    await waitForInfo(
      (info) => info.isWaiting && info.currentSlideId === last.id,
    );
    // Let the final frame paint before reading pixels.
    await nextFrame();
    await nextFrame();

    const img = canvas.toDataURL("image/png");
    if (!pdf) {
      pdf = new jsPDF({ orientation, unit: "px", format: [w, pageH] });
    } else {
      pdf.addPage([w, pageH], orientation);
    }
    pdf.addImage(img, "PNG", 0, 0, w, h);

    if (withNotes) {
      const text = markers
        .map((m) => slideNotes[m.id]?.notes)
        .filter(Boolean)
        .join("\n\n");
      const pad = Math.round(w * 0.03);
      const maxW = w - pad * 2;
      const maxH = CAP_H - pad * 2;
      const lhf = 1.3;
      pdf.setFillColor(245, 244, 242);
      pdf.rect(0, h, w, CAP_H, "F");
      pdf.setTextColor(31, 20, 22);
      pdf.setLineHeightFactor(lhf);

      // Shrink font until wrapped text fits the caption band.
      let fs = Math.round(h * 0.026);
      let lines = [text || "—"];
      for (; fs >= 9; fs--) {
        pdf.setFontSize(fs);
        lines = pdf.splitTextToSize(text || "—", maxW);
        if (lines.length * fs * lhf <= maxH) break;
      }
      pdf.setFontSize(fs);
      pdf.text(lines, pad, h + pad + fs);
    }
  }

  pdf?.save(`${project.name || "slides"}${withNotes ? "-notes" : ""}.pdf`);
  exporting = false;
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
    case "p":
    case "P":
      // Shift+P includes presenter notes as a caption beneath each slide.
      exportPdf(e.shiftKey);
      e.preventDefault();
      break;
  }
});

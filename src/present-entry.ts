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
// A PDF page is emitted at each "anchor" marker: every scene's FINAL marker
// (so every scene appears) PLUS any marker passed showInPrint=true at its
// slide() call site. The page renders that anchor's frame; build-up markers
// between anchors collapse into the next page (their notes are still merged
// in). This keeps pure build-up steps off their own pages while letting a
// scene expose its distinct slides — controlled where the slide is defined.
//
// Marker ids built from a template literal (e.g. `sae:reveal-${i}`) are
// stored under a key with their ${...} placeholders intact. Match those as
// wildcards so every numbered instance (sae:reveal-0, …) resolves to that
// entry — for both its showInPrint flag and its notes caption.
type SlideMeta = (typeof slideNotes)[string];
const templateMetas = Object.keys(slideNotes)
  .filter((id) => id.includes("${"))
  .map((id) => ({
    rx: new RegExp(
      "^" +
        id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\$\\\{[^}]*\\\}/g, ".+") +
        "$",
    ),
    meta: slideNotes[id],
  }));
const metaFor = (id: string): SlideMeta | undefined =>
  slideNotes[id] ?? templateMetas.find((t) => t.rx.test(id))?.meta;
const isAnchor = (id: string) => metaFor(id)?.page === true;
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
  try {
  // Walk markers in order, accumulating into the current page. Close a page
  // when the marker is an anchor or the last marker of its scene. The page's
  // image is that closing marker; its notes are every accumulated marker.
  const pages: { anchor: SlideInfo; markers: SlideInfo[] }[] = [];
  let pending: SlideInfo[] = [];
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    pending.push(s);
    const sceneFinal = i === slides.length - 1 || slides[i + 1].scene !== s.scene;
    if (isAnchor(s.id) || sceneFinal) {
      pages.push({ anchor: s, markers: pending });
      pending = [];
    }
  }

  const { jsPDF } = await import("jspdf");
  const canvas = presenter.stage.finalBuffer as HTMLCanvasElement;
  // Downscale to a sane width and encode JPEG: full-res PNG frames of the
  // gradient backgrounds produce a 300 MB+ PDF the browser fails to save.
  const MAX_W = 1920;
  const JPEG_Q = 0.85;
  const scale = Math.min(1, MAX_W / canvas.width);
  const w = Math.round(canvas.width * scale);
  const h = Math.round(canvas.height * scale);
  const frame = document.createElement("canvas");
  frame.width = w;
  frame.height = h;
  const fctx = frame.getContext("2d")!;
  const orientation = w >= h ? "landscape" : "portrait";
  // Caption band beneath the slide image when exporting notes.
  const CAP_H = withNotes ? Math.round(h * 0.22) : 0;
  const pageH = h + CAP_H;
  let pdf: InstanceType<typeof jsPDF> | null = null;

  for (const { anchor, markers } of pages) {
    presenter.requestSlide(anchor.id);
    await waitForInfo(
      (info) => info.isWaiting && info.currentSlideId === anchor.id,
    );
    // Let the final frame paint before reading pixels.
    await nextFrame();
    await nextFrame();

    fctx.drawImage(canvas, 0, 0, w, h);
    const img = frame.toDataURL("image/jpeg", JPEG_Q);
    if (!pdf) {
      pdf = new jsPDF({ orientation, unit: "px", format: [w, pageH], compress: true });
    } else {
      pdf.addPage([w, pageH], orientation);
    }
    pdf.addImage(img, "JPEG", 0, 0, w, h);

    if (withNotes) {
      const text = markers
        .map((m) => metaFor(m.id)?.notes)
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
  } catch (err) {
    console.error("PDF export failed", err);
    alert("PDF export failed — see console.");
  } finally {
    exporting = false;
  }
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

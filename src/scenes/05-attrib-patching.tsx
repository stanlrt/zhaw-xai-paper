import { Circle, Line, makeScene2D, Rect, Txt } from '@motion-canvas/2d';
import { all, chain, createRef, sequence, waitFor } from '@motion-canvas/core';
import { addBackground } from '../lib/bg';
import { makeCounter } from '../lib/counter';
import { slideEdgeHighlight } from '../lib/network';
import { slide } from '../lib/slide';
import { setupSlide } from '../lib/slide-layout';
import { colors, fonts } from '../lib/theme';

// ---------- mock data ----------
const FEATURES = 12;
const CLEAN = [0.15, 0.62, 0.10, 0.88, 0.20, 0.40, 0.30, 0.55, 0.18, 0.70, 0.25, 0.35];
const PATCH = [0.18, 0.60, 0.12, 0.22, 0.21, 0.41, 0.29, 0.18, 0.19, 0.71, 0.24, 0.36];
// per-feature exact IE when intervening just that feature (forced to patch value)
const IE_TRUE = [0.01, -0.02, 0.03, -0.31, -0.01, 0.02, -0.01, -0.28, 0.02, -0.01, 0.01, 0.00];
// gradients for ATP — chosen so grad * (patch-clean) ≈ IE_TRUE (slight underestimate)
const GRAD = CLEAN.map((c, i) => {
  const d = PATCH[i] - c;
  if (Math.abs(d) < 1e-3) return 0;
  return (IE_TRUE[i] * 0.85) / d; // 15% underestimate
});
const IE_ATP = GRAD.map((g, i) => g * (PATCH[i] - CLEAN[i]));

const M_CLEAN = 0.31;  // metric on clean run

// ---------- layout constants ----------
const INPUT_X = -780;
const HIDDEN1_X = -600;
const SAE_X = -380;
const OUTPUT_X = -160;
const METRIC_X = +40;

const NEURON_R = 22;
const SAE_R = 14;
const SAE_GAP = 60;

const NET_Y = 70;                 // shift entire network downward
const MAGENTA = '#d946ef';        // backward/gradient flow
// output token → input that produces it. Use input colors directly:
//   "are" wins on clean input (active/cyan)
//   "is"  wins on patch input (bad/red)

const NOTES_X = 220;
const NOTES_W = 580;
const NOTES_COL_W = 140;

const fmt = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2);

export default makeScene2D(function* (view) {
  addBackground(view);
  const layout = setupSlide(view, { title: 'Counterfactual: naive' });

  // ---------- prompts (shown only on title slide, centered) ----------
  const promptClean = createRef<Txt>();
  const promptPatch = createRef<Txt>();
  view.add(
    <>
      <Txt
        ref={promptClean}
        x={0} y={-40}
        fontSize={36} fontFamily={fonts.mono} fill={colors.active} opacity={0}
        text={'clean:  "the boys near the teacher ___"   → are'}
      />
      <Txt
        ref={promptPatch}
        x={0} y={+40}
        fontSize={36} fontFamily={fonts.mono} fill={colors.bad} opacity={0}
        text={'poisoned:  "the boy near the teacher __"    → is'}
      />
    </>,
  );

  // ---------- input layer (3) ----------
  const subjectTxt = createRef<Txt>();
  view.add(
    <Txt ref={subjectTxt}
      x={INPUT_X - 60} y={NET_Y} offsetX={1}
      fontSize={32} fontFamily={fonts.mono} fill={colors.active}
      opacity={0} text={''}
    />,
  );
  const inputN: ReturnType<typeof createRef<Circle>>[] = [];
  for (let i = 0; i < 3; i++) {
    const r = createRef<Circle>();
    inputN.push(r);
    view.add(
      <Circle ref={r}
        x={INPUT_X} y={NET_Y + (i - 1) * 90}
        size={NEURON_R * 2}
        fill={colors.neuronFill} stroke={colors.neuronStroke} lineWidth={2}
        opacity={0}
      />,
    );
  }

  // ---------- hidden1 layer (5) ----------
  const hidN: ReturnType<typeof createRef<Circle>>[] = [];
  for (let i = 0; i < 5; i++) {
    const r = createRef<Circle>();
    hidN.push(r);
    view.add(
      <Circle ref={r}
        x={HIDDEN1_X} y={NET_Y + (i - 2) * 80}
        size={NEURON_R * 2}
        fill={colors.neuronFill} stroke={colors.neuronStroke} lineWidth={2}
        opacity={0}
      />,
    );
  }

  // ---------- SAE column (12) ----------
  const SAE_TOP = NET_Y - ((FEATURES - 1) * SAE_GAP) / 2;
  const saeN: ReturnType<typeof createRef<Circle>>[] = [];
  const saeTxt: ReturnType<typeof createRef<Txt>>[] = [];
  for (let i = 0; i < FEATURES; i++) {
    const r = createRef<Circle>();
    saeN.push(r);
    const t = createRef<Txt>();
    saeTxt.push(t);
    view.add(
      <>
        <Circle ref={r}
          x={SAE_X} y={SAE_TOP + i * SAE_GAP}
          size={SAE_R * 2 + 14}
          fill={colors.neuronFill} stroke={colors.sae} lineWidth={2}
          opacity={0} zIndex={10}
        />
        <Txt ref={t}
          x={SAE_X} y={SAE_TOP + i * SAE_GAP}
          fontSize={12} fontFamily={fonts.mono} fill={colors.text}
          opacity={0} text={'·'} zIndex={11}
        />
      </>,
    );
  }
  const saeLabel = createRef<Txt>();
  view.add(
    <Txt ref={saeLabel}
      x={SAE_X} y={SAE_TOP + FEATURES * SAE_GAP - 10}
      fontSize={16} fontFamily={fonts.mono} fill={colors.sae}
      opacity={0} text={'SAE features'}
    />,
  );

  // ---------- edges input→hidden1, hidden1→SAE, SAE→output ----------
  const mkEdge = (x1: number, y1: number, x2: number, y2: number) => {
    const r = createRef<Line>();
    view.add(
      <Line ref={r}
        points={[[x1, y1], [x2, y2]]}
        stroke={colors.edge} lineWidth={1.4} end={0}
      />,
    );
    return r;
  };

  const edgesIH: ReturnType<typeof createRef<Line>>[] = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 5; j++)
      edgesIH.push(mkEdge(INPUT_X, NET_Y + (i - 1) * 90, HIDDEN1_X, NET_Y + (j - 2) * 80));

  const edgesHS: ReturnType<typeof createRef<Line>>[] = [];
  for (let j = 0; j < 5; j++)
    for (let k = 0; k < FEATURES; k++)
      edgesHS.push(mkEdge(HIDDEN1_X, NET_Y + (j - 2) * 80, SAE_X, SAE_TOP + k * SAE_GAP));

  // ---------- output layer (2 logits): "is", "are" ----------
  const outIs = createRef<Rect>();
  const outAre = createRef<Rect>();
  const outIsTx = createRef<Txt>();
  const outAreTx = createRef<Txt>();
  view.add(
    <>
      <Rect ref={outAre}
        x={OUTPUT_X} y={NET_Y - 60} width={90} height={42}
        fill={'#1f2937'} stroke={colors.active} lineWidth={3} radius={8} opacity={0}
      />
      <Txt ref={outAreTx} x={OUTPUT_X} y={NET_Y - 60}
        fontSize={20} fontFamily={fonts.mono} fill={colors.active}
        text={'"are"'} opacity={0}
      />
      <Rect ref={outIs}
        x={OUTPUT_X} y={NET_Y + 60} width={90} height={42}
        fill={'#1f2937'} stroke={colors.bad} lineWidth={3} radius={8} opacity={0}
      />
      <Txt ref={outIsTx} x={OUTPUT_X} y={NET_Y + 60}
        fontSize={20} fontFamily={fonts.mono} fill={colors.bad}
        text={'"is"'} opacity={0}
      />
    </>,
  );

  const edgesSO: ReturnType<typeof createRef<Line>>[] = [];
  for (let k = 0; k < FEATURES; k++) {
    edgesSO.push(mkEdge(SAE_X, SAE_TOP + k * SAE_GAP, OUTPUT_X - 45, NET_Y - 60));
    edgesSO.push(mkEdge(SAE_X, SAE_TOP + k * SAE_GAP, OUTPUT_X - 45, NET_Y + 60));
  }

  // ---------- intuition curve (hidden until between naive & ATP) ----------
  const I_MFN = (a: number) => 0.4 - 0.6 * a * a - 0.2 * a;
  const I_GFN = (a: number) => -1.2 * a - 0.2;
  const I_A_CLEAN = 0, I_A_PATCH = 1;
  const I_M_CLEAN = I_MFN(I_A_CLEAN);   // +0.40
  const I_M_PATCH = I_MFN(I_A_PATCH);   // -0.40
  const I_ATP_IE = I_GFN(I_A_CLEAN) * (I_A_PATCH - I_A_CLEAN);  // -0.20
  const I_TRUE_IE = I_M_PATCH - I_M_CLEAN;                       // -0.80
  const I_M_MIN = -0.6, I_M_MAX = 0.6;
  const I_AX0 = -500, I_AX1 = 500;
  const I_AY0 = -260, I_AY1 = 260;
  const I_PL = 60, I_PR = 120, I_PT = 60, I_PB = 50;
  const iax = (a: number) =>
    I_AX0 + I_PL + (a) * (I_AX1 - I_AX0 - I_PL - I_PR);
  const iay = (m: number) =>
    I_AY1 - I_PB - ((m - I_M_MIN) / (I_M_MAX - I_M_MIN)) * (I_AY1 - I_AY0 - I_PT - I_PB);

  const ixAxis = createRef<Line>();
  const iyAxis = createRef<Line>();
  const ixLbl = createRef<Txt>();
  const iyLbl = createRef<Txt>();
  view.add(
    <>
      <Line ref={ixAxis}
        points={[[I_AX0, iay(0)], [I_AX1, iay(0)]]}
        stroke={colors.edge} lineWidth={1.2} endArrow arrowSize={10} opacity={0}
      />
      <Line ref={iyAxis}
        points={[[I_AX0, I_AY1], [I_AX0, I_AY0]]}
        stroke={colors.edge} lineWidth={1.2} endArrow arrowSize={10} opacity={0}
      />
      <Txt ref={ixLbl}
        x={I_AX1 + 30} y={iay(0)} offsetX={-1}
        fontSize={20} fontFamily={fonts.mono} fill={colors.textMuted}
        text={'a (feature activation)'} opacity={0}
      />
      <Txt ref={iyLbl}
        x={I_AX0 - 10} y={I_AY0 - 30} offsetX={1}
        fontSize={20} fontFamily={fonts.mono} fill={colors.textMuted}
        text={'m'} opacity={0}
      />
    </>,
  );

  const ICURVE_SAMPLES = 80;
  const iCurvePoints: [number, number][] = [];
  for (let k = 0; k <= ICURVE_SAMPLES; k++) {
    const a = (k / ICURVE_SAMPLES);
    iCurvePoints.push([iax(a), iay(I_MFN(a))]);
  }
  const iCurve = createRef<Line>();
  view.add(
    <Line ref={iCurve}
      points={iCurvePoints}
      stroke={colors.text} lineWidth={3}
      end={0} opacity={0}
    />,
  );

  const iCleanDot = createRef<Circle>();
  const iPatchDot = createRef<Circle>();
  const iCleanLbl = createRef<Txt>();
  const iPatchLbl = createRef<Txt>();
  view.add(
    <>
      <Circle ref={iCleanDot}
        x={iax(I_A_CLEAN)} y={iay(I_M_CLEAN)} size={11}
        fill={colors.active} stroke={colors.active} lineWidth={1.5} opacity={0}
      />
      <Circle ref={iPatchDot}
        x={iax(I_A_PATCH)} y={iay(I_M_PATCH)} size={11}
        fill={colors.bad} stroke={colors.bad} lineWidth={1.5} opacity={0}
      />
      <Txt ref={iCleanLbl}
        x={iax(I_A_CLEAN) + 14} y={iay(I_M_CLEAN) - 22} offsetX={-1}
        fontSize={18} fontFamily={fonts.mono} fill={colors.active}
        text={'(a_clean, m_clean)'} opacity={0}
      />
      <Txt ref={iPatchLbl}
        x={iax(I_A_PATCH) - 14} y={iay(I_M_PATCH) + 30} offsetX={1}
        fontSize={18} fontFamily={fonts.mono} fill={colors.bad}
        text={'(a_patch, m_patch)'} opacity={0}
      />
    </>,
  );

  const iTangent = createRef<Line>();
  const iAtpDot = createRef<Circle>();
  const iAtpLbl = createRef<Txt>();
  const iErrLine = createRef<Line>();
  const iErrLbl = createRef<Txt>();
  const iAtpProjY = iay(I_M_CLEAN + I_ATP_IE);
  const iTangEndA = 1.05;
  const iTangEndM = I_M_CLEAN + I_GFN(I_A_CLEAN) * (iTangEndA - I_A_CLEAN);
  view.add(
    <>
      <Line ref={iTangent}
        points={[
          [iax(I_A_CLEAN), iay(I_M_CLEAN)],
          [iax(iTangEndA), iay(iTangEndM)],
        ]}
        stroke={colors.active} lineWidth={2.5} lineDash={[8, 6]}
        end={0} opacity={0}
      />
      <Circle ref={iAtpDot}
        x={iax(I_A_PATCH)} y={iAtpProjY} size={9}
        fill={'#0b1220'} stroke={colors.active} lineWidth={2} opacity={0}
      />
      <Txt ref={iAtpLbl}
        x={iax(I_A_PATCH) - 14} y={I_AY0 + 30} offsetX={1}
        fontSize={18} fontFamily={fonts.mono} fill={colors.active}
        text={`ATP estimate: m ≈ ${fmt(I_M_CLEAN + I_ATP_IE)}`} opacity={0}
      />
      <Line ref={iErrLine}
        points={[
          [iax(I_A_PATCH) + 8, iAtpProjY],
          [iax(I_A_PATCH) + 28, iAtpProjY],
          [iax(I_A_PATCH) + 28, iay(I_M_PATCH)],
          [iax(I_A_PATCH) + 8, iay(I_M_PATCH)],
        ]}
        stroke={colors.bad} lineWidth={1.8} opacity={0}
      />
      <Txt ref={iErrLbl}
        x={iax(I_A_PATCH) + 36} y={(iAtpProjY + iay(I_M_PATCH)) / 2} offsetX={-1}
        fontSize={14} fontFamily={fonts.mono} fill={colors.bad}
        text={`error ${fmt(I_ATP_IE - I_TRUE_IE)}`} opacity={0}
      />
    </>,
  );

  // ---------- metric m ----------
  const metricBox = createRef<Rect>();
  const metricLbl = createRef<Txt>();
  const metricVal = createRef<Txt>();
  view.add(
    <>
      <Rect ref={metricBox}
        x={METRIC_X} y={NET_Y} width={250} height={76}
        fill={'#0b1220'} stroke={colors.accent} lineWidth={2} radius={10}
        opacity={0}
      />
      <Txt ref={metricLbl}
        x={METRIC_X} y={NET_Y - 18}
        fontSize={15} fontFamily={fonts.mono} fill={colors.textMuted}
        opacity={0} text={'m = logit(are) − logit(is)'}
      />
      <Txt ref={metricVal}
        x={METRIC_X} y={NET_Y + 12}
        fontSize={26} fontFamily={fonts.mono} fill={colors.accent}
        opacity={0} text={'—'}
      />
    </>,
  );

  // ---------- notes panel ----------
  const notesBg = createRef<Rect>();
  const notesTitle = createRef<Txt>();
  const passCounter = createRef<Txt>();
  view.add(
    <>
      <Rect ref={notesBg}
        x={NOTES_X + NOTES_W / 2} y={0} width={NOTES_W} height={760}
        fill={'#0b1220'} stroke={colors.edge} lineWidth={1} radius={10} opacity={0}
      />
      <Txt ref={notesTitle}
        x={NOTES_X + 20} y={-350} offsetX={-1}
        fontSize={22} fontFamily={fonts.sans} fill={colors.text}
        opacity={0} text={'Notes'}
      />
      <Txt ref={passCounter}
        x={NOTES_X + NOTES_W - 20} y={-350} offsetX={1}
        fontSize={22} fontFamily={fonts.mono} fill={colors.accent}
        opacity={0} text={''}
      />
    </>,
  );

  // helpers for adding rows to the notes panel
  const notesRows: Txt[] = [];
  function addNoteRow(text: string, color: string, slot: number, col = 0): Txt {
    const ref = createRef<Txt>();
    const x = NOTES_X + 20 + col * NOTES_COL_W;
    const y = -300 + slot * 26;
    view.add(
      <Txt ref={ref}
        x={x} y={y} offsetX={-1}
        fontSize={16} fontFamily={fonts.mono} fill={color}
        opacity={0} text={text}
      />,
    );
    notesRows.push(ref());
    return ref();
  }

  // ---------- intro ----------
  yield* all(
    layout.showTitle(),
    promptClean().opacity(1, 0.5),
    promptPatch().opacity(1, 0.5),
  );
  yield* slide('atp:title', `
    We want a more systematic/mathematical way to identify SAE nodes used for specific tasks.
    We use counterfactuals: give a clean and a poisoned prompt as input.

    In this example, we search the SAE nodes that track subject number across distractors (subj: boy, distractor: near the teacher).
  `, 'Stanislas');

  // fade prompts out, network appears
  yield* all(
    promptClean().opacity(0, 0.3),
    promptPatch().opacity(0, 0.3),
  );
  yield* all(
    subjectTxt().opacity(1, 0.4),
    ...inputN.map(r => r().opacity(1, 0.4)),
    ...hidN.map(r => r().opacity(1, 0.4)),
    ...saeN.map(r => r().opacity(1, 0.4)),
    saeLabel().opacity(1, 0.4),
    outIs().opacity(1, 0.4), outIsTx().opacity(1, 0.4),
    outAre().opacity(1, 0.4), outAreTx().opacity(1, 0.4),
    metricBox().opacity(1, 0.4), metricLbl().opacity(1, 0.4), metricVal().opacity(1, 0.4),
    ...edgesIH.map(e => e().end(1, 0.5)),
    ...edgesHS.map(e => e().end(1, 0.5)),
    ...edgesSO.map(e => e().end(1, 0.5)),
    notesBg().opacity(0.6, 0.4),
  );

  yield* slide('atp:setup', `
    We introduce a few notations here:
    - m is the metric that measures the model's output (neg for "is", pos for "are")
    - m_clean is the model's output metric for the clean input, our baseline
    - a_poisoned is the SAE node activation when the input is poisoned
    - a_clean is the SAE node activation when the input is clean
    - IE is the Indirect Effect, i.e. how much one node causes metric m to change between clean and poisoned.
    
    First we look at the naive, slow and costly approach.
  `, 'Stanislas');

  // helper: set metric value + color by sign (cyan="are" wins → clean, red="is" wins → patch)
  function* setMetric(v: number, dur: number) {
    yield* all(
      metricVal().text(fmt(v), dur),
      metricVal().fill(v >= 0 ? colors.active : colors.bad, dur),
    );
  }

  // ============================================================
  // PHASE 1: NAIVE INTERVENTION
  // ============================================================

  // forward propagation animation helper
  function* forward(values: number[], glowColor: string, subject: string) {
    // reset both output box fills + text colors (winner from previous run cleared)
    yield* all(
      outIs().fill('#1f2937', 0.15),
      outAre().fill('#1f2937', 0.15),
      outIsTx().fill(colors.bad, 0.15),
      outAreTx().fill(colors.active, 0.15),
      subjectTxt().text(subject, 0.2),
      subjectTxt().fill(glowColor, 0.2),
      // persistent input-color indicator: stroke holds the run's color
      ...inputN.map(n => n().stroke(glowColor, 0.2)),
    );
    // input pulse (fill flashes briefly, then back to dark)
    yield* all(
      ...inputN.map(n => chain(
        n().fill(glowColor, 0.12),
        n().fill(colors.neuronFill, 0.2),
      )),
    );
    // edges input → hidden sweep
    yield* all(...edgesIH.map(e => slideEdgeHighlight(view, e(), glowColor, 0.4)));
    // hidden pulse
    yield* all(
      ...hidN.map(n => chain(
        n().fill(glowColor, 0.12),
        n().fill(colors.neuronFill, 0.2),
      )),
    );
    // edges hidden → SAE sweep
    yield* all(...edgesHS.map(e => slideEdgeHighlight(view, e(), glowColor, 0.4)));
    // SAE values appear inside circles (neutral fill — magnitude is meaningless until IE is computed)
    yield* all(
      ...saeTxt.map((t, i) => all(
        t().text(values[i].toFixed(2), 0),
        t().opacity(1, 0.2),
      )),
    );
    // edges SAE → output sweep
    yield* all(...edgesSO.map(e => slideEdgeHighlight(view, e(), glowColor, 0.4)));
    // fill the winning output box: clean→"are", patch→"is" (flip text to dark for contrast)
    if (glowColor === colors.active) {
      yield* all(
        outAre().fill(colors.active, 0.25),
        outAreTx().fill('#0b1220', 0.25),
      );
    } else {
      yield* all(
        outIs().fill(colors.bad, 0.25),
        outIsTx().fill('#0b1220', 0.25),
      );
    }
  }

  // Notes column headers for naive phase
  const naiveHdrPatch = addNoteRow('a_poisoned', colors.bad, 0, 0);
  const naiveHdrClean = addNoteRow('a_clean', colors.active, 0, 1);
  const naiveHdrIE = addNoteRow('IE', colors.accent, 0, 2);
  yield* all(
    naiveHdrPatch.opacity(1, 0.25),
    naiveHdrClean.opacity(1, 0.25),
    naiveHdrIE.opacity(1, 0.25),
  );

  // Run 1: forward on PATCH input — record a_poisoned for every feature
  yield* forward(PATCH, colors.bad, 'boy');
  yield* setMetric(-0.42, 0.3);
  passCounter().text('Naive: 1 pass');

  // slide a_poisoned values into col 0
  const patchRowsNaive: Txt[] = [];
  for (let i = 0; i < FEATURES; i++) {
    const row = addNoteRow(
      `[${i.toString().padStart(2, '0')}] = ${PATCH[i].toFixed(2)}`,
      colors.bad, i + 1, 0,
    );
    patchRowsNaive.push(row);
  }
  yield* sequence(0.03, ...patchRowsNaive.map(r => r.opacity(1, 0.2)));

  yield* slide('atp:naive-recordpatch', `
    First: run the model on the poisoned input ("boy"), and store all the SAE activations (a_poisoned) for each node.
  `, 'Stanislas');

  // Run 2: forward on CLEAN — establish baseline metric, cache a_clean values
  yield* forward(CLEAN, colors.active, 'boys');
  yield* setMetric(M_CLEAN, 0.3);
  passCounter().text('Naive: 2 passes');

  const cleanRowsNaive: Txt[] = [];
  for (let i = 0; i < FEATURES; i++) {
    const row = addNoteRow(
      `[${i.toString().padStart(2, '0')}] = ${CLEAN[i].toFixed(2)}`,
      colors.active, i + 1, 1,
    );
    cleanRowsNaive.push(row);
  }
  yield* sequence(0.03, ...cleanRowsNaive.map(r => r.opacity(1, 0.2)));

  // m_clean badge below cache
  const mCleanRow = addNoteRow('m_clean = +0.31', colors.accent, FEATURES + 2, 0);
  yield* mCleanRow.opacity(1, 0.3);

  yield* slide('atp:naive-baseline',
    `Second: run the model on the clean input ("boys"), and store all the SAE activations (a_clean) for each node.

      Also, model output metric is our baseline (0.31)
  `, 'Stanislas');

  // intervention helper: re-run clean with feature i forced to patch[i]
  function* intervene(i: number, slotInNotes: number, detailed: boolean) {
    const dur = detailed ? 0.25 : 0.08;
    const sweepDur = detailed ? 0.4 : 0.18;
    // reset both output fills + text colors at start of each new forward
    yield* all(
      outIs().fill('#1f2937', 0.12),
      outAre().fill('#1f2937', 0.12),
      outIsTx().fill(colors.bad, 0.12),
      outAreTx().fill(colors.active, 0.12),
    );
    // re-run forward pass (input → hidden → SAE) — same as clean since input unchanged
    if (detailed) {
      yield* all(
        ...inputN.map(n => chain(
          n().fill(colors.active, 0.1),
          n().fill(colors.neuronFill, 0.18),
        )),
      );
      yield* all(...edgesIH.map(e => slideEdgeHighlight(view, e(), colors.active, sweepDur)));
      yield* all(
        ...hidN.map(n => chain(
          n().fill(colors.active, 0.1),
          n().fill(colors.neuronFill, 0.18),
        )),
      );
      yield* all(...edgesHS.map(e => slideEdgeHighlight(view, e(), colors.active, sweepDur)));
    } else {
      // abbreviated: still sweep both edge layers so input→hidden→SAE animate
      yield* all(...edgesIH.map(e => slideEdgeHighlight(view, e(), colors.active, sweepDur)));
      yield* all(...edgesHS.map(e => slideEdgeHighlight(view, e(), colors.active, sweepDur)));
    }
    // override feature i with its cached patch value
    yield* all(
      saeN[i]().stroke(colors.bad, dur),
      saeTxt[i]().text(PATCH[i].toFixed(2), dur),
      saeTxt[i]().fill(colors.bad, dur),
    );
    if (detailed) yield* waitFor(0.1);
    // SAE → output sweep: only the patched feature's edges carry the modified signal (red).
    // The other 11 features' edges still carry their clean activations.
    yield* all(
      ...edgesSO.map((e, idx) => {
        const featureIdx = Math.floor(idx / 2);
        const color = featureIdx === i ? colors.bad : colors.active;
        return slideEdgeHighlight(view, e(), color, sweepDur);
      }),
    );
    const newM = M_CLEAN + IE_TRUE[i];
    yield* all(
      setMetric(newM, dur),
      ...(newM >= 0
        ? [outAre().fill(colors.active, dur), outAreTx().fill('#0b1220', dur)]
        : [outIs().fill(colors.bad, dur), outIsTx().fill('#0b1220', dur)]),
    );
    if (detailed) yield* waitFor(0.1);
    // commit IE row to notes (col 2)
    const row = addNoteRow(
      `[${i.toString().padStart(2, '0')}] = ${fmt(IE_TRUE[i])}`,
      Math.abs(IE_TRUE[i]) > 0.1 ? colors.bad : colors.textMuted,
      slotInNotes,
      2,
    );
    yield* row.opacity(1, dur);
    // reset feature i back to clean
    yield* all(
      saeN[i]().stroke(colors.sae, dur),
      saeTxt[i]().text(CLEAN[i].toFixed(2), dur),
      saeTxt[i]().fill(colors.text, dur),
    );
    yield* setMetric(M_CLEAN, dur);
  }

  // Detailed: i=0,1,2
  for (let i = 0; i < 3; i++) {
    passCounter().text(`Naive: ${i + 3} passes`);
    yield* intervene(i, i + 1, true);
    if (i === 0) {
      yield* slide('atp:naive-first', `
        Run 3: re-run clean input, but force SAE feature 0 to its cached poisoned value (a_poisoned[0]).
        
        Forward pass produces a new metric m.
        IE for feature 0 = m_new − m_clean.
      `, 'Stanislas');
    }
  }
  yield* slide('atp:naive-detail', `
    Same trick for features 1 and 2. Each = one full forward pass.
    Most features barely affect m — they're noise.
  `, 'Stanislas');

  // Time-lapse: i=3..11
  for (let i = 3; i < FEATURES; i++) {
    passCounter().text(`Naive: ${i + 3} passes`);
    yield* intervene(i, i + 1, false);
  }
  passCounter().text('Naive: 14 passes');

  // ---- naive cost tally at bottom-right (below cached value tables) ----
  const TALLY_Y = 410;
  const NAIVE_X = NOTES_X + 40;
  const naiveFwd = makeCounter(0, 0, ' fwd', {
    x: NAIVE_X, y: TALLY_Y, offsetX: -1,
    fontSize: 32, fontFamily: fonts.mono, fill: colors.bad, opacity: 0,
  });
  const naiveBwd = makeCounter(0, 0, ' bwd', {
    x: NAIVE_X, y: TALLY_Y + 38, offsetX: -1,
    fontSize: 32, fontFamily: fonts.mono, fill: colors.textMuted, opacity: 0,
  });
  view.add(
    <>
      {naiveFwd.node}
      {naiveBwd.node}
    </>,
  );
  yield* all(
    naiveFwd.handle.ref().opacity(1, 0.4),
    naiveBwd.handle.ref().opacity(1, 0.4),
  );
  yield* all(
    naiveFwd.handle.countTo(14, 1.4),
    naiveBwd.handle.countTo(0, 1.4),
  );

  yield* slide('atp:naive-done', `
    Now we have all IEs. We look at the significant ones. THose indicate the SAE nodes we seek.

    But: 14 forward passes. SAE in reality has millions of nodes. And one SAE per hidden layer. Unscalable.
  `, 'Stanislas');

  // ============================================================
  // INTUITION: Taylor-tangent visualization
  // ============================================================
  // Hide everything network/notes-related so the curve has the canvas to itself
  yield* all(
    layout.title().opacity(0, 0.3),
    ...inputN.map(r => r().opacity(0, 0.3)),
    ...hidN.map(r => r().opacity(0, 0.3)),
    ...saeN.map(r => r().opacity(0, 0.3)),
    ...saeTxt.map(r => r().opacity(0, 0.3)),
    saeLabel().opacity(0, 0.3),
    subjectTxt().opacity(0, 0.3),
    ...edgesIH.map(e => e().opacity(0, 0.3)),
    ...edgesHS.map(e => e().opacity(0, 0.3)),
    ...edgesSO.map(e => e().opacity(0, 0.3)),
    outIs().opacity(0, 0.3), outIsTx().opacity(0, 0.3),
    outAre().opacity(0, 0.3), outAreTx().opacity(0, 0.3),
    metricBox().opacity(0, 0.3),
    metricLbl().opacity(0, 0.3),
    metricVal().opacity(0, 0.3),
    notesBg().opacity(0, 0.3),
    ...notesRows.map(r => r.opacity(0, 0.3)),
    naiveFwd.handle.ref().opacity(0, 0.3),
    naiveBwd.handle.ref().opacity(0, 0.3),
  );

  // New title for intuition beat
  layout.title().text('Idea: estimate m(a_patch) − m(a_clean) with one tangent');
  yield* all(
    layout.title().opacity(1, 0.3),
    ixAxis().opacity(1, 0.3),
    iyAxis().opacity(1, 0.3),
    ixLbl().opacity(1, 0.3),
    iyLbl().opacity(1, 0.3),
  );
  iCurve().opacity(1);
  yield* iCurve().end(1, 0.8);
  yield* all(
    iCleanDot().opacity(1, 0.3),
    iPatchDot().opacity(1, 0.3),
    iCleanLbl().opacity(1, 0.3),
    iPatchLbl().opacity(1, 0.3),
  );

  yield* slide('atp:intuition-setup', `
    Instead of calculating the precise m(a_patch) for each node, we can approximate it with the tangent.

    On the graph:
    - white functions in the network itself (predict output based on neuron activations)
    - x axis is the SAE feature activation
    - y axis is the metric m (output of the model)
  `, 'Stanislas');

  iTangent().opacity(1);
  yield* iTangent().end(1, 0.7);
  yield* all(
    iAtpDot().opacity(1, 0.3),
    iAtpLbl().opacity(1, 0.3),
  );
  yield* all(
    iErrLine().opacity(1, 0.3),
    iErrLbl().opacity(1, 0.3),
  );

  yield* slide('atp:intuition-tangent', `
    To estimate m(a_patch), we use the tangent at a_clean.
    We need:
    - the slope of the tangent at a_clean, aka the gradient ∇m
    - the distance between a_clean and a_patch, aka a_patch - a_clean

    Good news, back propagation gives us the gradient ∇m of ALL NODES at once.
    
    Tradeoff: tangent doesn't bend, but the curve does. Estimate underestimates the true change. Error bracket = curvature we ignored.
  `, 'Stanislas');

  // Hide curve, restore network for ATP demo
  yield* all(
    iCurve().opacity(0, 0.3),
    iCleanDot().opacity(0, 0.3),
    iPatchDot().opacity(0, 0.3),
    iCleanLbl().opacity(0, 0.3),
    iPatchLbl().opacity(0, 0.3),
    iTangent().opacity(0, 0.3),
    iAtpDot().opacity(0, 0.3),
    iAtpLbl().opacity(0, 0.3),
    iErrLine().opacity(0, 0.3),
    iErrLbl().opacity(0, 0.3),
    ixAxis().opacity(0, 0.3),
    iyAxis().opacity(0, 0.3),
    ixLbl().opacity(0, 0.3),
    iyLbl().opacity(0, 0.3),
    layout.title().opacity(0, 0.3),
  );

  // ============================================================
  // PHASE 2: ATTRIBUTION PATCHING (3 PASSES)
  // ============================================================
  // Bring network back; swap title to ATP
  layout.title().text('Counterfactual: attribution patching');
  yield* all(
    layout.title().opacity(1, 0.3),
    ...inputN.map(r => r().opacity(1, 0.3)),
    ...hidN.map(r => r().opacity(1, 0.3)),
    ...saeN.map(r => r().opacity(1, 0.3)),
    ...saeTxt.map(r => r().opacity(1, 0.3)),
    saeLabel().opacity(1, 0.3),
    subjectTxt().opacity(1, 0.3),
    ...edgesIH.map(e => e().opacity(1, 0.3)),
    ...edgesHS.map(e => e().opacity(1, 0.3)),
    ...edgesSO.map(e => e().opacity(1, 0.3)),
    outIs().opacity(1, 0.3), outIsTx().opacity(1, 0.3),
    outAre().opacity(1, 0.3), outAreTx().opacity(1, 0.3),
    metricBox().opacity(1, 0.3),
    metricLbl().opacity(1, 0.3),
    metricVal().opacity(1, 0.3),
    notesBg().opacity(0.6, 0.3),
    naiveFwd.handle.ref().opacity(1, 0.3),
    naiveBwd.handle.ref().opacity(1, 0.3),
  );
  notesRows.length = 0;
  yield* all(
    metricVal().text('—', 0.2),
    metricVal().fill(colors.accent, 0.2),
  );

  // Section header in notes
  const headPatch = addNoteRow('patch cache', colors.bad, 0, 0);
  const headClean = addNoteRow('clean cache', colors.active, 0, 1);
  const headGrad = addNoteRow('∇ₐ m cache', colors.accent, 0, 2);
  const headIE = addNoteRow('IE ≈ ∇·Δa', colors.sae, 0, 3);
  yield* all(
    headPatch.opacity(1, 0.3),
    headClean.opacity(1, 0.3),
    headGrad.opacity(1, 0.3),
    headIE.opacity(1, 0.3),
  );

  yield* slide('atp:phase2-intro', `
    So we find a cheap method: attribution patching.

    Idea: instead of re-running, use a Taylor approximation.

    IE ≈ ∇ₐm · (a_poisoned − a_clean). All 12 nodes computed in parallel from cached values.
  `, 'Stanislas');

  // ---- Pass 1: forward on PATCH ----
  passCounter().text('ATP: 1 pass');
  yield* forward(PATCH, colors.bad, 'boy');
  // metric on patch (not strictly needed but show)
  yield* setMetric(-0.42, 0.3);

  // slide values into patch cache column
  const patchRows: Txt[] = [];
  for (let i = 0; i < FEATURES; i++) {
    const row = addNoteRow(`a_p[${i.toString().padStart(2, '0')}] = ${PATCH[i].toFixed(2)}`,
      colors.bad, i + 1, 0);
    patchRows.push(row);
  }
  yield* sequence(0.04, ...patchRows.map(r => r.opacity(1, 0.2)));

  yield* slide('atp:atp-pass1', `
    Again, we store the poisoned activations. Nothing different here.
  `, 'Stanislas');

  // ---- Pass 2: forward on CLEAN ----
  passCounter().text('ATP: 2 passes');
  yield* forward(CLEAN, colors.active, 'boys');
  yield* setMetric(M_CLEAN, 0.3);

  const cleanRows: Txt[] = [];
  for (let i = 0; i < FEATURES; i++) {
    const row = addNoteRow(`a_c[${i.toString().padStart(2, '0')}] = ${CLEAN[i].toFixed(2)}`,
      colors.active, i + 1, 1);
    cleanRows.push(row);
  }
  yield* sequence(0.04, ...cleanRows.map(r => r.opacity(1, 0.2)));

  yield* slide('atp:atp-pass2', `
    Again, we store the clean activations. Nothing different here.
  `, 'Stanislas');

  // ---- Pass 3: BACKWARD ----
  passCounter().text('ATP: 3 passes');

  // helper: sweep an edge in reverse (overlay travels target → source).
  // Default = green (gradient flow); distinct from cyan/red forward sweeps.
  function* sweepReverse(x1: number, y1: number, x2: number, y2: number, dur: number, color: string = MAGENTA) {
    const overlay = createRef<Line>();
    view.add(
      <Line ref={overlay}
        points={[[x2, y2], [x1, y1]]}
        stroke={color} lineWidth={3.2}
        start={0} end={0} lineCap={'round'}
      />,
    );
    yield* overlay().end(1, dur * 0.55);
    yield* overlay().start(1, dur * 0.45);
    overlay().remove();
  }

  // pulse metric → animates gradient origin
  yield* metricBox().stroke(colors.accent, 0.2).to(colors.accent, 0.2);
  // sweep SAE→output edges in reverse (output back to SAE)
  const backSweepSO = [];
  for (let k = 0; k < FEATURES; k++) {
    const sy = SAE_TOP + k * SAE_GAP;
    backSweepSO.push(sweepReverse(SAE_X, sy, OUTPUT_X - 45, NET_Y - 60, 0.5));
    backSweepSO.push(sweepReverse(SAE_X, sy, OUTPUT_X - 45, NET_Y + 60, 0.5));
  }
  yield* all(...backSweepSO);
  // pulse SAE neurons receiving gradient
  yield* all(
    ...saeN.map(n => chain(
      n().stroke(MAGENTA, 0.15),
      n().stroke(colors.sae, 0.3),
    )),
  );
  // sweep hidden→SAE edges in reverse
  const backSweepHS = [];
  for (let j = 0; j < 5; j++) {
    const hy = NET_Y + (j - 2) * 80;
    for (let k = 0; k < FEATURES; k++) {
      const sy = SAE_TOP + k * SAE_GAP;
      backSweepHS.push(sweepReverse(HIDDEN1_X, hy, SAE_X, sy, 0.4));
    }
  }
  yield* all(...backSweepHS);
  // pulse hidden
  yield* all(
    ...hidN.map(n => chain(
      n().fill(MAGENTA, 0.12),
      n().fill(colors.neuronFill, 0.2),
    )),
  );
  // sweep input→hidden edges in reverse
  const backSweepIH = [];
  for (let i = 0; i < 3; i++) {
    const iy = NET_Y + (i - 1) * 90;
    for (let j = 0; j < 5; j++) {
      const hy = NET_Y + (j - 2) * 80;
      backSweepIH.push(sweepReverse(INPUT_X, iy, HIDDEN1_X, hy, 0.4));
    }
  }
  yield* all(...backSweepIH);
  yield* all(
    ...inputN.map(n => chain(
      n().fill(MAGENTA, 0.12),
      n().fill(colors.neuronFill, 0.2),
    )),
  );

  const gradRows: Txt[] = [];
  for (let i = 0; i < FEATURES; i++) {
    const row = addNoteRow(`g[${i.toString().padStart(2, '0')}]   = ${fmt(GRAD[i])}`,
      colors.accent, i + 1, 2);
    gradRows.push(row);
  }
  yield* sequence(0.04, ...gradRows.map(r => r.opacity(1, 0.2)));

  yield* slide('atp:atp-pass3', `
    Run 3: BACKWARD pass from m.
    
    Backprop gives ∇ₐm for every node simultaneously.
    
    Gradients for all activations come for free in a single backward pass.
  `, 'Stanislas');

  // ---- Combine: IE ≈ grad * (patch - clean) ----
  const formula = createRef<Txt>();
  view.add(
    <Txt ref={formula}
      x={NOTES_X + NOTES_W / 2} y={310}
      fontSize={20} fontFamily={fonts.mono} fill={colors.sae}
      opacity={0} text={'IE_atp[i] = ∇ₐm[i] · (a_poisoned[i] − a_clean[i])'}
    />,
  );
  yield* formula().opacity(1, 0.4);

  const ieRows: Txt[] = [];
  for (let i = 0; i < FEATURES; i++) {
    const row = addNoteRow(`IE[${i.toString().padStart(2, '0')}] = ${fmt(IE_ATP[i])}`,
      Math.abs(IE_ATP[i]) > 0.1 ? colors.sae : colors.textMuted,
      i + 1, 3);
    ieRows.push(row);
  }
  // all 12 in parallel — that's the whole point
  yield* all(...ieRows.map(r => r.opacity(1, 0.4)));

  yield* slide('atp:combine', `
    Combine. For each feature: multiply gradient × (a_poisoned − a_clean).
    
    All 12 IE estimates pop out in parallel, no extra forward passes.
  `, 'Stanislas');

  // ---- ATP cost tally (right of naive tally, same row) ----
  const ATP_X = NOTES_X + NOTES_W / 2 + 40;
  const atpFwd = makeCounter(0, 0, ' fwd', {
    x: ATP_X, y: TALLY_Y, offsetX: -1,
    fontSize: 32, fontFamily: fonts.mono, fill: colors.sae, opacity: 0,
  });
  const atpBwd = makeCounter(0, 0, ' bwd', {
    x: ATP_X, y: TALLY_Y + 38, offsetX: -1,
    fontSize: 32, fontFamily: fonts.mono, fill: colors.sae, opacity: 0,
  });
  view.add(
    <>
      {atpFwd.node}
      {atpBwd.node}
    </>,
  );
  yield* all(
    atpFwd.handle.ref().opacity(1, 0.4),
    atpBwd.handle.ref().opacity(1, 0.4),
  );
  yield* all(
    atpFwd.handle.countTo(2, 1.4),
    atpBwd.handle.countTo(1, 1.4),
  );

  yield* slide('atp:summary', `
    ATP: 2 forward + 1 backward. Constant cost, regardless of node count.
    
    Tradeoff: ATP is a first-order approximation. Underestimates when m is nonlinear in a (paper's Fig. 25).
    Paper's fix: integrated gradients — average gradient along clean→patch path. More accurate, still cheap.
  `, 'Stanislas');

  yield* waitFor(0.2);
});

import { Circle, Layout, Line, makeScene2D, Rect, Txt } from '@motion-canvas/2d';
import { all, chain, createRef, sequence, waitFor } from '@motion-canvas/core';
import { addBackground } from '../lib/bg';
import { makeCounter } from '../lib/counter';
import { slideEdgeHighlight } from '../lib/network';
import { slide } from '../lib/slide';
import { setupSlide } from '../lib/slide-layout';
import { colors, fonts } from '../lib/theme';

// ---------- mock data ----------
const FEATURES = 12;
// Activations on a single bio "She worked in the OR for years..."
const ACT = [0.20, 0.70, 0.10, 0.85, 0.30, 0.42, 0.62, 0.20, 0.55, 0.15, 0.72, 0.50];
// Zero-ablation IE per feature: how much the loss CHANGES when feature i set to 0.
// Big magnitude = classifier relies on it. Sign here is how much "nurse" prob shifts.
const IE = [-0.03, -0.45, -0.02, -0.38, -0.05, -0.20, -0.32, -0.04, -0.12, -0.01, -0.22, -0.25];
// Human-readable labels (as if from Neuronpedia)
const LABELS = [
  'profession-title vocab',
  '"she/her" pronouns',
  'syntactic structure',
  'feminine name pattern',
  'workplace setting',
  'medical terminology',
  'female-coded language',
  'education vocabulary',
  'pronoun frequency',
  'punctuation pattern',
  'profession-noun phrases',
  'feminine adjectives',
];
// Flagged features = gender-related (task-irrelevant)
const FLAGGED = new Set([1, 3, 6, 8, 11]);

// ---------- layout constants (mirror scene 05) ----------
const INPUT_X = -780;
const HIDDEN1_X = -580;
const SAE_X = -340;
const OUTPUT_X = -90;
const METRIC_X = +110;

const NEURON_R = 22;
const SAE_R = 14;
const SAE_GAP = 60;

const NET_Y = 70;
const MAGENTA = '#d946ef';

const NOTES_X = 270;
const NOTES_W = 620;
const NOTES_COL_W = 280;

const fmt = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2);

export default makeScene2D(function* (view) {
  addBackground(view);
  const layout = setupSlide(view, { title: 'SHIFT: step 0 — the problem' });

  // =========================================================
  // === Title card: ambiguous training set + the shortcut ===
  // =========================================================
  const trainingPanel = createRef<Layout>();
  const dataLines: ReturnType<typeof createRef<Txt>>[] = [];
  view.add(
    <Layout ref={trainingPanel}
      x={0} y={-30} layout direction={'column'} gap={10} alignItems={'center'} opacity={0}>
      <Txt fontSize={26} fontFamily={fonts.sans} fill={colors.text}
        text={'Training set (ambiguous)'} />
      {[
        ['"He earned tenure in 2014..."', 'professor', colors.active],
        ['"She worked night shifts in OR..."', 'nurse',     colors.bad],
        ['"His lab studies black holes..."',  'professor', colors.active],
        ['"Her patients describe her as..."',  'nurse',     colors.bad],
      ].map(([bio, label, color], i) => {
        const ref = createRef<Txt>();
        dataLines.push(ref);
        return (
          <Txt ref={ref}
            fontSize={22} fontFamily={fonts.mono} fill={color as string}
            text={`${bio}   →   ${label}`} opacity={0}
          />
        );
      })}
      <Txt fontSize={22} fontFamily={fonts.sans} fill={colors.textMuted}
        text={'Gender PERFECTLY predicts profession in training data.'} />
      <Txt fontSize={20} fontFamily={fonts.sans} fill={colors.textMuted}
        text={'Classifier might learn profession… or might just learn gender. Cannot tell from data alone.'} />
    </Layout>,
  );

  yield* layout.showTitle();
  yield* trainingPanel().opacity(1, 0.3);
  yield* sequence(0.18, ...dataLines.map(t => t().opacity(1, 0.3)));

  yield* slide('shift:problem', `
    Bias-in-Bios: classify profession from biography.
    Worst case: "ambiguous set" = only male professors + female nurses.
    Gender = profession (100%). Standard debiasing fails — no labels disentangle the two signals.
    Goal: a profession classifier that ignores gender, using only this biased data.
  `, 'Stanislas');

  yield* trainingPanel().opacity(0, 0.3);

  // =========================================================
  // === Network ===
  // =========================================================

  // ---- section labels (no frames) ----
  const ogLbl    = createRef<Txt>();
  const saeLbl   = createRef<Txt>();

  view.add(
    <>
      <Txt ref={ogLbl}
        x={(INPUT_X + OUTPUT_X) / 2} y={NET_Y - 270}
        fontSize={18} fontFamily={fonts.mono} fill={colors.textMuted}
        text={'Original network (LM body + linear head)'} opacity={0}
      />
      <Txt ref={saeLbl}
        x={SAE_X} y={NET_Y - 380}
        fontSize={18} fontFamily={fonts.mono} fill={colors.sae}
        text={'SAE (interpretable view)'} opacity={0}
      />
    </>,
  );

  // input layer (3)
  const inputN: ReturnType<typeof createRef<Circle>>[] = [];
  for (let i = 0; i < 3; i++) {
    const r = createRef<Circle>();
    inputN.push(r);
    view.add(
      <Circle ref={r}
        x={INPUT_X} y={NET_Y + (i - 1) * 90}
        size={NEURON_R * 2}
        fill={colors.neuronFill} stroke={colors.neuronStroke} lineWidth={2}
        opacity={0} zIndex={10}
      />,
    );
  }

  // hidden layer (5)
  const hidN: ReturnType<typeof createRef<Circle>>[] = [];
  for (let i = 0; i < 5; i++) {
    const r = createRef<Circle>();
    hidN.push(r);
    view.add(
      <Circle ref={r}
        x={HIDDEN1_X} y={NET_Y + (i - 2) * 80}
        size={NEURON_R * 2}
        fill={colors.neuronFill} stroke={colors.neuronStroke} lineWidth={2}
        opacity={0} zIndex={10}
      />,
    );
  }

  // SAE column (12)
  const SAE_TOP = NET_Y - ((FEATURES - 1) * SAE_GAP) / 2;
  const saeN: ReturnType<typeof createRef<Circle>>[] = [];
  const saeTxt: ReturnType<typeof createRef<Txt>>[] = [];
  for (let i = 0; i < FEATURES; i++) {
    const r = createRef<Circle>();
    const t = createRef<Txt>();
    saeN.push(r);
    saeTxt.push(t);
    view.add(
      <>
        <Circle ref={r}
          x={SAE_X} y={SAE_TOP + i * SAE_GAP}
          size={SAE_R * 2 + 14}
          fill={colors.neuronFill} stroke={colors.sae} lineWidth={2}
          opacity={0} zIndex={11}
        />
        <Txt ref={t}
          x={SAE_X} y={SAE_TOP + i * SAE_GAP}
          fontSize={12} fontFamily={fonts.mono} fill={colors.text}
          opacity={0} text={'·'} zIndex={12}
        />
      </>,
    );
  }

  // edges
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

  // output layer (2 logits): "professor" / "nurse"
  const outProf  = createRef<Rect>();
  const outNurse = createRef<Rect>();
  const outProfTx  = createRef<Txt>();
  const outNurseTx = createRef<Txt>();
  view.add(
    <>
      <Rect ref={outProf}
        x={OUTPUT_X} y={NET_Y - 60} width={140} height={42}
        fill={'#1f2937'} stroke={colors.active} lineWidth={3} radius={8} opacity={0}
      />
      <Txt ref={outProfTx} x={OUTPUT_X} y={NET_Y - 60}
        fontSize={18} fontFamily={fonts.mono} fill={colors.active}
        text={'professor'} opacity={0}
      />
      <Rect ref={outNurse}
        x={OUTPUT_X} y={NET_Y + 60} width={140} height={42}
        fill={'#1f2937'} stroke={colors.bad} lineWidth={3} radius={8} opacity={0}
      />
      <Txt ref={outNurseTx} x={OUTPUT_X} y={NET_Y + 60}
        fontSize={18} fontFamily={fonts.mono} fill={colors.bad}
        text={'nurse'} opacity={0}
      />
    </>,
  );
  const edgesSO: ReturnType<typeof createRef<Line>>[] = [];
  for (let k = 0; k < FEATURES; k++) {
    edgesSO.push(mkEdge(SAE_X, SAE_TOP + k * SAE_GAP, OUTPUT_X - 70, NET_Y - 60));
    edgesSO.push(mkEdge(SAE_X, SAE_TOP + k * SAE_GAP, OUTPUT_X - 70, NET_Y + 60));
  }

  // metric m
  const metricBox = createRef<Rect>();
  const metricLbl = createRef<Txt>();
  const metricVal = createRef<Txt>();
  view.add(
    <>
      <Rect ref={metricBox}
        x={METRIC_X} y={NET_Y} width={170} height={76}
        fill={'#0b1220'} stroke={colors.accent} lineWidth={2} radius={10}
        opacity={0}
      />
      <Txt ref={metricLbl}
        x={METRIC_X} y={NET_Y - 18}
        fontSize={13} fontFamily={fonts.mono} fill={colors.textMuted}
        opacity={0} text={'m = −log P(y|x)'}
      />
      <Txt ref={metricVal}
        x={METRIC_X} y={NET_Y + 12}
        fontSize={26} fontFamily={fonts.mono} fill={colors.accent}
        opacity={0} text={'—'}
      />
    </>,
  );

  // input subject indicator
  const subjectTxt = createRef<Txt>();
  view.add(
    <Txt ref={subjectTxt}
      x={INPUT_X - 60} y={NET_Y} offsetX={1}
      fontSize={26} fontFamily={fonts.mono} fill={colors.bad}
      opacity={0} text={'"She…"'}
    />,
  );

  // notes panel (right side, holds inspection labels later)
  const notesBg    = createRef<Rect>();
  view.add(
    <Rect ref={notesBg}
      x={NOTES_X + NOTES_W / 2} y={0} width={NOTES_W} height={760}
      fill={'#0b1220'} stroke={colors.edge} lineWidth={1} radius={10} opacity={0}
    />,
  );

  // Reveal network with frames + labels
  yield* all(
    layout.title().opacity(0, 0.3),
  );
  layout.title().text('SHIFT: setup — classifier built on top of LM');
  yield* all(
    layout.title().opacity(1, 0.3),
    ogLbl().opacity(1, 0.4),
    saeLbl().opacity(1, 0.4),
    ...inputN.map(r => r().opacity(1, 0.4)),
    ...hidN.map(r => r().opacity(1, 0.4)),
    ...saeN.map(r => r().opacity(1, 0.4)),
    outProf().opacity(1, 0.4), outProfTx().opacity(1, 0.4),
    outNurse().opacity(1, 0.4), outNurseTx().opacity(1, 0.4),
    metricBox().opacity(1, 0.4), metricLbl().opacity(1, 0.4), metricVal().opacity(1, 0.4),
    ...edgesIH.map(e => e().end(1, 0.5)),
    ...edgesHS.map(e => e().end(1, 0.5)),
    ...edgesSO.map(e => e().end(1, 0.5)),
    subjectTxt().opacity(1, 0.4),
    notesBg().opacity(0.6, 0.4),
  );

  yield* slide('shift:network', `
    Setup: same architecture as before. Original network (gray frame) = LM body + linear classification head. SAE column (orange frame) gives us interpretable read-out of internal activations.
    The SAE does NOT replace the network — it sits alongside, reading internal activations and decomposing them into named features.
    Output: profession (professor / nurse). Metric: classifier loss m = −log P(y|x).
  `, 'Stanislas');

  // =========================================================
  // === Forward pass on a female-nurse bio ===
  // =========================================================
  function* forwardOnce(activations: number[], glow: string, faded: Set<number>) {
    yield* all(
      ...inputN.map(n => chain(n().fill(glow, 0.12), n().fill(colors.neuronFill, 0.2))),
    );
    yield* all(...edgesIH.map(e => slideEdgeHighlight(view, e(), glow, 0.4)));
    yield* all(
      ...hidN.map(n => chain(n().fill(glow, 0.12), n().fill(colors.neuronFill, 0.2))),
    );
    yield* all(...edgesHS.map(e => slideEdgeHighlight(view, e(), glow, 0.4)));
    yield* all(
      ...saeTxt.map((t, i) => all(
        t().text(faded.has(i) ? '0.00' : activations[i].toFixed(2), 0),
        t().opacity(faded.has(i) ? 0.25 : 1, 0.2),
      )),
    );
    yield* all(...edgesSO.map(e => slideEdgeHighlight(view, e(), glow, 0.4)));
  }

  yield* forwardOnce(ACT, colors.bad, new Set());
  // classifier prediction "nurse" wins
  yield* all(
    metricVal().text('+0.18', 0.3),
    metricVal().fill(colors.bad, 0.3),
    outNurse().fill(colors.bad, 0.3),
    outNurseTx().fill('#0b1220', 0.3),
  );

  yield* slide('shift:baseline', `
    Forward pass on a female-nurse biography. SAE features fire (see numbers inside circles).
    Classifier outputs "nurse" — correct on this training example. But IS that because of medical content, or because of the female pronouns? We cannot tell from output alone.
    Need to look inside.
  `, 'Stanislas');

  // =========================================================
  // === Step 1: Discover the circuit (zero-ablation ATP) ===
  // =========================================================
  yield* all(layout.title().opacity(0, 0.3));
  layout.title().text('Step 1: Discover the circuit (zero-ablation ATP)');
  yield* layout.title().opacity(1, 0.3);

  // Notes column header: "feature, IE"
  function addNoteRow(text: string, color: string, slot: number, col: number): Txt {
    const ref = createRef<Txt>();
    const x = NOTES_X + 20 + col * NOTES_COL_W;
    const y = -300 + slot * 26;
    view.add(
      <Txt ref={ref}
        x={x} y={y} offsetX={-1}
        fontSize={15} fontFamily={fonts.mono} fill={color}
        opacity={0} text={text}
      />,
    );
    return ref();
  }

  const notesIeHdr = addNoteRow('IE (zero-ablation)', colors.accent, 0, 0);
  yield* notesIeHdr.opacity(1, 0.3);

  yield* slide('shift:atp-intro', `
    Reuse ATP from before — but with the zero-ablation variant.
    Previously: clean vs patch pair. Now: ONE input, set each feature to 0 in turn, see how the metric m moves.
    IE_zero(feature i) = m(x | a_i = 0) − m(x).
    For visualization: walk through it feature by feature.
  `, 'Stanislas');

  const M_BASE = 0.18;
  const ieRows: Txt[] = [];

  // Per-feature ablation helper
  function* zeroAblate(i: number, detailed: boolean) {
    const dur = detailed ? 0.25 : 0.10;
    const sweepDur = detailed ? 0.4 : 0.18;

    // (a) Force feature i to 0: red flash on circle, value text → "0.00"
    yield* all(
      saeN[i]().stroke(colors.bad, dur),
      saeN[i]().fill('#1f2937', dur),
      saeTxt[i]().text('0.00', dur),
      saeTxt[i]().fill(colors.bad, dur),
    );
    if (detailed) yield* waitFor(0.1);

    // (b) Forward sweep through SAE→output edges. Edges leaving this feature are red
    //     (modified signal); the other 11 features' edges run their normal value.
    yield* all(
      ...edgesSO.map((e, idx) => {
        const featureIdx = Math.floor(idx / 2);
        const c = featureIdx === i ? colors.bad : colors.accent;
        return slideEdgeHighlight(view, e(), c, sweepDur);
      }),
    );

    // (c) Metric updates: loss changed by IE[i]
    const newM = M_BASE + IE[i];
    yield* all(
      metricVal().text(fmt(newM), dur),
      metricVal().fill(IE[i] >= 0 ? colors.bad : colors.good, dur),
    );
    if (detailed) yield* waitFor(0.15);

    // (d) Write IE row to notes
    const row = addNoteRow(
      `f${i.toString().padStart(2, '0')}: IE = ${fmt(IE[i])}`,
      Math.abs(IE[i]) > 0.15 ? colors.bad : colors.textMuted,
      i + 1, 0,
    );
    ieRows.push(row);
    yield* row.opacity(1, dur);

    // (e) Restore feature i (un-ablate)
    yield* all(
      saeN[i]().stroke(colors.sae, dur),
      saeTxt[i]().text(ACT[i].toFixed(2), dur),
      saeTxt[i]().fill(colors.text, dur),
      metricVal().text(fmt(M_BASE), dur),
      metricVal().fill(colors.bad, dur),
    );
  }

  // Detailed runs for first 2 features
  yield* zeroAblate(0, true);
  yield* slide('shift:atp-feat0', `
    Feature 0: force activation to 0, run forward, see the metric.
    IE_0 = ${fmt(IE[0])}. Tiny effect — classifier barely uses this feature.
    Same procedure for every feature. (In practice we use the gradient trick to do all 12 in two passes — but the conceptual operation is what we just did.)
  `, 'Stanislas');

  yield* zeroAblate(1, true);
  yield* slide('shift:atp-feat1', `
    Feature 1: same procedure. IE_1 = ${fmt(IE[1])} — large. Classifier relies heavily on this one. (Spoiler from step 2: this is the "she/her pronoun" feature.)
  `, 'Stanislas');

  // Time-lapse the rest
  for (let i = 2; i < FEATURES; i++) {
    yield* zeroAblate(i, false);
  }

  yield* slide('shift:atp-result', `
    Done: every SAE feature has its IE. Bigger |IE| = classifier relies on it more.
    BUT: this only says which features matter — not whether they're profession-relevant or gender-relevant.
    Step 2 fixes that by labeling each feature.
  `, 'Stanislas');

  // =========================================================
  // === Step 2: Human inspection ===
  // =========================================================
  yield* all(layout.title().opacity(0, 0.3));
  layout.title().text('Step 2: Human inspects each feature');
  yield* layout.title().opacity(1, 0.3);

  // Add labels column (col 1)
  const lblHdr = addNoteRow('label   →   verdict', colors.text, 0, 1);
  yield* lblHdr.opacity(1, 0.3);

  const labelRows: Txt[] = [];
  const verdictRows: Txt[] = [];
  for (let i = 0; i < FEATURES; i++) {
    const flagged = FLAGGED.has(i);
    const verdictTxt = flagged ? '✗ irrelevant' : '✓ keep';
    const row = addNoteRow(
      `${LABELS[i]}`,
      colors.text,
      i + 1, 1,
    );
    labelRows.push(row);
    // verdict text (small, right of label)
    const vRef = createRef<Txt>();
    const x = NOTES_X + 20 + 1 * NOTES_COL_W + 220;
    const y = -300 + (i + 1) * 26;
    view.add(
      <Txt ref={vRef}
        x={x} y={y} offsetX={-1}
        fontSize={14} fontFamily={fonts.mono} fill={flagged ? colors.bad : colors.good}
        opacity={0} text={verdictTxt}
      />,
    );
    verdictRows.push(vRef());
  }

  // Reveal label by label, with verdict
  for (let i = 0; i < FEATURES; i++) {
    yield* all(
      labelRows[i].opacity(1, 0.18),
      verdictRows[i].opacity(1, 0.18),
      // tag flagged SAE circles with red stroke flicker
      ...(FLAGGED.has(i) ? [
        saeN[i]().stroke(colors.bad, 0.2).to(colors.bad, 0.2),
      ] : []),
    );
    if (i === 1) {
      yield* slide('shift:inspect-1', `
        Human pulls up max-activating examples on Neuronpedia for each feature.
        Feature 1 fires hardest on "she", "her", "hers", "herself" — pure gender pronouns. Task-irrelevant for profession classification → flag.
      `, 'Stanislas');
    } else if (i === 5) {
      yield* slide('shift:inspect-5', `
        Feature 5 fires on medical terminology: "patient", "OR", "shift", "ward". This IS task-relevant — nurses do work with these terms. → keep.
      `, 'Stanislas');
    }
  }

  yield* slide('shift:inspect-done', `
    Out of 12 features: 5 flagged as task-irrelevant (gender-related), 7 kept (profession content).
    Paper's real numbers: 55 of 67 Pythia features flagged, 43 of 46 Gemma features flagged. Most features encoded the shortcut.
    No labels needed. Just human judgement on interpretable units.
  `, 'Stanislas');

  // =========================================================
  // === Step 3: Ablate ===
  // =========================================================
  yield* all(layout.title().opacity(0, 0.3));
  layout.title().text('Step 3: Ablate the flagged features');
  yield* layout.title().opacity(1, 0.3);

  // Crossed-out visual: stroke red, slash inside, fade text
  const slashes: ReturnType<typeof createRef<Line>>[] = [];
  for (const i of FLAGGED) {
    yield* all(
      saeN[i]().fill('#1f2937', 0.3),
      saeN[i]().stroke(colors.bad, 0.3),
      saeN[i]().opacity(0.45, 0.3),
      saeTxt[i]().text('0.00', 0.3),
      saeTxt[i]().fill(colors.bad, 0.3),
      saeTxt[i]().opacity(0.5, 0.3),
    );
    // small slash through the circle
    const slash = createRef<Line>();
    const cx = SAE_X;
    const cy = SAE_TOP + i * SAE_GAP;
    const r = SAE_R + 6;
    view.add(
      <Line ref={slash}
        points={[[cx - r, cy - r], [cx + r, cy + r]]}
        stroke={colors.bad} lineWidth={2.5} opacity={0} zIndex={13}
      />,
    );
    slashes.push(slash);
    yield* slash().opacity(1, 0.15);
  }

  // Edges from flagged features: dashed gray
  for (const i of FLAGGED) {
    // each SAE feature has 2 edges to output (idx = 2i, 2i+1 in edgesSO)
    yield* all(
      edgesSO[i * 2]().stroke(colors.edge, 0.2),
      edgesSO[i * 2]().lineDash([4, 4], 0.2),
      edgesSO[i * 2]().opacity(0.3, 0.2),
      edgesSO[i * 2 + 1]().stroke(colors.edge, 0.2),
      edgesSO[i * 2 + 1]().lineDash([4, 4], 0.2),
      edgesSO[i * 2 + 1]().opacity(0.3, 0.2),
    );
  }

  // Re-run forward with ablated features. Output shifts.
  yield* forwardOnce(ACT, colors.bad, FLAGGED);
  // metric goes UP (loss higher) — accuracy temporarily drops
  yield* all(
    metricVal().text('+0.94', 0.3),
    metricVal().fill(colors.bad, 0.3),
  );

  yield* slide('shift:ablate', `
    Ablation: clamp flagged features to 0 in the residual stream. Visually: those SAE circles dead, edges dashed.

    Notice: the LOSS WENT UP. The classifier was using these gender features to decide. Without them, predictions degrade. Profession accuracy: 75.5%, gender accuracy: 73% (paper's "SHIFT no-retrain" row). Better than original on profession, but not great.

    The classifier's head is wired to use those features. We need to rewire it. → step 4.
  `, 'Stanislas');

  // =========================================================
  // === Step 4: Retrain head ===
  // =========================================================
  yield* all(layout.title().opacity(0, 0.3));
  layout.title().text('Step 4: Retrain the linear head (head only — rest frozen)');
  yield* layout.title().opacity(1, 0.3);

  // Padlock indicators on frozen parts
  const padInput = createRef<Txt>();
  const padHidden = createRef<Txt>();
  const padSae = createRef<Txt>();
  view.add(
    <>
      <Txt ref={padInput}
        x={INPUT_X} y={NET_Y - 200}
        fontSize={26} fontFamily={fonts.sans} fill={colors.textMuted}
        opacity={0} text={'🔒 frozen'}
      />
      <Txt ref={padHidden}
        x={HIDDEN1_X} y={NET_Y - 250}
        fontSize={26} fontFamily={fonts.sans} fill={colors.textMuted}
        opacity={0} text={'🔒 frozen'}
      />
      <Txt ref={padSae}
        x={SAE_X} y={NET_Y - 380}
        fontSize={26} fontFamily={fonts.sans} fill={colors.textMuted}
        opacity={0} text={'🔒 frozen'}
      />
    </>,
  );
  yield* all(
    padInput().opacity(1, 0.3),
    padHidden().opacity(1, 0.3),
    padSae().opacity(1, 0.3),
  );

  yield* slide('shift:retrain-setup', `
    Step 4: only the linear classification head gets retrained. That's the SAE-features → output edges. Just one matrix.
    Everything else is FROZEN: input embeddings, LM body (hidden), SAE basis, feature labels — none of it changes.
    Why retrain at all? The head was using feature-1 ("she/her") to route to "nurse". Now feature-1 is permanently 0. Head must learn a new path: use feature-5 (medical terms) and feature-10 (profession nouns) for the "nurse" decision instead.
    Crucially: the dead features stay dead, so the head can't relearn the bias.
  `, 'Stanislas');

  // Highlight the SAE→output edges as "the head"
  const headHighlight = createRef<Txt>();
  view.add(
    <Txt ref={headHighlight}
      x={(SAE_X + OUTPUT_X) / 2} y={NET_Y + 380}
      fontSize={20} fontFamily={fonts.mono} fill={MAGENTA}
      opacity={0} text={'↑ retraining the head: SAE features → output weights'}
    />,
  );
  yield* headHighlight().opacity(1, 0.3);

  // Animate retraining: pulse alive (kept) edges magenta several times to show "weight updates"
  const aliveIdxs: number[] = [];
  for (let k = 0; k < FEATURES; k++) {
    if (!FLAGGED.has(k)) {
      aliveIdxs.push(k * 2);
      aliveIdxs.push(k * 2 + 1);
    }
  }
  // 5 epochs of pulses
  for (let ep = 0; ep < 5; ep++) {
    yield* all(
      ...aliveIdxs.map(idx => slideEdgeHighlight(view, edgesSO[idx](), MAGENTA, 0.3)),
    );
  }
  yield* headHighlight().opacity(0, 0.2);

  // Re-run forward with retrained head — now output is correct AND confident
  yield* forwardOnce(ACT, colors.bad, FLAGGED);
  yield* all(
    metricVal().text('+0.12', 0.3),
    metricVal().fill(colors.good, 0.3),
    outNurse().fill(colors.bad, 0.3),
    outNurseTx().fill('#0b1220', 0.3),
  );

  yield* slide('shift:retrain-after', `
    Head re-fitted. Same input ("She worked night shifts in OR") still classified as "nurse" — but now via medical-terminology features, not gender features.
    Critical test: a male nurse bio. Original classifier would mis-classify (gender said "professor"). New classifier? Correct, because content drives it.
  `, 'Stanislas');

  // =========================================================
  // === Result reveal ===
  // =========================================================
  yield* all(
    layout.title().opacity(0, 0.3),
    ...inputN.map(r => r().opacity(0.2, 0.3)),
    ...hidN.map(r => r().opacity(0.2, 0.3)),
    ...saeN.map(r => r().opacity(0.2, 0.3)),
    ...saeTxt.map(r => r().opacity(0, 0.3)),
    ogLbl().opacity(0.2, 0.3),
    saeLbl().opacity(0.2, 0.3),
    outProf().opacity(0.2, 0.3), outProfTx().opacity(0.2, 0.3),
    outNurse().opacity(0.2, 0.3), outNurseTx().opacity(0.2, 0.3),
    metricBox().opacity(0.2, 0.3), metricLbl().opacity(0.2, 0.3), metricVal().opacity(0.2, 0.3),
    subjectTxt().opacity(0, 0.3),
    notesBg().opacity(0, 0.3),
    ...edgesIH.map(e => e().opacity(0.1, 0.3)),
    ...edgesHS.map(e => e().opacity(0.1, 0.3)),
    ...edgesSO.map(e => e().opacity(0.1, 0.3)),
    ...slashes.map(s => s().opacity(0.2, 0.3)),
    padInput().opacity(0, 0.3), padHidden().opacity(0, 0.3), padSae().opacity(0, 0.3),
    ...ieRows.map(r => r.opacity(0, 0.2)),
    ...labelRows.map(r => r.opacity(0, 0.2)),
    ...verdictRows.map(r => r.opacity(0, 0.2)),
    notesIeHdr.opacity(0, 0.2),
    lblHdr.opacity(0, 0.2),
  );
  layout.title().text('SHIFT result: matches the oracle, no balanced data');
  yield* layout.title().opacity(1, 0.3);

  // Three counters: profession, gender, worst-group (each: original → SHIFT)
  const profOrig = makeCounter(0, 1, '%', {
    x: -460, y: -50, fontSize: 64, fontFamily: fonts.mono, fill: colors.bad, opacity: 0,
  });
  const profNew = makeCounter(0, 1, '%', {
    x: -460, y: 60, fontSize: 64, fontFamily: fonts.mono, fill: colors.good, opacity: 0,
  });
  const genderOrig = makeCounter(0, 1, '%', {
    x: 0, y: -50, fontSize: 64, fontFamily: fonts.mono, fill: colors.bad, opacity: 0,
  });
  const genderNew = makeCounter(0, 1, '%', {
    x: 0, y: 60, fontSize: 64, fontFamily: fonts.mono, fill: colors.good, opacity: 0,
  });
  const wgOrig = makeCounter(0, 1, '%', {
    x: 460, y: -50, fontSize: 64, fontFamily: fonts.mono, fill: colors.bad, opacity: 0,
  });
  const wgNew = makeCounter(0, 1, '%', {
    x: 460, y: 60, fontSize: 64, fontFamily: fonts.mono, fill: colors.good, opacity: 0,
  });

  const headersY = -160;
  const hdr1 = createRef<Txt>(); const hdr2 = createRef<Txt>(); const hdr3 = createRef<Txt>();
  const lblOrig1 = createRef<Txt>(); const lblNew1 = createRef<Txt>();
  const lblOrig2 = createRef<Txt>(); const lblNew2 = createRef<Txt>();
  const lblOrig3 = createRef<Txt>(); const lblNew3 = createRef<Txt>();

  view.add(
    <>
      <Txt ref={hdr1} x={-460} y={headersY} fontSize={26} fontFamily={fonts.sans} fill={colors.text} opacity={0} text={'profession ↑'} />
      <Txt ref={hdr2} x={0}    y={headersY} fontSize={26} fontFamily={fonts.sans} fill={colors.text} opacity={0} text={'gender ↓'} />
      <Txt ref={hdr3} x={460}  y={headersY} fontSize={26} fontFamily={fonts.sans} fill={colors.text} opacity={0} text={'worst-group ↑'} />
      <Txt ref={lblOrig1} x={-460} y={-110} fontSize={16} fontFamily={fonts.mono} fill={colors.textMuted} opacity={0} text={'original'} />
      <Txt ref={lblNew1}  x={-460} y={130}  fontSize={16} fontFamily={fonts.mono} fill={colors.textMuted} opacity={0} text={'after SHIFT'} />
      <Txt ref={lblOrig2} x={0}    y={-110} fontSize={16} fontFamily={fonts.mono} fill={colors.textMuted} opacity={0} text={'original'} />
      <Txt ref={lblNew2}  x={0}    y={130}  fontSize={16} fontFamily={fonts.mono} fill={colors.textMuted} opacity={0} text={'after SHIFT'} />
      <Txt ref={lblOrig3} x={460}  y={-110} fontSize={16} fontFamily={fonts.mono} fill={colors.textMuted} opacity={0} text={'original'} />
      <Txt ref={lblNew3}  x={460}  y={130}  fontSize={16} fontFamily={fonts.mono} fill={colors.textMuted} opacity={0} text={'after SHIFT'} />
      {profOrig.node}{profNew.node}{genderOrig.node}{genderNew.node}{wgOrig.node}{wgNew.node}
    </>,
  );

  yield* all(
    hdr1().opacity(1, 0.3), hdr2().opacity(1, 0.3), hdr3().opacity(1, 0.3),
    lblOrig1().opacity(1, 0.3), lblNew1().opacity(1, 0.3),
    lblOrig2().opacity(1, 0.3), lblNew2().opacity(1, 0.3),
    lblOrig3().opacity(1, 0.3), lblNew3().opacity(1, 0.3),
    profOrig.handle.ref().opacity(1, 0.3), profNew.handle.ref().opacity(1, 0.3),
    genderOrig.handle.ref().opacity(1, 0.3), genderNew.handle.ref().opacity(1, 0.3),
    wgOrig.handle.ref().opacity(1, 0.3), wgNew.handle.ref().opacity(1, 0.3),
  );

  yield* all(
    profOrig.handle.countTo(61.9, 1.4),
    genderOrig.handle.countTo(87.4, 1.4),
    wgOrig.handle.countTo(24.4, 1.4),
  );

  yield* slide('shift:result-before', `
    Original Pythia classifier on balanced test data:
    profession 61.9% (close to majority class), gender 87.4% (heavy bias), worst-group 24.4% (the minority group is ~lost).
  `, 'Stanislas');

  yield* all(
    profNew.handle.countTo(93.0, 1.4),
    genderNew.handle.countTo(49.4, 1.4),
    wgNew.handle.countTo(91.9, 1.4),
  );

  yield* slide('shift:result-after', `
    After SHIFT + retrain:
    profession 93.0% (matches the oracle that had access to balanced labeled data!).
    gender 49.4% — back to chance level. Classifier truly cannot tell gender anymore.
    worst-group 91.9% — minority groups now classified correctly.
    All from the biased ambiguous set. No labels disentangling the two signals. Just SAE features + human inspection + ATP.
  `, 'Stanislas');

  yield* slide('shift:closing', `
    Recap of the recipe:
    1. ATP → which features does the classifier use?
    2. Human → which of those are task-irrelevant?
    3. Ablate → kill the bad ones at the residual-stream level.
    4. Retrain head → recover accuracy without bringing back the bias.
    The whole thing only works because SAE features are interpretable enough for step 2. Raw neurons fail.
  `, 'Stanislas');

  yield* waitFor(0.2);
});

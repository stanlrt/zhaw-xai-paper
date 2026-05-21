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
  const layout = setupSlide(view, { title: 'SHIFT — Sparse Human-Interpretable Feature Trimming' });

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
    SHIFT stands for Sparse Human-Interpretable Feature Trimming. It is the main practical application introduced in this paper.
    The Bias-in-Bios dataset: biographies of real people, labeled with their profession.
    The authors create a worst-case training set — every professor is male, every nurse is female.
    Gender and profession are perfectly correlated. The classifier can't tell which one it's actually learning.
    Standard debiasing needs labeled data that separates the two signals. That's impossible here.
    The goal of the paper is to build a fair profession classifier using only this biased data and no extra labels.
  `, 'Elio');

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
        opacity={0} text={'classifier loss'}
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
  layout.title().text('SHIFT: setup — a window into the classifier');
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
    Here is the setup. A language model with a linear classification head on top predicts the profession.
    The SAE — the sparse autoencoder from before — is our window into the model's internals.
    Think of it as a translator: it converts the model's messy activations into named, human-readable features.
    The SAE doesn't change what the model does — it just lets us see and reason about what's happening inside.
  `, 'Elio');

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
    We run a biography like this through the classifier: "She worked night shifts in the OR for 12 years. Her patients describe her as compassionate and dedicated."
    The classifier predicts "nurse" — correct.
    But we don't know why. Is it the medical content — "OR", "night shifts", "patients"? Or is it "She" and "Her"?
    The output looks right, but the reason might be wrong. We need to look inside.
  `, 'Elio');

  // =========================================================
  // === Step 1: Discover the circuit (zero-ablation ATP) ===
  // =========================================================
  yield* all(layout.title().opacity(0, 0.3));
  layout.title().text('Step 1: Find which features the classifier relies on');
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

  const notesIeHdr = addNoteRow('importance when removed', colors.accent, 0, 0);
  yield* notesIeHdr.opacity(1, 0.3);

  yield* slide('shift:atp-intro', `
    The same attribution patching from before is applied here, but to each SAE feature one at a time.
    The box on the right shows the classifier's loss — higher means the classifier is less confident in the correct answer.
    Each feature gets zeroed out and the change in loss is measured.
    If the loss changes a lot, the classifier was heavily relying on that feature — it shows up red in the panel.
    If the loss barely moves, the feature is negligible — shown in grey. Let's walk through it.
  `, 'Elio');

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
    const importance = Math.abs(IE[i]);
    const verdict = importance > 0.3 ? 'critical' : importance > 0.15 ? 'significant' : 'negligible';
    const row = addNoteRow(
      `feature ${(i + 1).toString().padStart(2, ' ')}  →  ${verdict}`,
      importance > 0.15 ? colors.bad : colors.textMuted,
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
    Feature 0 — "profession-title vocabulary" — barely affects the prediction when we turn it off.
    The classifier isn't really using this feature. The panel on the right shows "negligible".
    The same test is run for every feature.
  `, 'Elio');

  yield* zeroAblate(1, true);
  yield* slide('shift:atp-feat1', `
    Feature 1 is very different. Turn it off, and the prediction changes dramatically — marked "critical".
    The classifier relies heavily on this feature.
    Spoiler from step 2: it turns out to be the "she/her pronouns" feature. The classifier is using gender.
  `, 'Elio');

  // Time-lapse the rest
  for (let i = 2; i < FEATURES; i++) {
    yield* zeroAblate(i, false);
  }

  yield* slide('shift:atp-result', `
    Every feature is now rated: negligible, significant, or critical.
    But that rating alone doesn't tell us whether the feature is about profession or about gender.
    A feature could be critical AND encode the wrong thing. Step 2 answers that.
  `, 'Elio');

  // =========================================================
  // === Step 2: Human inspection ===
  // =========================================================
  yield* all(layout.title().opacity(0, 0.3));
  layout.title().text('Step 2: Human inspects each feature');
  yield* all(
    layout.title().opacity(1, 0.3),
    notesIeHdr.opacity(0, 0.3),
  );

  // Add labels column (col 1)
  const lblHdr = addNoteRow('feature   →   relevant?', colors.text, 0, 1);
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
        Step 2: a human annotator looks at what each feature actually represents.
        The authors use Neuronpedia — a public tool that shows short text passages from a large corpus, with the specific token that activated each feature highlighted.
        The annotator reads those passages and asks: what do all the highlighted tokens have in common? That pattern becomes the label.
        For feature 1, every highlighted token is "she", "her", "hers", or "herself" — female pronouns, nothing about profession.
        Flag it as task-irrelevant.
      `, 'Elio');
    } else if (i === 5) {
      yield* slide('shift:inspect-5', `
        Feature 5 is different. It fires on "patient", "OR", "shift", "ward" — medical terminology.
        This IS relevant to profession classification: nurses work with these terms. Keep it.
        This is the key step: human judgement on interpretable features. No extra labels needed.
      `, 'Elio');
    }
  }

  yield* slide('shift:inspect-done', `
    In this demo: 5 features flagged as gender-related, 7 kept as profession content.
    Real numbers from the paper: 55 out of 67 features in the Pythia circuit were flagged.
    The classifier had mostly learned gender — not profession. That's the shortcut.
    And we identified it with no extra labels, just by reading what the features represent.
  `, 'Elio');

  // =========================================================
  // === Step 3: Ablate ===
  // =========================================================
  yield* all(layout.title().opacity(0, 0.3));
  layout.title().text('Step 3: Remove the biased features');
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
    Step 3: we permanently zero out the gender features. The crossed-out circles no longer contribute.
    Notice the loss went up. The classifier was relying on gender features to make decisions — and now they're gone.
    Profession accuracy without retraining: 75.5%. Better than before, but not great.
    The last layer is still wired to expect those features. We need to rewire it. That's step 4.
  `, 'Elio');

  // =========================================================
  // === Step 4: Retrain head ===
  // =========================================================
  yield* all(layout.title().opacity(0, 0.3));
  layout.title().text('Step 4: Retrain only the final layer');
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
    Step 4: only the final classification layer gets retrained. Everything else stays frozen — the language model, the SAE, all of that.
    The final layer was wired to use the "she/her" feature to predict "nurse". That feature is now permanently zero.
    So the layer has to find a new path: use medical terminology and profession vocabulary instead.
    Because the gender features stay zeroed out, the layer cannot relearn the shortcut — even training on the same biased data.
  `, 'Elio');

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
    The same biography — "She worked night shifts in OR" — is still classified as nurse.
    But now it's because of the medical content, not because of "she".
    Critical test: a male nurse biography. The original classifier would say "professor" because of gender.
    The new classifier says "nurse" — correctly — because it learned to use profession content.
  `, 'Elio');

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
  layout.title().text('SHIFT result: fair classification without extra labeled data');
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
    The original classifier, tested on balanced data it has never seen:
    Profession accuracy is 62% — barely above chance. Gender accuracy is 87% — it is essentially a gender classifier.
    "Worst-group" refers to the demographic group with the lowest accuracy — here, male nurses and female professors, who are the minority in the biased training data. Only 24% of them are classified correctly.
  `, 'Elio');

  yield* all(
    profNew.handle.countTo(93.0, 1.4),
    genderNew.handle.countTo(49.4, 1.4),
    wgNew.handle.countTo(91.9, 1.4),
  );

  yield* slide('shift:result-after', `
    After SHIFT: profession accuracy jumps to 93% — matching the oracle trained on perfectly balanced, labeled data.
    Gender accuracy drops to 49%: the classifier can no longer predict gender. It's at chance level.
    Worst-group accuracy: 92%. Male nurses and female professors are now classified correctly.
    All of this from the same biased training data, with no extra labels, just SAE features and human inspection.
  `, 'Elio');

  yield* slide('shift:closing', `
    To recap SHIFT, the technique introduced in the paper:
    Step 1 — find which features the classifier uses most, by testing what breaks when each is removed.
    Step 2 — a human reads the features and labels them: task-relevant or not.
    Step 3 — remove the irrelevant ones permanently.
    Step 4 — retrain only the final layer to recover accuracy on legitimate signals.
    The authors show this only works because SAE features are human-readable — with raw neurons, step 2 is not possible, since a single neuron rarely has a clear meaning.
  `, 'Elio');

  yield* waitFor(0.2);
});

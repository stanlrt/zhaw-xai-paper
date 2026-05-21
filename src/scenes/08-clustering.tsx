import { Circle, Layout, Line, makeScene2D, Rect, Txt } from '@motion-canvas/2d';
import { all, chain, createRef, sequence, waitFor } from '@motion-canvas/core';
import { addBackground } from '../lib/bg';
import { makeCounter } from '../lib/counter';
import { slide } from '../lib/slide';
import { setupSlide } from '../lib/slide-layout';
import { colors, fonts } from '../lib/theme';

function rand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export default makeScene2D(function* (view) {
  addBackground(view);
  const layout = setupSlide(view, { title: 'Automatic circuit discovery (paper §5)' });

  // =========================================================
  // === Slide 1: motivation ===
  // =========================================================
  const motL1 = createRef<Txt>();
  const motL2 = createRef<Txt>();
  const motL3 = createRef<Txt>();
  const motL4 = createRef<Txt>();
  const motStrike = createRef<Line>();
  view.add(
    <>
      <Txt ref={motL1}
        x={0} y={-100} fontSize={28} fontFamily={fonts.sans} fill={colors.textMuted} opacity={0}
        text={'So far: pick a behavior by hand → find its circuit.'}
      />
      <Txt ref={motL2}
        x={0} y={-50} fontSize={22} fontFamily={fonts.mono} fill={colors.textMuted} opacity={0}
        text={'verb agreement   ·   gender bias   ·   factual recall   ·   …'}
      />
      <Line ref={motStrike}
        points={[[-440, -50], [440, -50]]}
        stroke={colors.bad} lineWidth={3} opacity={0} end={0}
      />
      <Txt ref={motL3}
        x={0} y={50} fontSize={28} fontFamily={fonts.sans} fill={colors.text} opacity={0}
        text={'Doesn\'t scale. Most behaviors we don\'t know about yet.'}
      />
      <Txt ref={motL4}
        x={0} y={120} fontSize={32} fontFamily={fonts.sans} fill={colors.sae} opacity={0}
        text={'Can we discover behaviors automatically?'}
      />
    </>,
  );

  yield* layout.showTitle();
  yield* all(motL1().opacity(1, 0.4), motL2().opacity(1, 0.4));
  yield* all(motStrike().opacity(1, 0.3), motStrike().end(1, 0.5));
  yield* motL3().opacity(1, 0.4);
  yield* motL4().opacity(1, 0.4);

  yield* slide('cluster:motivation', `
    Up to now: human picks a behavior (verb agreement, gender bias), runs ATP, gets one circuit.
    Doesn't scale. LMs do thousands of things. Most we have no name for.
    Question: can we find behaviors WITHOUT a human curating tasks first?
    Paper §5 answers yes.
  `, 'Menan', true);

  // Fade out motivation
  yield* all(
    motL1().opacity(0, 0.3),
    motL2().opacity(0, 0.3),
    motStrike().opacity(0, 0.3),
    motL3().opacity(0, 0.3),
    motL4().opacity(0, 0.3),
  );

  // =========================================================
  // === Slide 2: pipeline ===
  // =========================================================
  yield* layout.title().opacity(0, 0.3);
  layout.title().text('Pipeline: behavior discovery via clustering');
  yield* layout.title().opacity(1, 0.3);

  const PIPE_Y = -50;
  const PIPE_BOX_W = 220;
  const PIPE_BOX_H = 90;
  const PIPE_GAP = 50;

  const pipeStages = [
    { title: 'corpus', sub: 'large text dataset\n(samples (xᵢ, yᵢ))' },
    { title: 'behavior vector', sub: 'vᵢ = ∇log P(yᵢ | xᵢ)' },
    { title: 'cluster',  sub: 'group {vᵢ} into\nsubcorpora' },
    { title: 'ATP per cluster', sub: 'one feature circuit\nper subcorpus' },
  ];
  const pipeTotalW = pipeStages.length * PIPE_BOX_W + (pipeStages.length - 1) * PIPE_GAP;
  const pipeX0 = -pipeTotalW / 2 + PIPE_BOX_W / 2;

  const pipeBoxes: ReturnType<typeof createRef<Rect>>[] = [];
  const pipeTitles: ReturnType<typeof createRef<Txt>>[] = [];
  const pipeSubs:   ReturnType<typeof createRef<Txt>>[] = [];
  const pipeArrows: ReturnType<typeof createRef<Line>>[] = [];

  for (let s = 0; s < pipeStages.length; s++) {
    const x = pipeX0 + s * (PIPE_BOX_W + PIPE_GAP);
    const box = createRef<Rect>();
    const t1 = createRef<Txt>();
    const t2 = createRef<Txt>();
    pipeBoxes.push(box);
    pipeTitles.push(t1);
    pipeSubs.push(t2);
    view.add(
      <>
        <Rect ref={box}
          x={x} y={PIPE_Y} width={PIPE_BOX_W} height={PIPE_BOX_H}
          fill={'#0b1220'} stroke={colors.sae} lineWidth={2} radius={10} opacity={0}
        />
        <Txt ref={t1}
          x={x} y={PIPE_Y - 20}
          fontSize={20} fontFamily={fonts.sans} fill={colors.sae} opacity={0}
          text={pipeStages[s].title}
        />
        <Txt ref={t2}
          x={x} y={PIPE_Y + 18}
          fontSize={14} fontFamily={fonts.mono} fill={colors.textMuted} opacity={0}
          text={pipeStages[s].sub}
        />
      </>,
    );
    if (s < pipeStages.length - 1) {
      const arr = createRef<Line>();
      pipeArrows.push(arr);
      const xL = x + PIPE_BOX_W / 2 + 4;
      const xR = x + PIPE_BOX_W + PIPE_GAP - PIPE_BOX_W / 2 - 4;
      view.add(
        <Line ref={arr}
          points={[[xL, PIPE_Y], [xR, PIPE_Y]]}
          stroke={colors.sae} lineWidth={2} endArrow arrowSize={10} opacity={0}
        />,
      );
    }
  }

  for (let s = 0; s < pipeStages.length; s++) {
    yield* all(
      pipeBoxes[s]().opacity(1, 0.3),
      pipeTitles[s]().opacity(1, 0.3),
      pipeSubs[s]().opacity(1, 0.3),
      ...(s < pipeArrows.length ? [pipeArrows[s]().opacity(1, 0.3)] : []),
    );
  }

  yield* slide('cluster:pipeline', `
    Four-stage pipeline:
    1. Corpus = lots of (context, next-token) samples from a big text dataset.
    2. For each sample, compute a behavior vector vᵢ. Authors use the per-sample loss gradient — captures HOW the model arrived at this prediction.
    3. Cluster the vᵢ. Samples that use the same internal mechanism get similar vectors → end up in the same cluster.
    4. Each cluster is itself a sub-corpus. Run ATP on it (zero-ablation, like SHIFT) → get one circuit per cluster.
  `, 'Menan', true);

  // Fade pipeline out
  yield* all(
    ...pipeBoxes.map(b => b().opacity(0, 0.3)),
    ...pipeTitles.map(t => t().opacity(0, 0.3)),
    ...pipeSubs.map(t => t().opacity(0, 0.3)),
    ...pipeArrows.map(a => a().opacity(0, 0.3)),
  );

  // =========================================================
  // === Slide 3: behavior vector zoom ===
  // =========================================================
  yield* layout.title().opacity(0, 0.3);
  layout.title().text('What is the behavior vector?');
  yield* layout.title().opacity(1, 0.3);

  // Sample text on left
  const sampleBox = createRef<Rect>();
  const sampleTxt = createRef<Txt>();
  view.add(
    <>
      <Rect ref={sampleBox}
        x={-500} y={-50} width={460} height={140}
        fill={'#1f2937'} stroke={colors.edge} lineWidth={1.5} radius={10} opacity={0}
      />
      <Txt ref={sampleTxt}
        x={-500} y={-50} width={420} fontSize={20}
        fontFamily={fonts.mono} fill={colors.text} opacity={0} textAlign={'center'}
        text={'context: "Mon Tue Wed "\nnext token: "Thu"'}
      />
    </>,
  );

  const arrow1 = createRef<Line>();
  const formula = createRef<Txt>();
  view.add(
    <>
      <Line ref={arrow1}
        points={[[-260, -50], [-110, -50]]}
        stroke={colors.sae} lineWidth={2} endArrow arrowSize={10} opacity={0}
      />
      <Txt ref={formula}
        x={-185} y={-90}
        fontSize={18} fontFamily={fonts.mono} fill={colors.sae} opacity={0}
        text={'∇log P(y|x)'}
      />
    </>,
  );

  // Vector bars on right (12 bars)
  const VEC_DIMS = 14;
  const VEC_X = 200;
  const VEC_BAR_W = 22;
  const VEC_BAR_GAP = 6;
  const vecBars: ReturnType<typeof createRef<Rect>>[] = [];
  // Mock heights (deterministic random-ish)
  const VEC_HEIGHTS = [0.4, 0.85, 0.2, 0.65, 0.3, 0.9, 0.5, 0.15, 0.75, 0.45, 0.25, 0.6, 0.35, 0.55];
  for (let d = 0; d < VEC_DIMS; d++) {
    const h = VEC_HEIGHTS[d] * 110;
    const x = VEC_X + d * (VEC_BAR_W + VEC_BAR_GAP);
    const bar = createRef<Rect>();
    vecBars.push(bar);
    view.add(
      <Rect ref={bar}
        x={x} y={20 - h / 2} width={VEC_BAR_W} height={h}
        fill={colors.sae} radius={3} opacity={0}
      />,
    );
  }

  const vecLbl = createRef<Txt>();
  view.add(
    <Txt ref={vecLbl}
      x={(VEC_X + (VEC_X + VEC_DIMS * (VEC_BAR_W + VEC_BAR_GAP))) / 2 - VEC_BAR_GAP/2}
      y={120}
      fontSize={14} fontFamily={fonts.mono} fill={colors.textMuted} opacity={0}
      text={'vᵢ ∈ ℝᵈ — captures HOW the model arrived at "Thu"'}
    />,
  );

  yield* all(sampleBox().opacity(1, 0.4), sampleTxt().opacity(1, 0.4));
  yield* slide('cluster:vector-1', `
    Take one sample: context + actual next token. Here: weekday-sequence prediction.
  `, 'Menan');

  yield* all(
    arrow1().opacity(1, 0.3),
    formula().opacity(1, 0.3),
  );
  yield* sequence(0.04, ...vecBars.map(b => b().opacity(1, 0.25)));
  yield* vecLbl().opacity(1, 0.3);

  yield* slide('cluster:vector-2', `
    For this sample, compute the gradient of log P(y|x) w.r.t. model parameters (or activations). That gradient = a high-dimensional vector vᵢ.
    Why this works: two samples that use the SAME internal mechanism have SIMILAR gradients (the same parts of the model contributed). Different mechanisms → different gradients.
    Same idea as Michaud et al. 2023's "quanta" of capability.
  `, 'Menan', true);

  yield* all(
    sampleBox().opacity(0, 0.3), sampleTxt().opacity(0, 0.3),
    arrow1().opacity(0, 0.3), formula().opacity(0, 0.3),
    vecLbl().opacity(0, 0.3),
    ...vecBars.map(b => b().opacity(0, 0.3)),
  );

  // =========================================================
  // === Slide 4: cluster scatter ===
  // =========================================================
  yield* layout.title().opacity(0, 0.3);
  layout.title().text('Cluster the behavior vectors');
  yield* layout.title().opacity(1, 0.3);

  const CLUSTERS = [
    { cx: -460, cy: -120, color: colors.active, n: 22, label: '"to [verb]"' },
    { cx: -180, cy: 80,   color: colors.sae,    n: 24, label: 'succession' },
    { cx: 100,  cy: -140, color: '#a78bfa',     n: 20, label: 'date completion' },
    { cx: 360,  cy: 60,   color: '#34d399',     n: 22, label: 'name patterns' },
    { cx: -400, cy: 220,  color: '#f472b6',     n: 18, label: 'code keywords' },
  ];
  const clusterDots: ReturnType<typeof createRef<Circle>>[] = [];
  let id = 0;
  for (const c of CLUSTERS) {
    for (let i = 0; i < c.n; i++) {
      const r = createRef<Circle>();
      clusterDots.push(r);
      const ox = (rand(id * 7 + 1) - 0.5) * 110;
      const oy = (rand(id * 13 + 3) - 0.5) * 75;
      view.add(
        <Circle ref={r} x={c.cx + ox} y={c.cy + oy} size={11} fill={c.color} opacity={0} />,
      );
      id++;
    }
  }
  // Cluster labels
  const clusterLbls = CLUSTERS.map(() => createRef<Txt>());
  CLUSTERS.forEach((c, k) => {
    view.add(
      <Txt ref={clusterLbls[k]}
        x={c.cx} y={c.cy - 80}
        fontSize={16} fontFamily={fonts.mono} fill={c.color} opacity={0}
        text={c.label}
      />,
    );
  });

  yield* sequence(0.005, ...clusterDots.map(d => d().opacity(0.85, 0.18)));
  yield* sequence(0.18, ...clusterLbls.map(l => l().opacity(1, 0.3)));

  yield* slide('cluster:scatter', `
    Project the vectors to 2D (UMAP). Apply clustering (HDBSCAN). Get many small clusters.
    Each cluster ≈ a coherent behavior. Names come AFTER inspection — humans look at samples in each cluster, recognize the mechanism.
    Authors get THOUSANDS of clusters from a Pile subset.
  `, 'Menan', true);

  // Fade scatter, keep two clusters for next slides
  yield* all(
    ...clusterDots.map(d => d().opacity(0.1, 0.3)),
    ...clusterLbls.map(l => l().opacity(0.15, 0.3)),
  );

  // =========================================================
  // === Slide 5: succession example ===
  // =========================================================
  yield* layout.title().opacity(0, 0.3);
  layout.title().text('Cluster: succession (predict next item in a sequence)');
  yield* layout.title().opacity(1, 0.3);

  const succSamples = [
    { ctx: '"1, 2, 3, "',                 next: '"4"' },
    { ctx: '"Mon Tue Wed "',              next: '"Thu"' },
    { ctx: '"January February March "',   next: '"April"' },
    { ctx: '"chapter 7. chapter 8. chapter "', next: '"9"' },
  ];
  const succRows: ReturnType<typeof createRef<Layout>>[] = [];
  for (let s = 0; s < succSamples.length; s++) {
    const row = createRef<Layout>();
    succRows.push(row);
    view.add(
      <Layout ref={row} x={-440} y={-200 + s * 50} layout direction={'row'} gap={12} alignItems={'center'} opacity={0}>
        <Txt fontSize={20} fontFamily={fonts.mono} fill={colors.text} text={succSamples[s].ctx} />
        <Txt fontSize={20} fontFamily={fonts.mono} fill={colors.textMuted} text={'→'} />
        <Txt fontSize={20} fontFamily={fonts.mono} fill={colors.sae} text={succSamples[s].next} />
      </Layout>,
    );
  }
  yield* sequence(0.15, ...succRows.map(r => r().opacity(1, 0.3)));

  yield* slide('cluster:succession-samples', `
    Inside the "succession" cluster, samples look like this. All predict the next item in some ordered sequence.
    Different surface forms (numbers, weekdays, months, chapters), same underlying mechanism.
  `, 'Menan');

  // ATP arrow + discovered features
  const atpArrow = createRef<Line>();
  view.add(
    <Line ref={atpArrow}
      points={[[100, 0], [240, 0]]}
      stroke={colors.sae} lineWidth={2} endArrow arrowSize={10} opacity={0}
    />,
  );
  const atpLbl = createRef<Txt>();
  view.add(
    <Txt ref={atpLbl}
      x={170} y={-25}
      fontSize={14} fontFamily={fonts.mono} fill={colors.sae} opacity={0}
      text={'ATP'}
    />,
  );

  // Discovered feature cards (right side)
  const succFeatures = [
    { name: 'general "successor" feature',  desc: 'fires on any A in a sequence A, B, C…\npromotes the next element',
      color: colors.active },
    { name: 'narrow "induction" features',  desc: 'patterns like "X3 … X4" in context\nrediscovers Olsson 2022 induction heads',
      color: colors.sae },
  ];
  const succCards: ReturnType<typeof createRef<Rect>>[] = [];
  const succNames: ReturnType<typeof createRef<Txt>>[] = [];
  const succDescs: ReturnType<typeof createRef<Txt>>[] = [];
  for (let f = 0; f < succFeatures.length; f++) {
    const card = createRef<Rect>();
    const nm = createRef<Txt>();
    const dc = createRef<Txt>();
    succCards.push(card); succNames.push(nm); succDescs.push(dc);
    const y = -90 + f * 130;
    view.add(
      <>
        <Rect ref={card}
          x={420} y={y} width={460} height={110}
          fill={'#0b1220'} stroke={succFeatures[f].color} lineWidth={2} radius={10} opacity={0}
        />
        <Txt ref={nm}
          x={420} y={y - 28}
          fontSize={20} fontFamily={fonts.sans} fill={succFeatures[f].color} opacity={0}
          text={succFeatures[f].name}
        />
        <Txt ref={dc}
          x={420} y={y + 16} width={420}
          fontSize={14} fontFamily={fonts.mono} fill={colors.textMuted} opacity={0}
          textAlign={'center'}
          text={succFeatures[f].desc}
        />
      </>,
    );
  }

  yield* all(atpArrow().opacity(1, 0.3), atpLbl().opacity(1, 0.3));
  for (let f = 0; f < succFeatures.length; f++) {
    yield* all(
      succCards[f]().opacity(1, 0.3),
      succNames[f]().opacity(1, 0.3),
      succDescs[f]().opacity(1, 0.3),
    );
  }

  yield* slide('cluster:succession-circuit', `
    Run zero-ablation ATP on this cluster's samples. Get a small circuit.
    Two kinds of features dominate:
    1. A general "successor" feature — fires anywhere it sees an ordered sequence, promotes the next element.
    2. Narrow "induction" features — recognize patterns like "X₃ … X₄".
    The induction features = same mechanism as the famous induction heads from Olsson et al. 2022. Auto-rediscovered, with no human labels and no curated dataset.
  `, 'Menan');

  // Fade succession example
  yield* all(
    ...succRows.map(r => r().opacity(0, 0.3)),
    atpArrow().opacity(0, 0.3),
    atpLbl().opacity(0, 0.3),
    ...succCards.map(c => c().opacity(0, 0.3)),
    ...succNames.map(n => n().opacity(0, 0.3)),
    ...succDescs.map(d => d().opacity(0, 0.3)),
  );

  // =========================================================
  // === Slide 6: "to [verb]" example ===
  // =========================================================
  yield* layout.title().opacity(0, 0.3);
  layout.title().text('Cluster: "to [verb]" — predict the infinitive marker');
  yield* layout.title().opacity(1, 0.3);

  const toSamples = [
    { ctx: '"X requires Y "',  next: '"to"', mech: 'A' },
    { ctx: '"X allows Y "',    next: '"to"', mech: 'A' },
    { ctx: '"X tries "',       next: '"to"', mech: 'B' },
    { ctx: '"X attempts "',    next: '"to"', mech: 'B' },
  ];
  const toRows: ReturnType<typeof createRef<Layout>>[] = [];
  for (let s = 0; s < toSamples.length; s++) {
    const row = createRef<Layout>();
    toRows.push(row);
    const mechColor = toSamples[s].mech === 'A' ? colors.active : colors.sae;
    view.add(
      <Layout ref={row} x={-440} y={-200 + s * 50} layout direction={'row'} gap={12} alignItems={'center'} opacity={0}>
        <Txt fontSize={20} fontFamily={fonts.mono} fill={colors.text} text={toSamples[s].ctx} />
        <Txt fontSize={20} fontFamily={fonts.mono} fill={colors.textMuted} text={'→'} />
        <Txt fontSize={20} fontFamily={fonts.mono} fill={mechColor} text={toSamples[s].next} />
      </Layout>,
    );
  }
  yield* sequence(0.15, ...toRows.map(r => r().opacity(1, 0.3)));

  // ATP + two mechanism cards
  const toAtpArrow = createRef<Line>();
  const toAtpLbl = createRef<Txt>();
  view.add(
    <>
      <Line ref={toAtpArrow}
        points={[[100, 0], [240, 0]]}
        stroke={colors.sae} lineWidth={2} endArrow arrowSize={10} opacity={0}
      />
      <Txt ref={toAtpLbl}
        x={170} y={-25}
        fontSize={14} fontFamily={fonts.mono} fill={colors.sae} opacity={0}
        text={'ATP'}
      />
    </>,
  );

  const toFeatures = [
    { name: 'mechanism A — permission/obligation verbs', desc: '"requires", "allows", "permits"\n→ infinitive object expected',
      color: colors.active },
    { name: 'mechanism B — intent verbs',  desc: '"tries", "attempts", "wants"\n→ infinitive complement expected',
      color: colors.sae },
  ];
  const toCards: ReturnType<typeof createRef<Rect>>[] = [];
  const toNames: ReturnType<typeof createRef<Txt>>[] = [];
  const toDescs: ReturnType<typeof createRef<Txt>>[] = [];
  for (let f = 0; f < toFeatures.length; f++) {
    const card = createRef<Rect>();
    const nm = createRef<Txt>();
    const dc = createRef<Txt>();
    toCards.push(card); toNames.push(nm); toDescs.push(dc);
    const y = -90 + f * 130;
    view.add(
      <>
        <Rect ref={card}
          x={420} y={y} width={460} height={110}
          fill={'#0b1220'} stroke={toFeatures[f].color} lineWidth={2} radius={10} opacity={0}
        />
        <Txt ref={nm}
          x={420} y={y - 28}
          fontSize={20} fontFamily={fonts.sans} fill={toFeatures[f].color} opacity={0}
          text={toFeatures[f].name}
        />
        <Txt ref={dc}
          x={420} y={y + 16} width={420}
          fontSize={14} fontFamily={fonts.mono} fill={colors.textMuted} opacity={0}
          textAlign={'center'}
          text={toFeatures[f].desc}
        />
      </>,
    );
  }

  yield* all(toAtpArrow().opacity(1, 0.3), toAtpLbl().opacity(1, 0.3));
  for (let f = 0; f < toFeatures.length; f++) {
    yield* all(
      toCards[f]().opacity(1, 0.3),
      toNames[f]().opacity(1, 0.3),
      toDescs[f]().opacity(1, 0.3),
    );
  }

  yield* slide('cluster:to-circuit', `
    Same idea, different cluster. All samples predict "to" — the infinitive marker.
    But ATP shows the cluster contains TWO sub-mechanisms:
    A. permission verbs ("requires Y to", "allows Y to") — "to" expected because the verb takes an infinitive object.
    B. intent verbs ("tries to", "attempts to") — "to" expected because the verb takes an infinitive complement.
    Same surface output, different reasons. Circuit-level analysis exposes the split.
  `, 'Menan', true);

  // Fade
  yield* all(
    ...toRows.map(r => r().opacity(0, 0.3)),
    toAtpArrow().opacity(0, 0.3),
    toAtpLbl().opacity(0, 0.3),
    ...toCards.map(c => c().opacity(0, 0.3)),
    ...toNames.map(n => n().opacity(0, 0.3)),
    ...toDescs.map(d => d().opacity(0, 0.3)),
  );

  // =========================================================
  // === Slide 7: scale + closing ===
  // =========================================================
  yield* layout.title().opacity(0, 0.3);
  layout.title().text('Scale: thousands of behaviors, no human labels');
  yield* layout.title().opacity(1, 0.3);

  const bigCounter = makeCounter(0, 0, '', {
    x: 0, y: -50, fontSize: 200, fontFamily: fonts.mono, fill: colors.sae, opacity: 0,
  });
  const bigLbl = createRef<Txt>();
  const linkTxt = createRef<Txt>();
  view.add(
    <>
      {bigCounter.node}
      <Txt ref={bigLbl}
        x={0} y={100}
        fontSize={28} fontFamily={fonts.sans} fill={colors.text} opacity={0}
        text={'auto-discovered feature circuits'}
      />
      <Txt ref={linkTxt}
        x={0} y={160}
        fontSize={20} fontFamily={fonts.mono} fill={colors.textMuted} opacity={0}
        text={'browse them at  feature-circuits.xyz'}
      />
    </>,
  );

  yield* all(bigCounter.handle.ref().opacity(1, 0.3), bigLbl().opacity(1, 0.3));
  yield* bigCounter.handle.countTo(2000, 1.6);
  yield* linkTxt().opacity(1, 0.4);

  yield* slide('cluster:scale', `
    From a Pile subset: ~thousands of clusters, ~thousands of feature circuits. All from raw text — no human-curated tasks anywhere.
    The whole interpretability story comes full circle:
    SAE → polysemantic neurons become features. ATP → causal circuit per behavior. Clustering → discover the behaviors themselves at scale.
    The paper's own preview is at feature-circuits.xyz — clusters and their circuits, browsable.
  `, 'Menan');

  yield* waitFor(0.2);
});

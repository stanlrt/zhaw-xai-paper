import { Circle, Layout, Line, makeScene2D, Rect, Txt } from '@motion-canvas/2d';
import { all, chain, createRef, waitFor } from '@motion-canvas/core';
import { addBackground } from '../lib/bg';
import { buildNetwork, slideEdgeHighlight } from '../lib/network';
import { slide } from '../lib/slide';
import { setupSlide } from '../lib/slide-layout';
import { colors, fonts, sizes } from '../lib/theme';

interface SparseFeature {
  idx: number;
  name: string;
}

interface LMTrial {
  sentence: string[];
  inputPattern: number[];
  hidden1Pattern: number[];
  hidden2Pattern: number[];
  predictedTokenIdx: number;
  features: SparseFeature[]; // SAE phase: 2-3 sparse features fire per prompt
}

const VOCAB = ['mat', 'door', 'coffee'];

// Polysemy: core neurons {1,2} in hidden1 fire for all 3 unrelated prompts → polysemantic.
// Each prompt also activates distinct neurons → prompt-specific signal.
// SAE phase: sparsity = MOST slots zero, not all-but-one. 2-3 lit per prompt is realistic.
const TRIALS: LMTrial[] = [
  {
    sentence: ['the', 'cat', 'sat', 'on', 'the'],
    inputPattern: [0, 2], hidden1Pattern: [1, 2, 4], hidden2Pattern: [0, 2, 3],
    predictedTokenIdx: 0,
    features: [
      { idx: 1, name: 'feline-animal token' },
      { idx: 4, name: "preposition 'on'" },
      { idx: 8, name: 'determiner before noun' },
    ],
  },
  {
    sentence: ['she', 'opened', 'the'],
    inputPattern: [1, 2], hidden1Pattern: [1, 2, 3], hidden2Pattern: [0, 2, 4],
    predictedTokenIdx: 1,
    features: [
      { idx: 2, name: 'verb of opening (past tense)' },
      { idx: 6, name: '3rd-person sing. pronoun' },
      { idx: 8, name: 'determiner before noun' },
    ],
  },
  {
    sentence: ['I', 'drank', 'a', 'cup', 'of'],
    inputPattern: [0, 1], hidden1Pattern: [0, 1, 2, 4], hidden2Pattern: [1, 2, 3],
    predictedTokenIdx: 2,
    features: [
      { idx: 3, name: 'container noun (cup, bowl)' },
      { idx: 7, name: "partitive 'of'" },
      { idx: 10, name: 'past-tense verb of consumption' },
    ],
  },
];

const SPARSE_DIMS = 12;
const SPARSE_R = 16;
const SPARSE_GAP = 50;

export default makeScene2D(function* (view) {
  addBackground(view);

  const layout = setupSlide(view, { title: "Inside an LLM's MLP block" });

  const NET_X = 0;
  const NET_Y = 0;
  const LAYER_GAP = 240;
  const NEURON_GAP = 140;

  // Network spans from NET_X - 1.5*LAYER_GAP to NET_X + 1.5*LAYER_GAP (4 layers)
  const inputX = NET_X - 1.5 * LAYER_GAP; // = -260
  const outputX = NET_X + 1.5 * LAYER_GAP; // = 460

  // Sentence row: right-anchored so it grows LEFTWARD as tokens added,
  // never overlapping the input layer.
  const SENTENCE_RIGHT = inputX - 100;
  const sentenceRow = createRef<Layout>();
  const promptLabel = createRef<Txt>();
  view.add(
    <>
      <Txt
        ref={promptLabel}
        x={SENTENCE_RIGHT}
        y={NET_Y - 60}
        offsetX={1}
        fontSize={22}
        fontFamily={fonts.mono}
        fill={colors.textMuted}
        text={'prompt:'}
        opacity={0}
      />
      <Layout
        ref={sentenceRow}
        layout
        direction={'row'}
        gap={12}
        alignItems={'center'}
        x={SENTENCE_RIGHT}
        y={NET_Y}
        offsetX={1}
      />
    </>,
  );

  const net = buildNetwork(view, {
    layers: [3, 5, 5, 3],
    layerGap: LAYER_GAP,
    neuronGap: NEURON_GAP,
    origin: { x: NET_X, y: NET_Y },
  });

  // Vocab boxes right of output layer, vertically aligned to output neurons
  const VOCAB_BOX_W = 170;
  const VOCAB_BOX_LEFT = outputX + 110;
  const VOCAB_BOX_CENTER_X = VOCAB_BOX_LEFT + VOCAB_BOX_W / 2;

  const vocabLabels = VOCAB.map(() => createRef<Txt>());
  const vocabBoxes = VOCAB.map(() => createRef<Rect>());
  VOCAB.forEach((tok, k) => {
    const yPos = NET_Y + (k - (VOCAB.length - 1) / 2) * NEURON_GAP;
    view.add(
      <>
        <Rect
          ref={vocabBoxes[k]}
          x={VOCAB_BOX_LEFT}
          y={yPos}
          width={VOCAB_BOX_W}
          height={56}
          offsetX={-1}
          fill={'#1f2937'}
          stroke={colors.edge}
          lineWidth={2}
          radius={10}
          opacity={0}
        />
        <Txt
          ref={vocabLabels[k]}
          x={VOCAB_BOX_CENTER_X}
          y={yPos}
          fontSize={sizes.bodySize}
          fontFamily={fonts.mono}
          fill={colors.textMuted}
          text={`"${tok}"`}
          opacity={0}
        />
      </>,
    );
  });

  // "next-token logits:" hint, centered horizontally over vocab boxes, above top box
  const arrowLabel = createRef<Txt>();
  const topVocabY = NET_Y - ((VOCAB.length - 1) / 2) * NEURON_GAP;
  view.add(
    <Txt
      ref={arrowLabel}
      x={VOCAB_BOX_CENTER_X}
      y={topVocabY - 80}
      fontSize={22}
      fontFamily={fonts.mono}
      fill={colors.textMuted}
      text={'next-token logits:'}
      opacity={0}
    />,
  );

  yield* layout.showTitle();
  yield* net.intro();
  yield* all(
    promptLabel().opacity(1, 0.4),
    arrowLabel().opacity(1, 0.4),
    ...vocabBoxes.map(b => b().opacity(1, 0.4)),
    ...vocabLabels.map(l => l().opacity(1, 0.4)),
  );
  yield* slide('poly:network', `
    We look at very simple MLP block of an LLM. Predicts 3 possible next tokens based on given prompt.
    [play 3 anims]
  `, 'Stanislas', true);

  for (let i = 0; i < TRIALS.length; i++) {
    const t = TRIALS[i];

    // Render sentence tokens
    sentenceRow().removeChildren();
    for (const tok of t.sentence) {
      sentenceRow().add(
        <Txt
          text={tok}
          fontSize={sizes.bodySize + 4}
          fontFamily={fonts.mono}
          fill={colors.active}
          opacity={0}
        />,
      );
    }
    yield* all(...sentenceRow().children().map(c => (c as Txt).opacity(1, 0.25)));

    yield* net.fireTransition(0, t.inputPattern, t.hidden1Pattern, 0.28);
    yield* net.fireTransition(1, t.hidden1Pattern, t.hidden2Pattern, 0.28);
    yield* all(
      net.fireTransition(2, t.hidden2Pattern, [t.predictedTokenIdx], 0.28),
      chain(
        vocabLabels[t.predictedTokenIdx]().fill(colors.active, 0.15),
        vocabLabels[t.predictedTokenIdx]().fill(colors.textMuted, 0.3),
      ),
      chain(
        vocabBoxes[t.predictedTokenIdx]().stroke(colors.active, 0.15),
        vocabBoxes[t.predictedTokenIdx]().stroke(colors.edge, 0.3),
      ),
    );

    yield* waitFor(0.3);

    yield* all(...sentenceRow().children().map(c => (c as Txt).opacity(0, 0.2)));
  }

  yield* slide('poly:trials-done', `
     Do you observe anything interesting?
  Polysemantic: same neurons encapsulate different meanings. In real LLM: can be thousands.
  So how can you interpret each neuron?
  `, 'Stanislas');

  // No prompts in next phases until pool whip-through
  yield* promptLabel().opacity(0, 0.3);

  // ============================================================
  // PART 2: attach SAE to layer 1 — same network, no scene reset
  // ============================================================

  // Morph title: "Inside an LLM's MLP block" → "Sparse Autoencoder" (orange)
  yield* layout.title().opacity(0, 0.35);
  layout.title().text('Sparse Autoencoder');
  layout.title().fill(colors.sae);
  yield* layout.title().opacity(1, 0.35);

  yield* slide('sae:pivot', `
   We introduce the idea of a Sparse Autoencoder after the layer we want to make explainable.
  `, 'Stanislas');

  // Erase right side: hidden2, output, lines from h1 onward, vocab boxes
  const hidden2 = net.neurons[2];
  const outputLayer = net.neurons[3];
  const linesH1H2 = net.linesPerLayer[1];
  const linesH2Out = net.linesPerLayer[2];

  yield* all(
    ...hidden2.map(n => n.opacity(0, 0.5)),
    ...outputLayer.map(n => n.opacity(0, 0.5)),
    ...linesH1H2.map(l => l.opacity(0, 0.5)),
    ...linesH2Out.map(l => l.opacity(0, 0.5)),
    ...vocabBoxes.map(b => b().opacity(0, 0.5)),
    ...vocabLabels.map(l => l().opacity(0, 0.5)),
    arrowLabel().opacity(0, 0.5),
  );

  yield* slide('sae:erase');

  // ---- Build SAE: sparse column where output layer was ----
  const SPARSE_X = outputX;
  const SPARSE_TOP_Y = NET_Y - ((SPARSE_DIMS - 1) * SPARSE_GAP) / 2;
  const hidden1X = NET_X - 0.5 * LAYER_GAP; // -120

  const sparseCircles: ReturnType<typeof createRef<Circle>>[] = [];
  for (let i = 0; i < SPARSE_DIMS; i++) {
    const r = createRef<Circle>();
    sparseCircles.push(r);
    view.add(
      <Circle
        ref={r}
        x={SPARSE_X}
        y={SPARSE_TOP_Y + i * SPARSE_GAP}
        size={SPARSE_R * 2}
        fill={colors.neuronFill}
        stroke={colors.sae}
        lineWidth={2}
        opacity={0}
        zIndex={2}
      />,
    );
  }

  // Encode lines: hidden1 neurons → sparse column
  const encodeLines: ReturnType<typeof createRef<Line>>[] = [];
  const hidden1 = net.neurons[1];
  for (let a = 0; a < hidden1.length; a++) {
    for (let b = 0; b < SPARSE_DIMS; b++) {
      const lr = createRef<Line>();
      encodeLines.push(lr);
      view.add(
        <Line
          ref={lr}
          points={[
            [hidden1X, NET_Y + (a - (hidden1.length - 1) / 2) * NEURON_GAP],
            [SPARSE_X, SPARSE_TOP_Y + b * SPARSE_GAP],
          ]}
          stroke={colors.edge}
          lineWidth={1.5}
          end={0}
          opacity={0.4}
          zIndex={1}
        />,
      );
    }
  }

  const saeLabel = createRef<Txt>();
  const sparseSubLabel = createRef<Txt>();
  const vecLabel = createRef<Txt>();
  const featureCol = createRef<Layout>();

  view.add(
    <>
      <Txt
        ref={saeLabel}
        x={SPARSE_X}
        y={SPARSE_TOP_Y + (SPARSE_DIMS - 1) * SPARSE_GAP + 110}
        fontSize={28}
        fontFamily={fonts.sans}
        fill={colors.sae}
        text={'SAE'}
        opacity={0}
      />
      <Txt
        ref={sparseSubLabel}
        x={SPARSE_X}
        y={SPARSE_TOP_Y + (SPARSE_DIMS - 1) * SPARSE_GAP + 150}
        fontSize={16}
        fontFamily={fonts.mono}
        fill={colors.textMuted}
        text={'sparse features'}
        opacity={0}
      />
      {/* <Txt
        ref={vecLabel}
        x={hidden1X}
        y={NET_Y + 2 * NEURON_GAP + 110}
        fontSize={18}
        fontFamily={fonts.mono}
        fill={colors.textMuted}
        text={'hidden vec'}
        opacity={0}
      /> */}
      <Layout
        ref={featureCol}
        x={0}
        y={0}
      />
    </>,
  );

  yield* all(
    saeLabel().opacity(1, 0.4),
    sparseSubLabel().opacity(1, 0.4),
    // vecLabel().opacity(1, 0.4),
    ...sparseCircles.map(c => c().opacity(1, 0.4)),
    ...encodeLines.map(l => l().end(1, 0.5)),
  );

  // ---- Place "???" labels next to every SAE circle ----
  featureCol().removeChildren();
  const labelRefs: ReturnType<typeof createRef<Txt>>[] = [];
  for (let k = 0; k < SPARSE_DIMS; k++) {
    const r = createRef<Txt>();
    labelRefs.push(r);
    const yPos = SPARSE_TOP_Y + k * SPARSE_GAP;
    featureCol().add(
      <Txt
        ref={r}
        text={'???'}
        x={SPARSE_X + 40}
        y={yPos}
        offsetX={-1}
        fontSize={20}
        fontFamily={fonts.mono}
        fill={colors.textMuted}
        opacity={0}
      />,
    );
  }
  yield* all(...labelRefs.map(r => r().opacity(1, 0.4)));

  yield* slide('sae:attach', `
      It has a single hidden layer, but many more neurons — each carries far less meaning.
      Sparsity constraint: only a few fire per input.
      But what does each one mean? Initially: unknown — "???".
      We need to look at thousands of inputs and see what makes each one fire.
  `, 'Stanislas');

  // ---- Phase A: many prompts whip through ----
  yield* promptLabel().opacity(1, 0.3);
  interface Probe { sentence: string[]; input: number[]; h1: number[]; features: number[] }
  const POOL: Probe[] = [
    { sentence: ['the', 'cat', 'sat', 'on', 'the'], input: [0, 2], h1: [1, 2, 4], features: [1, 8] },
    { sentence: ['she', 'opened', 'the'], input: [1, 2], h1: [1, 2, 3], features: [2, 8] },
    { sentence: ['I', 'drank', 'a', 'cup', 'of'], input: [0, 1], h1: [0, 1, 2, 4], features: [3, 7, 10] },
    { sentence: ['a', 'tiger', 'roams'], input: [0, 2], h1: [0, 2], features: [1, 5] },
    { sentence: ['he', 'unlocked', 'the'], input: [1, 2], h1: [1, 2, 3], features: [2, 8] },
    { sentence: ['my', 'lion', 'awakens'], input: [0, 1], h1: [0, 1, 2], features: [1, 9] },
    { sentence: ['fill', 'the', 'glass'], input: [1, 2], h1: [2, 4], features: [3, 8] },
    { sentence: ['Kate', 'opened', 'a'], input: [0, 2], h1: [0, 2, 3], features: [2, 8] },
    { sentence: ['leopard', 'in', 'the'], input: [0, 1], h1: [0, 1, 4], features: [1, 8] },
    { sentence: ['pour', 'into', 'the', 'mug'], input: [0, 2], h1: [0, 2, 4], features: [3, 7] },
    { sentence: ['she', 'closed', 'the'], input: [1, 2], h1: [1, 2, 3], features: [2, 8, 11] },
    { sentence: ['kitten', 'next', 'to'], input: [1, 2], h1: [1, 3], features: [1, 7] },
    { sentence: ['empty', 'the', 'bowl'], input: [0, 1], h1: [2, 4], features: [3, 8] },
    { sentence: ['a', 'jaguar', 'leaps'], input: [0, 1], h1: [0, 1], features: [1, 5] },
    { sentence: ['fill', 'a', 'jug'], input: [1, 2], h1: [2, 4], features: [3, 0] },
  ];

  for (let i = 0; i < POOL.length; i++) {
    const p = POOL[i];

    sentenceRow().removeChildren();
    for (const tok of p.sentence) {
      sentenceRow().add(
        <Txt
          text={tok}
          fontSize={sizes.bodySize + 4}
          fontFamily={fonts.mono}
          fill={colors.active}
          opacity={0}
        />,
      );
    }
    yield* all(...sentenceRow().children().map(c => (c as Txt).opacity(1, 0.1)));

    yield* net.fireTransition(0, p.input, p.h1, 0.18);

    // hidden1 → SAE: highlight active encode edges
    yield* all(
      ...p.h1.flatMap(a =>
        p.features.map(f =>
          slideEdgeHighlight(view, encodeLines[a * SPARSE_DIMS + f](), colors.sae, 0.22),
        ),
      ),
    );

    yield* all(
      ...p.features.map(f =>
        all(
          sparseCircles[f]().fill(colors.sae, 0.12),
          sparseCircles[f]().lineWidth(4, 0.12),
        ),
      ),
    );
    yield* waitFor(0.08);
    yield* all(
      ...p.features.map(f =>
        all(
          sparseCircles[f]().fill(colors.neuronFill, 0.18),
          sparseCircles[f]().lineWidth(2, 0.18),
        ),
      ),
      ...sentenceRow().children().map(c => (c as Txt).opacity(0, 0.12)),
    );
  }

  // No more prompts → hide prompt: label
  yield* promptLabel().opacity(0, 0.3);

  yield* slide('sae:harvested', `
    After thousands of prompts: we have, for each SAE neuron, a list of inputs that made it fire.
    Now humans or LLMs inspect those top activations and write a label.
  `, 'Stanislas');

  // ---- Phase B: reveal labels for a few features ----
  const REVEALS: { idx: number; label: string; topPrompts: { pi: number; w: number }[] }[] = [
    { idx: 1, label: 'feline-animal token', topPrompts: [
      { pi: 0, w: 1 }, { pi: 3, w: 1 }, { pi: 5, w: 1 }, { pi: 13, w: 1 },
    ] },
    { idx: 2, label: 'verb of opening (past tense)', topPrompts: [
      { pi: 1, w: 1 }, { pi: 4, w: 1 }, { pi: 7, w: 1 },
    ] },
    { idx: 3, label: 'container noun', topPrompts: [
      { pi: 2, w: 3 }, { pi: 6, w: 2 }, { pi: 12, w: 2 },
    ] },
    { idx: 8, label: 'determiner before noun', topPrompts: [
      { pi: 0, w: 0 }, { pi: 6, w: 1 }, { pi: 8, w: 2 }, { pi: 12, w: 1 },
    ] },
  ];

  // Evidence panel (left of SAE column, where sentence row used to be)
  const evidenceCol = createRef<Layout>();
  view.add(
    <Layout
      ref={evidenceCol}
      layout
      direction={'column'}
      gap={6}
      alignItems={'end'}
      x={SENTENCE_RIGHT}
      y={NET_Y}
      offsetX={1}
      offsetY={0}
    />,
  );

  const revealed = new Set<number>();
  for (const rev of REVEALS) {
    // Highlight target circle (magenta), revert prior reveals to yellow, dim others
    yield* all(
      ...sparseCircles.map((c, k) => {
        if (k === rev.idx) {
          return all(c().fill(colors.magenta, 0.3), c().lineWidth(5, 0.3), c().opacity(1, 0.3));
        }
        if (revealed.has(k)) {
          return all(c().fill(colors.neuronFill, 0.3), c().lineWidth(2, 0.3), c().opacity(1, 0.3));
        }
        return all(c().fill(colors.neuronFill, 0.3), c().lineWidth(2, 0.3), c().opacity(0.25, 0.3));
      }),
      ...labelRefs.map((r, k) => {
        if (k === rev.idx) return r().opacity(1, 0.3);
        if (revealed.has(k)) return all(r().opacity(1, 0.3), r().fill(colors.sae, 0.3));
        return r().opacity(0.2, 0.3);
      }),
    );

    // Build evidence list: top prompts that activated this feature
    evidenceCol().removeChildren();
    const headerRef = createRef<Txt>();
    evidenceCol().add(
      <Txt
        ref={headerRef}
        text={'top activations:'}
        fontSize={20}
        fontFamily={fonts.mono}
        fill={colors.textMuted}
        opacity={0}
      />,
    );
    const promptRefs: ReturnType<typeof createRef<Layout>>[] = [];
    for (const tp of rev.topPrompts) {
      const r = createRef<Layout>();
      promptRefs.push(r);
      const tokens = POOL[tp.pi].sentence;
      const children: any[] = [];
      children.push(
        <Txt text={'"'} fontSize={22} fontFamily={fonts.mono} fill={colors.active} />,
      );
      tokens.forEach((tok, ti) => {
        const isTarget = ti === tp.w;
        const txt = ti < tokens.length - 1 ? tok + ' ' : tok;
        children.push(
          <Txt
            text={txt}
            fontSize={22}
            fontFamily={fonts.mono}
            fill={isTarget ? colors.magenta : colors.active}
            fontWeight={isTarget ? 700 : 400}
          />,
        );
      });
      children.push(
        <Txt text={'"'} fontSize={22} fontFamily={fonts.mono} fill={colors.active} />,
      );
      evidenceCol().add(
        <Layout ref={r} layout direction={'row'} gap={0} opacity={0}>
          {children}
        </Layout>,
      );
    }
    yield* chain(
      headerRef().opacity(1, 0.2),
      ...promptRefs.map(r => r().opacity(1, 0.18)),
    );

    yield* waitFor(0.4);

    // Morph "???" → real label
    labelRefs[rev.idx]().text(rev.label);
    yield* labelRefs[rev.idx]().fill(colors.magenta, 0.4);

    yield* slide(`sae:reveal-${rev.idx}`, `
      Each feature fires on a specific set of examples → we read those and
      give it a human-readable label.
    `, 'Stanislas', true);

    revealed.add(rev.idx);

    // Clear evidence
    yield* all(
      headerRef().opacity(0, 0.25),
      ...promptRefs.map(r => r().opacity(0, 0.25)),
    );
  }

  // Restore all circles + remaining "???" labels
  yield* all(
    ...sparseCircles.map(c => all(
      c().opacity(1, 0.3),
      c().fill(colors.neuronFill, 0.3),
      c().lineWidth(2, 0.3),
    )),
    ...labelRefs.map(r => r().opacity(1, 0.3)),
  );

  yield* slide('sae:done', `
    Some features get clean labels. Many stay "???" — superposition leftovers, dead neurons, fuzzy concepts.
    But the labeled ones are now interpretable handles into the model.
  `, 'Stanislas');

  yield* waitFor(0.2);
});

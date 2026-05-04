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
  `, 'Stanislas');

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

    yield* net.fireTransition(0, t.inputPattern, t.hidden1Pattern);
    yield* net.fireTransition(1, t.hidden1Pattern, t.hidden2Pattern);
    yield* all(
      net.fireTransition(2, t.hidden2Pattern, [t.predictedTokenIdx]),
      chain(
        vocabLabels[t.predictedTokenIdx]().fill(colors.active, 0.2),
        vocabLabels[t.predictedTokenIdx]().fill(colors.textMuted, 0.4),
      ),
      chain(
        vocabBoxes[t.predictedTokenIdx]().stroke(colors.active, 0.2),
        vocabBoxes[t.predictedTokenIdx]().stroke(colors.edge, 0.4),
      ),
    );

    yield* slide(`poly:trial-${i}`, `
       Do you observe anything interesting?
    Polysemantic: same neurons encapsulate different meanings. In real LLM: can be thousands.
    So how can you interpret each neuron?
    `, 'Stanislas');

    yield* all(...sentenceRow().children().map(c => (c as Txt).opacity(0, 0.25)));
  }

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
      <Txt
        ref={vecLabel}
        x={hidden1X}
        y={NET_Y + 2 * NEURON_GAP + 110}
        fontSize={18}
        fontFamily={fonts.mono}
        fill={colors.textMuted}
        text={'hidden vec'}
        opacity={0}
      />
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
    vecLabel().opacity(1, 0.4),
    ...sparseCircles.map(c => c().opacity(1, 0.4)),
    ...encodeLines.map(l => l().end(1, 0.5)),
  );

  yield* slide('sae:attach', `
      It has a single hidden layer, but many more neurons. This means each neuron has to carry a lot less meaning, ideally a single one.
      
      We also enforce a sparsity constraint.
      This means that for any given input, only a few SAE neurons will be active.

      Suddenly, it becomes a lot easier to interpret.
  `, 'Stanislas');

  // ---- SAE trials: same prompts, now show sparse feature ----
  for (let i = 0; i < TRIALS.length; i++) {
    const t = TRIALS[i];

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

    // Forward through input → hidden1 (same as polysemy phase)
    yield* net.fireTransition(0, t.inputPattern, t.hidden1Pattern);

    // Encode: slide highlight on edges from each active hidden1 neuron to EACH lit sparse feature
    const edgeHighlights = [];
    for (const a of t.hidden1Pattern) {
      for (const f of t.features) {
        edgeHighlights.push(
          slideEdgeHighlight(view, encodeLines[a * SPARSE_DIMS + f.idx](), colors.sae, 0.55),
        );
      }
    }
    yield* all(...edgeHighlights);

    // Light all lit sparse features simultaneously
    yield* all(
      ...t.features.map(f =>
        all(
          sparseCircles[f.idx]().fill(colors.sae, 0.3),
          sparseCircles[f.idx]().lineWidth(4, 0.3),
        ),
      ),
    );

    // Feature names: each aligned vertically to its sparse circle
    featureCol().removeChildren();
    const featureTxtRefs = t.features.map(() => createRef<Txt>());
    t.features.forEach((f, k) => {
      const yPos = SPARSE_TOP_Y + f.idx * SPARSE_GAP;
      featureCol().add(
        <Txt
          ref={featureTxtRefs[k]}
          text={f.name}
          x={SPARSE_X + 40}
          y={yPos}
          offsetX={-1}
          fontSize={22}
          fontFamily={fonts.mono}
          fill={colors.sae}
          opacity={0}
        />,
      );
    });
    yield* chain(...featureTxtRefs.map(r => r().opacity(1, 0.18)));

    yield* slide(`sae:trial-${i}`, `
      "${t.sentence.join(' ')}" → polysemantic hidden vec → SAE encodes → ${t.features.length} sparse features fire.
      Sparsity = MOST slots stay zero. The few that fire are each cleanly named.
      ~15s.
    `, 'Stanislas');

    yield* all(
      ...sentenceRow().children().map(c => (c as Txt).opacity(0, 0.25)),
      ...featureTxtRefs.map(r => r().opacity(0, 0.25)),
      ...t.features.map(f =>
        all(
          sparseCircles[f.idx]().fill(colors.neuronFill, 0.3),
          sparseCircles[f.idx]().lineWidth(2, 0.3),
        ),
      ),
    );
  }

  yield* waitFor(0.2);
});

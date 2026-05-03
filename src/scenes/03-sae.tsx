import {makeScene2D, Txt, Layout, Circle, Line} from '@motion-canvas/2d';
import {createRef, all, chain, waitFor} from '@motion-canvas/core';
import {colors, fonts, sizes} from '../lib/theme';
import {slide} from '../lib/slide';
import {addBackground} from '../lib/bg';
import {setupSlide} from '../lib/slide-layout';
import {buildNetwork, slideEdgeHighlight} from '../lib/network';

interface Trial {
  prompt: string[];
  inputPattern: number[];
  hidden1Pattern: number[]; // SAME across trials → polysemy carryover from scene 02
  sparseIdx: number; // ONE sparse feature lights
  featureName: string;
}

// Same prompts as scene 02 for continuity
const TRIALS: Trial[] = [
  {
    prompt: ['the', 'cat', 'sat', 'on', 'the'],
    inputPattern: [0, 2],
    hidden1Pattern: [1, 2, 4],
    sparseIdx: 2,
    featureName: '"feline + on-surface"',
  },
  {
    prompt: ['she', 'opened', 'the'],
    inputPattern: [1, 2],
    hidden1Pattern: [1, 2, 4],
    sparseIdx: 6,
    featureName: '"door-opening event"',
  },
  {
    prompt: ['I', 'drank', 'a', 'cup', 'of'],
    inputPattern: [0, 1],
    hidden1Pattern: [1, 2, 4],
    sparseIdx: 9,
    featureName: '"beverage noun"',
  },
];

// Same coords as scene 02 → continuity
const NET_X = 0;
const NET_Y = 0;
const LAYER_GAP = 240;
const NEURON_GAP = 140;
const inputX = NET_X - 1.5 * LAYER_GAP;   // -360
const hidden1X = NET_X - 0.5 * LAYER_GAP; // -120
const hidden2X = NET_X + 0.5 * LAYER_GAP; //  120
const outputX = NET_X + 1.5 * LAYER_GAP;  //  460

// SAE sparse column placed to the right (where output layer used to be)
const SPARSE_X = outputX;
const SPARSE_DIMS = 12;
const SPARSE_R = 16;
const SPARSE_GAP = 50;

export default makeScene2D(function* (view) {
  addBackground(view);

  const layout = setupSlide(view, {title: 'Sparse Autoencoder', titleColor: colors.sae});

  // Prompt row, same anchor as scene 02
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

  // Same network as scene 02
  const net = buildNetwork(view, {
    layers: [3, 5, 5, 3],
    layerGap: LAYER_GAP,
    neuronGap: NEURON_GAP,
    origin: {x: NET_X, y: NET_Y},
  });

  // Show all in dimmed state initially (will fade in)
  yield* layout.showTitle();
  yield* net.intro();
  yield* promptLabel().opacity(1, 0.4);
  yield* slide('sae:carry', `
    Same network from before. We pick layer 1 (the first hidden layer) to study with an SAE.
    Everything to the RIGHT of layer 1 — we are about to throw it away for this view.
    ~12s.
  `, 'Stanislas');

  // ---- Erase right-side layers ----
  // Fade hidden2, output, lines from hidden1 onward
  const hidden2 = net.neurons[2];
  const output = net.neurons[3];
  const linesH1H2 = net.linesPerLayer[1];
  const linesH2Out = net.linesPerLayer[2];

  yield* all(
    ...hidden2.map(n => n.opacity(0, 0.5)),
    ...output.map(n => n.opacity(0, 0.5)),
    ...linesH1H2.map(l => l.opacity(0, 0.5)),
    ...linesH2Out.map(l => l.opacity(0, 0.5)),
  );
  yield* slide('sae:erase', `
    Right side gone. What's left: input → hidden layer 1.
    Layer 1's activations = "the hidden vector". 5 neurons, dense, polysemantic.
    Each neuron carries multiple unrelated concepts at once.
    ~12s.
  `, 'Stanislas');

  // ---- Build SAE: sparse column where output layer was ----
  const SPARSE_TOP_Y = NET_Y - ((SPARSE_DIMS - 1) * SPARSE_GAP) / 2;

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

  // Encode arrows: from each hidden1 neuron → each sparse neuron
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
          opacity={0.5}
        />,
      );
    }
  }

  // SAE label (above sparse column)
  const saeLabel = createRef<Txt>();
  const sparseSubLabel = createRef<Txt>();
  view.add(
    <>
      <Txt
        ref={saeLabel}
        x={SPARSE_X}
        y={SPARSE_TOP_Y - 50}
        fontSize={28}
        fontFamily={fonts.sans}
        fill={colors.sae}
        text={'SAE'}
        opacity={0}
      />
      <Txt
        ref={sparseSubLabel}
        x={SPARSE_X}
        y={SPARSE_TOP_Y - 22}
        fontSize={16}
        fontFamily={fonts.mono}
        fill={colors.textMuted}
        text={'sparse features'}
        opacity={0}
      />
    </>,
  );

  // hidden vec label (above hidden1 column)
  const vecLabel = createRef<Txt>();
  view.add(
    <Txt
      ref={vecLabel}
      x={hidden1X}
      y={NET_Y - 2.5 * NEURON_GAP - 20}
      fontSize={18}
      fontFamily={fonts.mono}
      fill={colors.textMuted}
      text={'hidden vec'}
      opacity={0}
    />,
  );

  // Feature name label (right of sparse column)
  const featureLabel = createRef<Txt>();
  view.add(
    <Txt
      ref={featureLabel}
      x={SPARSE_X + 60}
      y={NET_Y}
      offsetX={-1}
      fontSize={24}
      fontFamily={fonts.mono}
      fill={colors.sae}
      text={''}
      opacity={0}
    />,
  );

  // Reveal SAE
  yield* all(
    saeLabel().opacity(1, 0.4),
    sparseSubLabel().opacity(1, 0.4),
    vecLabel().opacity(1, 0.4),
    ...sparseCircles.map(c => c().opacity(1, 0.4)),
    ...encodeLines.map(l => l().end(1, 0.5)),
  );
  yield* slide('sae:attach', `
    SAE = small extra autoencoder trained on hidden-layer-1 activations.
    Encoder expands 5 dense numbers → 12 sparse slots (only ONE will fire per prompt).
    Each lit slot = one human-nameable feature.
    LLM forward pass is unchanged; SAE just READS the hidden vec.
    ~15s.
  `, 'Stanislas');

  // ============================================================
  // Trials
  // ============================================================
  for (let ti = 0; ti < TRIALS.length; ti++) {
    const t = TRIALS[ti];

    // Render prompt tokens
    sentenceRow().removeChildren();
    for (const tok of t.prompt) {
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

    // Forward through input → hidden1
    yield* net.fireTransition(0, t.inputPattern, t.hidden1Pattern);

    // Encode: slide edges from active hidden1 neurons → sparse target
    yield* all(
      ...t.hidden1Pattern.map(a =>
        slideEdgeHighlight(view, encodeLines[a * SPARSE_DIMS + t.sparseIdx](), colors.sae, 0.55),
      ),
    );

    // Light the sparse feature
    yield* all(
      sparseCircles[t.sparseIdx]().fill(colors.sae, 0.3),
      sparseCircles[t.sparseIdx]().lineWidth(4, 0.3),
    );

    featureLabel().text(t.featureName);
    yield* featureLabel().opacity(1, 0.3);

    yield* slide(`sae:trial-${ti}`, `
      Prompt "${t.prompt.join(' ')}" → hidden vec is dense + polysemantic (same neurons fire as last scene).
      SAE encodes → ONE sparse feature lights: ${t.featureName}.
      Different prompt → different feature, but same dense neurons.
      ~15s.
    `, 'Stanislas');

    // Reset
    yield* all(
      ...sentenceRow().children().map(c => (c as Txt).opacity(0, 0.25)),
      sparseCircles[t.sparseIdx]().fill(colors.neuronFill, 0.3),
      sparseCircles[t.sparseIdx]().lineWidth(2, 0.3),
      featureLabel().opacity(0, 0.25),
    );
  }

  yield* waitFor(0.2);
});

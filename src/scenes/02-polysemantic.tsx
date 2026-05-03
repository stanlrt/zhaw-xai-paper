import {makeScene2D, Txt, Layout, Rect} from '@motion-canvas/2d';
import {createRef, all, chain, waitFor} from '@motion-canvas/core';
import {colors, fonts, sizes} from '../lib/theme';
import {slide} from '../lib/slide';
import {addBackground} from '../lib/bg';
import {buildNetwork} from '../lib/network';
import {setupSlide} from '../lib/slide-layout';

interface LMTrial {
  sentence: string[];   // partial sentence tokens
  inputPattern: number[];
  hidden1Pattern: number[];
  hidden2Pattern: number[];
  predictedTokenIdx: number; // which output neuron lights up (= which vocab token)
}

const VOCAB = ['mat', 'door', 'coffee'];

// Same hidden patterns across all trials → polysemantic neurons
const TRIALS: LMTrial[] = [
  {sentence: ['the', 'cat', 'sat', 'on', 'the'], inputPattern: [0, 2], hidden1Pattern: [1, 2, 4], hidden2Pattern: [0, 2, 3], predictedTokenIdx: 0},
  {sentence: ['she', 'opened', 'the'],            inputPattern: [1, 2], hidden1Pattern: [1, 2, 4], hidden2Pattern: [0, 2, 3], predictedTokenIdx: 1},
  {sentence: ['I', 'drank', 'a', 'cup', 'of'],    inputPattern: [0, 1], hidden1Pattern: [1, 2, 4], hidden2Pattern: [0, 2, 3], predictedTokenIdx: 2},
];

export default makeScene2D(function* (view) {
  addBackground(view);

  const layout = setupSlide(view, {title: "Inside an LLM's MLP block"});

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
    origin: {x: NET_X, y: NET_Y},
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
    Tiny LLM MLP block. Input = partial sentence (tokens embed into 3 input units).
    Output = top-3 next-token candidates.
    Hidden layers: where polysemy hides.
    ~15s.
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
      Prompt "${t.sentence.join(' ')}" → predicts "${VOCAB[t.predictedTokenIdx]}".
      Different prompts, different predictions — but SAME hidden neurons fire each time.
      Each hidden neuron is doing many unrelated jobs at once. Polysemy.
      ~12s.
    `, 'Stanislas');

    yield* all(...sentenceRow().children().map(c => (c as Txt).opacity(0, 0.25)));
  }

  yield* waitFor(0.2);
});

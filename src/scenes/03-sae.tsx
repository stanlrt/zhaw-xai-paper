import {makeScene2D, Txt, Rect, Circle, Line} from '@motion-canvas/2d';
import {createRef, all, chain, waitFor} from '@motion-canvas/core';
import {colors, fonts, sizes} from '../lib/theme';
import {slide} from '../lib/slide';
import {addBackground} from '../lib/bg';
import {setupSlide} from '../lib/slide-layout';
import {slideEdgeHighlight} from '../lib/network';

interface Trial {
  prompt: string;
  predicted: string;
  // Hidden vector activation: 6 dim circles; values 0..1 (polysemantic = many partly lit)
  vec: number[];
  // Index of the ONE sparse feature that fires (out of 12)
  sparseIdx: number;
  featureName: string;
}

const TRIALS: Trial[] = [
  {
    prompt: 'the cat sat on the',
    predicted: 'mat',
    vec: [0.7, 0.2, 0.6, 0.8, 0.3, 0.5],
    sparseIdx: 2,
    featureName: '"feline + on-surface"',
  },
  {
    prompt: 'she opened the',
    predicted: 'door',
    vec: [0.4, 0.7, 0.5, 0.6, 0.8, 0.3],
    sparseIdx: 5,
    featureName: '"door-opening event"',
  },
  {
    prompt: 'I drank a cup of',
    predicted: 'coffee',
    vec: [0.6, 0.8, 0.3, 0.7, 0.5, 0.4],
    sparseIdx: 9,
    featureName: '"beverage noun"',
  },
];

const BLOCK_W = 90;
const BLOCK_H = 56;
const BLOCK_GAP = 30;
const N_BLOCKS = 4;
const CHAIN_Y = -280;
const CHAIN_CENTER_X = 0;

// Block index whose output is fed into the SAE (zero-based: b2 → idx 1)
const SAE_BLOCK_IDX = 1;

const VEC_DIMS = 6;
const VEC_R = 14;
const VEC_GAP = 36;

const SPARSE_DIMS = 12;
const SPARSE_R = 14;
const SPARSE_GAP = 28;

export default makeScene2D(function* (view) {
  addBackground(view);

  const layout = setupSlide(view, {title: 'Sparse Autoencoder', titleColor: colors.sae});

  // Compute block x positions, centered
  const totalW = N_BLOCKS * BLOCK_W + (N_BLOCKS - 1) * BLOCK_GAP;
  const startX = CHAIN_CENTER_X - totalW / 2 + BLOCK_W / 2;
  const blockX = (i: number) => startX + i * (BLOCK_W + BLOCK_GAP);

  // Build forward-pass chain
  const blocks: ReturnType<typeof createRef<Rect>>[] = [];
  const blockLabels: ReturnType<typeof createRef<Txt>>[] = [];
  const blockLines: ReturnType<typeof createRef<Line>>[] = [];

  for (let i = 0; i < N_BLOCKS; i++) {
    const r = createRef<Rect>();
    const t = createRef<Txt>();
    const isAttached = i === SAE_BLOCK_IDX;
    blocks.push(r);
    blockLabels.push(t);
    view.add(
      <>
        <Rect
          ref={r}
          x={blockX(i)}
          y={CHAIN_Y}
          width={BLOCK_W}
          height={BLOCK_H}
          fill={'#1f2937'}
          stroke={isAttached ? colors.sae : colors.edge}
          lineWidth={isAttached ? 4 : 2}
          radius={10}
          opacity={0}
        />
        <Txt
          ref={t}
          x={blockX(i)}
          y={CHAIN_Y}
          fontSize={22}
          fontFamily={fonts.mono}
          fill={isAttached ? colors.sae : colors.text}
          text={`b${i + 1}`}
          opacity={0}
        />
      </>,
    );
  }

  // Lines between blocks
  for (let i = 0; i < N_BLOCKS - 1; i++) {
    const lr = createRef<Line>();
    blockLines.push(lr);
    view.add(
      <Line
        ref={lr}
        points={[
          [blockX(i) + BLOCK_W / 2, CHAIN_Y],
          [blockX(i + 1) - BLOCK_W / 2, CHAIN_Y],
        ]}
        stroke={colors.edge}
        lineWidth={2}
        end={0}
      />,
    );
  }

  // Prompt label (left of b1) + output label (right of bN)
  const promptLabel = createRef<Txt>();
  const promptText = createRef<Txt>();
  const outputArrow = createRef<Line>();
  const outputText = createRef<Txt>();

  view.add(
    <>
      <Txt
        ref={promptLabel}
        x={blockX(0) - BLOCK_W / 2 - 30}
        y={CHAIN_Y - 50}
        offsetX={1}
        fontSize={20}
        fontFamily={fonts.mono}
        fill={colors.textMuted}
        text={'prompt:'}
        opacity={0}
      />
      <Txt
        ref={promptText}
        x={blockX(0) - BLOCK_W / 2 - 30}
        y={CHAIN_Y}
        offsetX={1}
        fontSize={26}
        fontFamily={fonts.mono}
        fill={colors.active}
        text={''}
        opacity={0}
      />
      <Txt
        ref={outputText}
        x={blockX(N_BLOCKS - 1) + BLOCK_W / 2 + 50}
        y={CHAIN_Y}
        offsetX={-1}
        fontSize={32}
        fontFamily={fonts.mono}
        fill={colors.active}
        text={''}
        opacity={0}
      />
      <Line
        ref={outputArrow}
        points={[
          [blockX(N_BLOCKS - 1) + BLOCK_W / 2, CHAIN_Y],
          [blockX(N_BLOCKS - 1) + BLOCK_W / 2 + 40, CHAIN_Y],
        ]}
        stroke={colors.edge}
        lineWidth={2}
        endArrow
        arrowSize={8}
        end={0}
      />
    </>,
  );

  // ---- Hidden vector column (below SAE_BLOCK_IDX) ----
  const VEC_X = blockX(SAE_BLOCK_IDX);
  const VEC_TOP_Y = CHAIN_Y + BLOCK_H / 2 + 80;

  const vecCircles: ReturnType<typeof createRef<Circle>>[] = [];
  for (let i = 0; i < VEC_DIMS; i++) {
    const r = createRef<Circle>();
    vecCircles.push(r);
    view.add(
      <Circle
        ref={r}
        x={VEC_X}
        y={VEC_TOP_Y + i * VEC_GAP}
        size={VEC_R * 2}
        fill={colors.neuronFill}
        stroke={colors.neuronStroke}
        lineWidth={2}
        opacity={0}
      />,
    );
  }

  // Connector from b2 to top of vec column
  const vecArrowDown = createRef<Line>();
  view.add(
    <Line
      ref={vecArrowDown}
      points={[
        [VEC_X, CHAIN_Y + BLOCK_H / 2],
        [VEC_X, VEC_TOP_Y - VEC_R - 4],
      ]}
      stroke={colors.sae}
      lineWidth={2}
      endArrow
      arrowSize={8}
      end={0}
    />,
  );
  const vecLabel = createRef<Txt>();
  view.add(
    <Txt
      ref={vecLabel}
      x={VEC_X + 60}
      y={VEC_TOP_Y + (VEC_DIMS - 1) * VEC_GAP / 2}
      offsetX={-1}
      fontSize={18}
      fontFamily={fonts.mono}
      fill={colors.textMuted}
      text={'vec  (dense, polysemantic)'}
      opacity={0}
    />,
  );

  // ---- SAE box + sparse column ----
  const VEC_BOTTOM_Y = VEC_TOP_Y + (VEC_DIMS - 1) * VEC_GAP;

  // Sparse column placed to RIGHT of vec, slightly lower
  const SPARSE_X = VEC_X + 360;
  const SPARSE_TOP_Y = VEC_BOTTOM_Y - ((SPARSE_DIMS - 1) * SPARSE_GAP) / 2 + 0;

  // SAE wrapper box (encloses encoder/decoder schematic)
  const SAE_LEFT = VEC_X + 60;
  const SAE_RIGHT = SPARSE_X + 90;
  const SAE_TOP = VEC_TOP_Y - 30;
  const SAE_BOTTOM = SPARSE_TOP_Y + (SPARSE_DIMS - 1) * SPARSE_GAP + 30;

  const saeBox = createRef<Rect>();
  view.add(
    <Rect
      ref={saeBox}
      x={(SAE_LEFT + SAE_RIGHT) / 2}
      y={(SAE_TOP + SAE_BOTTOM) / 2}
      width={SAE_RIGHT - SAE_LEFT}
      height={SAE_BOTTOM - SAE_TOP}
      fill={'#16191f'}
      stroke={colors.sae}
      lineWidth={2}
      radius={14}
      opacity={0}
    />,
  );
  const saeLabel = createRef<Txt>();
  view.add(
    <Txt
      ref={saeLabel}
      x={(SAE_LEFT + SAE_RIGHT) / 2}
      y={SAE_TOP - 24}
      fontSize={22}
      fontFamily={fonts.sans}
      fill={colors.sae}
      text={'SAE'}
      opacity={0}
    />,
  );

  // Sparse column circles
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

  // Encode arrow: from vec column right edge -> sparse column left edge (mid heights)
  const VEC_MID_Y = (VEC_TOP_Y + VEC_BOTTOM_Y) / 2;
  const SPARSE_MID_Y = SPARSE_TOP_Y + ((SPARSE_DIMS - 1) * SPARSE_GAP) / 2;

  const encodeArrow = createRef<Line>();
  view.add(
    <Line
      ref={encodeArrow}
      points={[
        [VEC_X + VEC_R + 4, VEC_MID_Y],
        [SPARSE_X - SPARSE_R - 4, SPARSE_MID_Y],
      ]}
      stroke={colors.sae}
      lineWidth={2}
      endArrow
      arrowSize={8}
      end={0}
    />,
  );
  const encodeLabel = createRef<Txt>();
  view.add(
    <Txt
      ref={encodeLabel}
      x={(VEC_X + SPARSE_X) / 2}
      y={(VEC_MID_Y + SPARSE_MID_Y) / 2 - 28}
      fontSize={18}
      fontFamily={fonts.mono}
      fill={colors.textMuted}
      text={'encode'}
      opacity={0}
    />,
  );

  // Sparse column label
  const sparseLabel = createRef<Txt>();
  view.add(
    <Txt
      ref={sparseLabel}
      x={SPARSE_X + 70}
      y={SPARSE_MID_Y}
      offsetX={-1}
      fontSize={18}
      fontFamily={fonts.mono}
      fill={colors.textMuted}
      text={'s  (wide, sparse,\ninterpretable)'}
      opacity={0}
    />,
  );

  // Feature name label (below sparse col)
  const featureLabel = createRef<Txt>();
  view.add(
    <Txt
      ref={featureLabel}
      x={SPARSE_X + 70}
      y={SPARSE_TOP_Y + (SPARSE_DIMS - 1) * SPARSE_GAP + 30}
      offsetX={-1}
      fontSize={22}
      fontFamily={fonts.mono}
      fill={colors.sae}
      text={''}
      opacity={0}
    />,
  );

  // ============================================================
  // Sequence
  // ============================================================
  yield* layout.showTitle();

  // Build the LLM chain
  yield* all(
    promptLabel().opacity(1, 0.4),
    ...blocks.map(b => b().opacity(1, 0.4)),
    ...blockLabels.map(t => t().opacity(1, 0.4)),
  );
  yield* all(...blockLines.map(l => l().end(1, 0.5)));
  yield* outputArrow().end(1, 0.4);
  yield* slide('sae:chain', `
    LLM = chain of transformer blocks. Each block reads a vector, writes a vector.
    Forward pass goes left to right. We pick block 2 (orange border) to attach our SAE.
    ~12s.
  `, 'Stanislas');

  // Show vec column
  yield* all(
    vecArrowDown().end(1, 0.4),
    ...vecCircles.map(c => c().opacity(1, 0.4)),
    vecLabel().opacity(1, 0.4),
  );
  yield* slide('sae:vec', `
    "Hidden vector" = block 2's output for one token. Dense list of numbers.
    Each circle = one dimension. Many fire at once → polysemantic, hard to read.
    ~12s.
  `, 'Stanislas');

  // SAE box + sparse column
  yield* all(
    saeBox().opacity(1, 0.4),
    saeLabel().opacity(1, 0.4),
    encodeArrow().end(1, 0.4),
    encodeLabel().opacity(1, 0.4),
    ...sparseCircles.map(c => c().opacity(1, 0.4)),
    sparseLabel().opacity(1, 0.4),
  );
  yield* slide('sae:attached', `
    SAE = small extra autoencoder trained on block 2's hidden vectors.
    Encoder expands dense vec → very wide sparse code s. Most of s is zero.
    The few nonzero slots = named, interpretable features.
    LLM forward pass is unchanged; SAE just READS vec.
    ~15s.
  `, 'Stanislas');

  // ============================================================
  // Trials
  // ============================================================
  for (let ti = 0; ti < TRIALS.length; ti++) {
    const t = TRIALS[ti];

    // Update prompt text
    promptText().text(t.prompt);
    yield* promptText().opacity(1, 0.25);

    // Pulse forward chain (lines + blocks)
    for (let i = 0; i < N_BLOCKS; i++) {
      yield* all(
        chain(blocks[i]().fill(colors.active, 0.15), blocks[i]().fill('#1f2937', 0.3)),
        ...(i < blockLines.length
          ? [slideEdgeHighlight(view, blockLines[i](), colors.active, 0.4)]
          : []),
      );
    }
    outputText().text(`"${t.predicted}"`);
    yield* outputText().opacity(1, 0.25);

    // Update vec activations (polysemantic — many partial)
    yield* all(
      ...t.vec.map((v, i) =>
        chain(
          vecCircles[i]().fill(colors.active, 0.25),
          vecCircles[i]().opacity(0.3 + v * 0.7, 0.25),
        ),
      ),
    );

    // Encode flow
    yield* slideEdgeHighlight(view, encodeArrow(), colors.sae, 0.5);

    // Sparse code: ONE feature lights up bright orange
    yield* all(
      sparseCircles[t.sparseIdx]().fill(colors.sae, 0.3),
      sparseCircles[t.sparseIdx]().opacity(1, 0.3),
    );

    // Feature label
    featureLabel().text(t.featureName);
    yield* featureLabel().opacity(1, 0.3);

    yield* slide(`sae:trial-${ti}`, `
      Prompt "${t.prompt}" → block 2 vec is dense and polysemantic (many circles partly lit).
      Same vec → SAE encodes → one sparse feature lights: ${t.featureName}.
      LLM still predicts "${t.predicted}" via its normal forward pass.
      ~15s.
    `, 'Stanislas');

    // Reset for next trial
    yield* all(
      promptText().opacity(0, 0.25),
      outputText().opacity(0, 0.25),
      featureLabel().opacity(0, 0.25),
      ...vecCircles.map(c =>
        all(c().fill(colors.neuronFill, 0.25), c().opacity(1, 0.25)),
      ),
      sparseCircles[t.sparseIdx]().fill(colors.neuronFill, 0.25),
    );
  }

  yield* waitFor(0.2);
});

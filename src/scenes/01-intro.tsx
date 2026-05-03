import {makeScene2D, Layout, Txt} from '@motion-canvas/2d';
import {createRef, all, waitFor, chain, tween, easeOutCubic, createSignal} from '@motion-canvas/core';
import {colors, fonts, sizes} from '../lib/theme';
import {slide} from '../lib/slide';
import {addBackground} from '../lib/bg';

interface Step {
  context: string;
  predictions: {word: string; p: number}[];
}

const PRESET_WORDS = ['The', 'quick', 'brown'];

const STEPS: Step[] = [
  {
    context: 'brown',
    predictions: [
      {word: 'fox', p: 0.55},
      {word: 'dog', p: 0.18},
      {word: 'bear', p: 0.12},
      {word: 'hen', p: 0.08},
      {word: 'owl', p: 0.07},
    ],
  },
  {
    context: 'fox',
    predictions: [
      {word: 'jumps', p: 0.48},
      {word: 'runs', p: 0.22},
      {word: 'sits', p: 0.14},
      {word: 'hides', p: 0.09},
      {word: 'leaps', p: 0.07},
    ],
  },
];

const PRED_FONT = 30;
const SENT_FONT = sizes.titleSize;

export default makeScene2D(function* (view) {
  addBackground(view);

  const title = createRef<Txt>();
  const subtitle = createRef<Txt>();

  view.add(
    <>
      <Txt
        ref={title}
        y={-300}
        fontSize={SENT_FONT + 8}
        fontFamily={fonts.sans}
        fill={colors.text}
        opacity={0}
        text={'Explainable AI'}
      />
      <Txt
        ref={subtitle}
        y={-220}
        fontSize={sizes.bodySize}
        fontFamily={fonts.sans}
        fill={colors.textMuted}
        opacity={0}
        text={'"Stochastic parrots"? Or something more?'}
      />
    </>,
  );

  yield* title().opacity(1, 0.6);
  yield* slide('intro:title', `
    Paper: "Sparse Feature Circuits" — Marks et al., ICLR 2025.
    Hook: "LLMs are just stochastic parrots / next-word predictors."
    Today: XAI to test that claim.
    ~30s.
  `, 'Stanislas');

  yield* subtitle().opacity(1, 0.5);
  yield* slide('intro:hook', `
    Frame: open the black box.
    ~15s.
  `, 'Stanislas');

  const sentenceRow = createRef<Layout>();
  const predictionsCol = createRef<Layout>();
  const BLOCK_GAP = 60;

  view.add(
    <>
      <Layout
        ref={sentenceRow}
        layout
        direction={'row'}
        gap={18}
        alignItems={'center'}
        y={20}
        offsetX={-1}
      />
      <Layout
        ref={predictionsCol}
        layout
        direction={'column'}
        gap={14}
        alignItems={'start'}
        y={20}
        offsetX={-1}
      />
    </>,
  );

  // Pre-populate sentence with starter words
  for (const w of PRESET_WORDS) {
    sentenceRow().add(
      <Txt
        text={w}
        fontSize={SENT_FONT}
        fontFamily={fonts.sans}
        fill={colors.text}
      />,
    );
  }

  const centeredXs = () => {
    const sw = sentenceRow().width();
    const pw = predictionsCol().width();
    const totalW = sw + BLOCK_GAP + pw;
    const baseX = -totalW / 2;
    return {sentX: baseX, predX: baseX + sw + BLOCK_GAP};
  };

  yield* waitFor(0);
  const init = centeredXs();
  sentenceRow().x(init.sentX);
  predictionsCol().x(init.predX);

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];

    interface RowState {
      row: ReturnType<typeof createRef<Layout>>;
      counter: ReturnType<typeof createRef<Txt>>;
      word: ReturnType<typeof createRef<Txt>>;
      sig: ReturnType<typeof createSignal<number>>;
      target: number;
      isTop: boolean;
      pred: {word: string; p: number};
    }

    const rows: RowState[] = step.predictions.map((pred, k) => {
      const row = createRef<Layout>();
      const counter = createRef<Txt>();
      const word = createRef<Txt>();
      const sig = createSignal(0);
      const isTop = k === 0;
      predictionsCol().add(
        <Layout
          ref={row}
          layout
          direction={'row'}
          gap={20}
          alignItems={'center'}
          opacity={0}
        >
          <Txt
            ref={counter}
            text={'0.0%'}
            fontSize={PRED_FONT - 4}
            fontFamily={fonts.mono}
            fill={isTop ? colors.active : colors.textMuted}
            width={110}
          />
          <Txt
            ref={word}
            text={pred.word}
            fontSize={PRED_FONT}
            fontFamily={fonts.sans}
            fill={isTop ? colors.active : colors.text}
          />
        </Layout>,
      );
      return {row, counter, word, sig, target: pred.p, isTop, pred};
    });

    yield* chain(...rows.map(r => r.row().opacity(1, 0.12)));

    yield* all(
      ...rows.map(r =>
        tween(0.5, t => {
          const v = r.target * easeOutCubic(t);
          r.sig(v);
          r.counter().text((v * 100).toFixed(1) + '%');
        }),
      ),
    );

    yield* waitFor(0.3);

    const top = rows[0];
    const others = rows.slice(1);

    // Force layout pass before capturing source position
    yield* waitFor(0);
    const fromAbs = top.word().absolutePosition();

    const placeholder = createRef<Txt>();
    sentenceRow().add(
      <Txt
        ref={placeholder}
        text={top.pred.word}
        fontSize={SENT_FONT}
        fontFamily={fonts.sans}
        fill={colors.text}
        opacity={0}
      />,
    );
    yield* waitFor(0);
    const toAbs = placeholder().absolutePosition();

    // Convert world (canvas pixel, top-left origin) → view-local (scene, center origin)
    const viewMatrix = view.worldToLocal();
    const fromLocal = fromAbs.transformAsPoint(viewMatrix);
    const toLocal = toAbs.transformAsPoint(viewMatrix);

    // Recenter whole block (sentence + gap + predictions) horizontally
    const target = centeredXs();
    const sentDx = target.sentX - sentenceRow().x();
    const toLocalCentered = {x: toLocal.x + sentDx, y: toLocal.y};

    const ghost = createRef<Txt>();
    view.add(
      <Txt
        ref={ghost}
        text={top.pred.word}
        fontSize={PRED_FONT}
        fontFamily={fonts.sans}
        fill={colors.active}
        x={fromLocal.x}
        y={fromLocal.y}
      />,
    );

    // Hide source row's word + counter immediately
    top.word().opacity(0);
    top.counter().opacity(0);

    yield* all(
      ghost().x(toLocalCentered.x, 0.6),
      ghost().y(toLocalCentered.y, 0.6),
      ghost().fontSize(SENT_FONT, 0.6),
      ghost().fill(colors.text, 0.6),
      sentenceRow().x(target.sentX, 0.6),
      predictionsCol().x(target.predX, 0.6),
      ...others.map(r =>
        all(r.row().opacity(0, 0.45), r.row().scale(0.7, 0.45)),
      ),
    );

    placeholder().opacity(1);
    ghost().remove();
    predictionsCol().removeChildren();
  }

  // Recenter sentence after final prediction (predictions column now empty)
  yield* waitFor(0);
  const finalSentX = -sentenceRow().width() / 2;
  yield* sentenceRow().x(finalSentX, 0.4);
  predictionsCol().x(finalSentX + sentenceRow().width() + BLOCK_GAP);

  yield* slide('intro:done', `
    Sentence done. But HOW does model pick at each step? What lives inside?
    ~10s.
  `, 'Stanislas');

  yield* waitFor(0.2);
});

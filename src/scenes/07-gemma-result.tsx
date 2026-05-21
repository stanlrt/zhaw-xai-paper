import {makeScene2D, Txt, Rect} from '@motion-canvas/2d';
import {createRef, all, waitFor} from '@motion-canvas/core';
import {colors, fonts, sizes} from '../lib/theme';
import {slide} from '../lib/slide';
import {addBackground} from '../lib/bg';
import {makeCounter} from '../lib/counter';

export default makeScene2D(function* (view) {
  addBackground(view);

  const title = createRef<Txt>();
  const subtitle = createRef<Txt>();
  view.add(
    <>
      <Txt
        ref={title}
        y={-340}
        fontSize={sizes.titleSize}
        fontFamily={fonts.sans}
        fill={colors.text}
        opacity={0}
        text={'SHIFT on Gemma 2-2B'}
      />
      <Txt
        ref={subtitle}
        y={-260}
        fontSize={sizes.bodySize - 4}
        fontFamily={fonts.sans}
        fill={colors.textMuted}
        opacity={0}
        text={'gender-bias accuracy gap (worst-case → robust)'}
      />
    </>,
  );

  const before = makeCounter(0, 0, '%', {
    x: -360,
    y: 30,
    fontSize: 200,
    fontFamily: fonts.mono,
    fill: colors.bad,
    opacity: 0,
  });
  const after = makeCounter(0, 0, '%', {
    x: 360,
    y: 30,
    fontSize: 200,
    fontFamily: fonts.mono,
    fill: colors.good,
    opacity: 0,
  });

  const arrow = createRef<Rect>();

  view.add(
    <>
      {before.node}
      {after.node}
      <Rect ref={arrow} x={0} y={30} width={120} height={6} fill={colors.text} opacity={0} radius={3} />
      <Txt
        x={-360}
        y={180}
        fontSize={sizes.bodySize - 4}
        fontFamily={fonts.sans}
        fill={colors.textMuted}
        opacity={1}
        text={'before SHIFT'}
      />
      <Txt
        x={360}
        y={180}
        fontSize={sizes.bodySize - 4}
        fontFamily={fonts.sans}
        fill={colors.textMuted}
        opacity={1}
        text={'after SHIFT'}
      />
    </>,
  );

  yield* all(title().opacity(1, 0.5), subtitle().opacity(1, 0.5));
  yield* before.handle.ref().opacity(1, 0.3);
  yield* before.handle.countTo(81, 1.2);
  yield* slide('gemma:before', `
    Worst-case bias: 81%. Classifier almost entirely riding the gender shortcut.
    ~10s.
  `, 'Elio');

  yield* arrow().opacity(1, 0.3);
  yield* after.handle.ref().opacity(1, 0.3);
  yield* after.handle.countTo(51, 1.2);
  yield* slide('gemma:after', `
    After ablating gender features: 51%. Bias near gone.
    Bonus: actual task accuracy improved — model relies on robust features.
    ~12s.
  `, 'Elio');

  yield* waitFor(0.2);
});

import { makeScene2D, Txt } from '@motion-canvas/2d';
import { all, createRef, waitFor } from '@motion-canvas/core';
import { addBackground } from '../lib/bg';
import { makeCounter } from '../lib/counter';
import { slide } from '../lib/slide';
import { colors, fonts, sizes } from '../lib/theme';

export default makeScene2D(function* (view) {
  addBackground(view);

  const title = createRef<Txt>();
  view.add(
    <Txt
      ref={title}
      y={-340}
      fontSize={sizes.titleSize}
      fontFamily={fonts.sans}
      fill={colors.text}
      opacity={0}
      text={'Human interpretability rating (0–100)'}
    />,
  );

  const left = makeCounter(0, 1, '%', {
    x: -380,
    y: 0,
    fontSize: 180,
    fontFamily: fonts.mono,
    fill: colors.active,
    opacity: 0,
  });
  const right = makeCounter(0, 1, '%', {
    x: 380,
    y: 0,
    fontSize: 180,
    fontFamily: fonts.mono,
    fill: colors.sae,
    opacity: 0,
  });

  const labelLeft = createRef<Txt>();
  const labelRight = createRef<Txt>();

  view.add(
    <>
      {left.node}
      {right.node}
      <Txt
        ref={labelLeft}
        x={-380}
        y={140}
        fontSize={sizes.bodySize}
        fontFamily={fonts.sans}
        fill={colors.textMuted}
        opacity={0}
        text={'Raw neurons (BiB top-30)'}
      />
      <Txt
        ref={labelRight}
        x={380}
        y={140}
        fontSize={sizes.bodySize}
        fontFamily={fonts.sans}
        fill={colors.textMuted}
        opacity={0}
        text={'SAE features (BiB top-30)'}
      />
    </>,
  );

  yield* title().opacity(1, 0.5);
  yield* slide('results:title', `
    This is backed up by evaluation use cases performed for the paper.

    Human crowdworkers (ARENA Slack ML researchers) give the SAE and input/output prompts like we saw in previous slide.
    Then they write a interpretation label and rate interpretability 0-100.
  `, 'Stanislas');

  yield* all(left.handle.ref().opacity(1, 0.3), labelLeft().opacity(1, 0.3));
  yield* left.handle.countTo(36.0, 1.4);
  yield* slide('results:raw');

  yield* all(right.handle.ref().opacity(1, 0.3), labelRight().opacity(1, 0.3));
  yield* right.handle.countTo(81.5, 1.4);
  yield* slide('results:sae');

  yield* waitFor(0.2);
});

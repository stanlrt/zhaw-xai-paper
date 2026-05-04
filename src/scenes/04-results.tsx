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
      text={'Neurons interpreted correctly'}
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
        text={'Raw network'}
      />
      <Txt
        ref={labelRight}
        x={380}
        y={140}
        fontSize={sizes.bodySize}
        fontFamily={fonts.sans}
        fill={colors.textMuted}
        opacity={0}
        text={'SAE network'}
      />
    </>,
  );

  yield* title().opacity(1, 0.5);
  yield* slide('results:title', `
    To verify if actually more interpretable: authors ran corwd-sourced evaluations.
    They asked human crowdworkers to give their interpretation of neurons by looking at inputs and activations, like we did.
  `, 'Stanislas');

  yield* all(left.handle.ref().opacity(1, 0.3), labelLeft().opacity(1, 0.3));
  yield* left.handle.countTo(52.8, 1.4);
  yield* slide('results:raw', `
    Raw network: 52.8% — barely above coin flip. Basically guessing.
  `, 'Stanislas');

  yield* all(right.handle.ref().opacity(1, 0.3), labelRight().opacity(1, 0.3));
  yield* right.handle.countTo(81.5, 1.4);
  yield* slide('results:sae', `
    SAE: 81.5%. Big jump in interpretability. Sparse features = real concepts.
  `, 'Stanislas');

  yield* waitFor(0.2);
});

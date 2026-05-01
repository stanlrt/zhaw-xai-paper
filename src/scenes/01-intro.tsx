import {makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {createRef, all, waitFor} from '@motion-canvas/core';
import {colors, fonts, sizes} from '../lib/theme';
import {slide} from '../lib/slide';

export default makeScene2D(function* (view) {
  view.add(<Rect width={'100%'} height={'100%'} fill={colors.bg} zIndex={-100} />);

  const title = createRef<Txt>();
  const subtitle = createRef<Txt>();

  view.add(
    <>
      <Txt
        ref={title}
        y={-40}
        fontSize={sizes.titleSize + 8}
        fontFamily={fonts.sans}
        fill={colors.text}
        opacity={0}
        text={'Explainable AI'}
      />
      <Txt
        ref={subtitle}
        y={40}
        fontSize={sizes.bodySize}
        fontFamily={fonts.sans}
        fill={colors.textMuted}
        opacity={0}
        text={'Paper presentation — ZHAW'}
      />
    </>,
  );

  yield* all(
    title().opacity(1, 0.6),
    title().y(-40, 0.8).to(-60, 0.8),
  );
  yield* slide('intro:title', `
    Open with paper title + authors.
    Hook: "What if your model could explain itself?"
    ~30s.
  `);

  yield* subtitle().opacity(1, 0.5);
  yield* slide('intro:subtitle', `
    State context: ZHAW XAI course, paper choice, why it matters.
    ~20s.
  `);

  yield* waitFor(0.2);
});

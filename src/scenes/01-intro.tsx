import { makeScene2D, Txt } from '@motion-canvas/2d';
import { createRef, waitFor } from '@motion-canvas/core';
import { addBackground } from '../lib/bg';
import { slide } from '../lib/slide';
import { colors, fonts } from '../lib/theme';

export default makeScene2D(function* (view) {
  addBackground(view);

  const cornerLeft = createRef<Txt>();
  const cornerRight = createRef<Txt>();
  const paperName = createRef<Txt>();
  const authors = createRef<Txt>();

  view.add(
    <>
      <Txt
        ref={cornerLeft}
        topLeft={() => view.size().scale(-0.5).add(20)}
        fontSize={20}
        fontFamily={fonts.mono}
        fill={colors.textMuted}
        text={'XAI Paper Presentation'}
      />
      <Txt
        ref={cornerRight}
        topRight={() => view.size().scale(0.5).mul([1, -1]).add([-20, 20])}
        fontSize={20}
        fontFamily={fonts.mono}
        fill={colors.textMuted}
        text={'😺 Katzenverein'}
      />
      <Txt
        ref={paperName}
        y={-40}
        width={1000}
        textAlign={'center'}
        textWrap
        fontSize={40}
        fontFamily={fonts.sans}
        fontWeight={700}
        lineHeight={"160%"}
        fill={colors.text}
        text={'Sparse Feature Circuits: Discovering and Editing Interpretable Causal Graphs in Language Models'}
      />
      <Txt
        ref={authors}
        y={120}
        width={1700}
        textAlign={'center'}
        textWrap
        fontSize={24}
        fontFamily={fonts.sans}
        fontWeight={500}
        fill={colors.textMuted}
        text={'Samuel Marks · Can Rager · Eric J. Michaud · Yonatan Belinkov · David Bau · Aaron Mueller — ICLR 2025'}
      />
    </>,
  );

  yield* slide('intro:title', `
    Today we will walk you through the "Sparse Feature Circuits" paper by Marks et al., presented at ICLR 2025.

    It will demonstrate a new technique for LLM explainability, and how it can be used to perform targeted fixes on the trained model.
  `, 'Stanislas');

  yield* waitFor(0.2);
});

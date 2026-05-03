import {makeScene2D, Txt, Rect, Layout} from '@motion-canvas/2d';
import {createRef, all, waitFor, chain} from '@motion-canvas/core';
import {colors, fonts, sizes} from '../lib/theme';
import {slide} from '../lib/slide';
import {addBackground} from '../lib/bg';

const FEATURES = 12;
// Mock activations 0..1 for clean / poisoned prompts
const CLEAN = [0.15, 0.62, 0.1, 0.88, 0.2, 0.4, 0.3, 0.55, 0.18, 0.7, 0.25, 0.35];
const POISON = [0.18, 0.6, 0.12, 0.22, 0.21, 0.41, 0.29, 0.18, 0.19, 0.71, 0.24, 0.36];
// Highlight indices: 3, 7 (noun-phrase number trackers)
const KEY = [3, 7];

function buildGrid(label: string, values: number[], fill: string) {
  const cells = values.map(() => createRef<Rect>());
  const wrapper = createRef<Layout>();
  const labelRef = createRef<Txt>();
  const node = (
    <Layout ref={wrapper} layout direction={'column'} gap={12} alignItems={'center'} opacity={0}>
      <Txt ref={labelRef} text={label} fontSize={sizes.bodySize - 6} fontFamily={fonts.sans} fill={colors.textMuted} />
      <Layout layout gap={6}>
        {values.map((v, i) => (
          <Rect
            ref={cells[i]}
            width={36}
            height={36 + v * 60}
            fill={fill}
            opacity={0.25 + v * 0.75}
            radius={4}
          />
        ))}
      </Layout>
    </Layout>
  );
  return {node, cells, wrapper, labelRef};
}

export default makeScene2D(function* (view) {
  addBackground(view);

  const title = createRef<Txt>();
  view.add(
    <Txt
      ref={title}
      y={-440}
      fontSize={sizes.titleSize}
      fontFamily={fonts.sans}
      fill={colors.text}
      opacity={0}
      text={'Attribution patching: clean − poisoned'}
    />,
  );

  const promptClean = createRef<Txt>();
  const promptPoison = createRef<Txt>();
  view.add(
    <>
      <Txt
        ref={promptClean}
        x={-520}
        y={-300}
        fontSize={26}
        fontFamily={fonts.mono}
        fill={colors.text}
        opacity={0}
        text={'"The boys near the teacher have …"'}
      />
      <Txt
        ref={promptPoison}
        x={520}
        y={-300}
        fontSize={26}
        fontFamily={fonts.mono}
        fill={colors.text}
        opacity={0}
        text={'"The boy near the teacher have …"'}
      />
    </>,
  );

  const cleanGrid = buildGrid('clean activations', CLEAN, colors.active);
  const poisonGrid = buildGrid('poisoned activations', POISON, colors.bad);
  const diffValues = CLEAN.map((v, i) => v - POISON[i]);
  const diffGrid = buildGrid('Δ = clean − poisoned', diffValues.map(d => Math.abs(d)), colors.sae);

  view.add(
    <>
      <Layout x={-520} y={-50}>{cleanGrid.node}</Layout>
      <Layout x={520} y={-50}>{poisonGrid.node}</Layout>
      <Layout x={0} y={260}>{diffGrid.node}</Layout>
    </>,
  );

  yield* title().opacity(1, 0.5);
  yield* slide('attrib:title', `
    Goal: which sparse features actually CAUSE the verb-agreement decision?
    Method: contrast a clean prompt with a poisoned one (only number flipped).
    ~15s.
  `, 'Stanislas');

  yield* all(promptClean().opacity(1, 0.4), cleanGrid.wrapper().opacity(1, 0.4));
  yield* slide('attrib:clean', `
    Clean prompt run. Each bar = one sparse feature's activation.
    ~10s.
  `, 'Stanislas');

  yield* all(promptPoison().opacity(1, 0.4), poisonGrid.wrapper().opacity(1, 0.4));
  yield* slide('attrib:poison', `
    Poisoned prompt: subject number flipped (boys → boy). Most features unchanged.
    ~10s.
  `, 'Stanislas');

  yield* diffGrid.wrapper().opacity(1, 0.5);
  yield* slide('attrib:diff', `
    Subtract: |clean − poisoned|. Big bars = features carrying number information.
    Linear approx (attribution patching) lets us do this at scale without re-running model per feature.
    ~15s.
  `, 'Stanislas');

  // Highlight KEY indices in diff grid
  yield* all(
    ...KEY.map(i => diffGrid.cells[i]().fill(colors.accent, 0.4)),
  );

  yield* slide('attrib:key', `
    Highlighted features = "noun-phrase number trackers".
    They drive the plural-vs-singular verb. Even bypass the relative clause "near the teacher".
    Causal, fine-grained, interpretable.
    ~15s.
  `, 'Stanislas');

  yield* waitFor(0.2);
});

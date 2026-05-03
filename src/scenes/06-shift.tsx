import {makeScene2D, Txt, Rect, Layout} from '@motion-canvas/2d';
import {createRef, all, waitFor} from '@motion-canvas/core';
import {colors, fonts, sizes} from '../lib/theme';
import {slide} from '../lib/slide';
import {addBackground} from '../lib/bg';

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
      text={'SHIFT — kill the shortcut'}
    />,
  );

  // Bio panel
  const bio = createRef<Rect>();
  const bioTxt = createRef<Txt>();
  const sheTok = createRef<Txt>();
  const restOfBio = createRef<Txt>();

  view.add(
    <Rect
      ref={bio}
      x={-600}
      y={-50}
      width={520}
      height={260}
      fill={'#1f2937'}
      stroke={colors.edge}
      lineWidth={2}
      radius={12}
      opacity={0}
    />,
  );
  view.add(
    <>
      <Txt
        ref={bioTxt}
        x={-600}
        y={-130}
        fontSize={22}
        fontFamily={fonts.mono}
        fill={colors.textMuted}
        opacity={0}
        text={'biography:'}
      />
      <Txt
        ref={sheTok}
        x={-740}
        y={-50}
        fontSize={28}
        fontFamily={fonts.sans}
        fill={colors.bad}
        opacity={0}
        text={'She'}
      />
      <Txt
        ref={restOfBio}
        x={-560}
        y={-50}
        fontSize={26}
        fontFamily={fonts.sans}
        fill={colors.text}
        opacity={0}
        text={'worked in the OR for years...'}
      />
    </>,
  );

  // Feature panel (sparse activations)
  const features = ['profession verb', 'medical term', 'gender pronoun', 'years of exp', 'workplace'];
  const featureRefs = features.map(() => createRef<Rect>());
  const featureLabels = features.map(() => createRef<Txt>());

  const featurePanel = createRef<Layout>();
  view.add(
    <Layout
      ref={featurePanel}
      x={0}
      y={-50}
      layout
      direction={'column'}
      gap={12}
      alignItems={'start'}
      opacity={0}
    >
      {features.map((f, i) => (
        <Layout layout gap={14} alignItems={'center'}>
          <Rect
            ref={featureRefs[i]}
            width={40}
            height={28}
            fill={i === 2 ? colors.bad : colors.sae}
            opacity={0.85}
            radius={4}
          />
          <Txt
            ref={featureLabels[i]}
            text={f}
            fontSize={22}
            fontFamily={fonts.sans}
            fill={i === 2 ? colors.bad : colors.text}
          />
        </Layout>
      ))}
    </Layout>,
  );

  // Output classifier
  const outBox = createRef<Rect>();
  const outTxt = createRef<Txt>();
  view.add(
    <>
      <Rect
        ref={outBox}
        x={580}
        y={-50}
        width={280}
        height={120}
        fill={'#1f2937'}
        stroke={colors.bad}
        lineWidth={3}
        radius={12}
        opacity={0}
      />
      <Txt
        ref={outTxt}
        x={580}
        y={-50}
        fontSize={48}
        fontFamily={fonts.sans}
        fill={colors.bad}
        opacity={0}
        text={'NURSE'}
      />
    </>,
  );

  yield* title().opacity(1, 0.5);
  yield* all(bio().opacity(1, 0.4), bioTxt().opacity(1, 0.4));
  // bio words appear
  yield* all(sheTok().opacity(1, 0.3), restOfBio().opacity(1, 0.3));
  yield* slide('shift:setup', `
    Worst-case task: classify biography → "nurse" or "pilot" where gender is perfectly correlated with profession.
    Network learns the SHORTCUT: female pronoun → nurse.
    ~15s.
  `, 'Stanislas');

  yield* featurePanel().opacity(1, 0.4);
  yield* slide('shift:features', `
    SAE shows which sparse features the classifier uses.
    Human spots the spurious one: "gender pronoun" (red) — task-irrelevant.
    ~12s.
  `, 'Stanislas');

  yield* all(outBox().opacity(1, 0.4), outTxt().opacity(1, 0.4));
  yield* slide('shift:before', `
    Before: prediction = NURSE. Driven by gender, not by content.
    ~10s.
  `, 'Stanislas');

  // 0-ablation: clamp gender feature to 0 (visual: shrink + fade)
  yield* all(
    featureRefs[2]().fill(colors.edge, 0.4),
    featureRefs[2]().opacity(0.15, 0.4),
    featureRefs[2]().width(0, 0.5),
    featureLabels[2]().fill(colors.edge, 0.4),
  );

  // Output flips
  yield* all(
    outTxt().text('PILOT', 0),
    outTxt().fill(colors.good, 0.4),
    outBox().stroke(colors.good, 0.4),
  );

  yield* slide('shift:ablate', `
    0-ablation: at inference, clamp gender-feature activation to 0.
    Classifier is forced to use real signal — content of bio.
    Prediction now correct.
    ~15s.
  `, 'Stanislas');

  yield* waitFor(0.2);
});

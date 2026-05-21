import { Line, makeScene2D, Rect, Txt } from '@motion-canvas/2d';
import { all, createRef, sequence, waitFor } from '@motion-canvas/core';
import { addBackground } from '../lib/bg';
import { slide } from '../lib/slide';
import { setupSlide } from '../lib/slide-layout';
import { colors, fonts } from '../lib/theme';

// Tokens of the clean prompt the network was probed on.
const TOKENS = ['the', 'boys', 'near', 'the', 'teacher', '___'];

// Feature groups identified by the paper (§3.3, App. C.1) for agreement-across-RC.
// Each entry: which token positions the feature fires on (from inspection / max-activating examples).
interface FeatureGroup {
  name: string;
  desc: string;
  fires: boolean[];         // length === TOKENS.length
  color: string;
}

const FEATURES: FeatureGroup[] = [
  {
    name: 'NP number tracker (plural)',
    desc: 'fires on every position inside the plural subject phrase, ignores singular distractors',
    //     the    boys   near   the    teacher ___
    fires: [true, true, false, false, false, true],
    color: colors.sae,
  },
  {
    name: 'PP/RC boundary detector',
    desc: 'fires at the start of the modifier — tells the model "distractor coming, ignore its number"',
    fires: [false, false, true, false, false, false],
    color: colors.active,
  },
  {
    name: 'Verb-form discriminator (plural)',
    desc: 'fires at the verb position; promotes the matching plural inflection at the output',
    fires: [false, false, false, false, false, true],
    color: colors.bad,
  },
];

const TOKEN_W = 130;
const TOKEN_H = 56;
const TOKEN_GAP = 14;
const ROW_H = 120;
const CELL_H = 60;
const NAME_W = 360;

export default makeScene2D(function* (view) {
  addBackground(view);
  const layout = setupSlide(view, { title: 'What did we actually find?' });

  // ---------- Token row (top) ----------
  const tokenRefs = TOKENS.map(() => createRef<Rect>());
  const tokenLblRefs = TOKENS.map(() => createRef<Txt>());
  const ROW_TOTAL_W = TOKENS.length * TOKEN_W + (TOKENS.length - 1) * TOKEN_GAP;
  const ROW_X0 = -ROW_TOTAL_W / 2 + TOKEN_W / 2;
  const TOKEN_Y = -120;

  for (let i = 0; i < TOKENS.length; i++) {
    const x = ROW_X0 + i * (TOKEN_W + TOKEN_GAP);
    view.add(
      <>
        <Rect ref={tokenRefs[i]}
          x={x} y={TOKEN_Y} width={TOKEN_W} height={TOKEN_H}
          fill={'#1f2937'} stroke={colors.edge} lineWidth={1.5} radius={8}
          opacity={0}
        />
        <Txt ref={tokenLblRefs[i]}
          x={x} y={TOKEN_Y}
          fontSize={26} fontFamily={fonts.mono} fill={colors.text}
          text={TOKENS[i]} opacity={0}
        />
      </>,
    );
  }

  // ---------- Feature group rows ----------
  // Each row has: name on the left, then per-token cells aligned with the token columns above.
  const NAME_X = ROW_X0 - TOKEN_W / 2 - 30;  // right edge of name labels
  const ROW_Y0 = TOKEN_Y + TOKEN_H / 2 + 60;

  interface RowRefs {
    name: ReturnType<typeof createRef<Txt>>;
    desc: ReturnType<typeof createRef<Txt>>;
    cells: ReturnType<typeof createRef<Rect>>[];
  }
  const rowRefs: RowRefs[] = FEATURES.map(() => ({
    name: createRef<Txt>(),
    desc: createRef<Txt>(),
    cells: TOKENS.map(() => createRef<Rect>()),
  }));

  for (let f = 0; f < FEATURES.length; f++) {
    const feat = FEATURES[f];
    const refs = rowRefs[f];
    const yMid = ROW_Y0 + f * ROW_H;

    view.add(
      <>
        <Txt ref={refs.name}
          x={NAME_X} y={yMid - 22} offsetX={1}
          fontSize={20} fontFamily={fonts.sans} fill={feat.color}
          text={feat.name} opacity={0}
        />
        <Txt ref={refs.desc}
          x={NAME_X} y={yMid + 8} offsetX={1} offsetY={0}
          width={NAME_W} textAlign={'right'} textWrap
          fontSize={14} fontFamily={fonts.sans} fill={colors.textMuted}
          text={feat.desc} opacity={0}
        />
      </>,
    );

    for (let i = 0; i < TOKENS.length; i++) {
      const x = ROW_X0 + i * (TOKEN_W + TOKEN_GAP);
      view.add(
        <Rect ref={refs.cells[i]}
          x={x} y={yMid} width={TOKEN_W - 16} height={CELL_H}
          fill={feat.fires[i] ? feat.color : '#1f2937'}
          stroke={colors.edge} lineWidth={1} radius={6}
          opacity={0}
        />,
      );
    }
  }

  // ---------- Algorithm flow (below the rows) ----------
  const FLOW_Y = ROW_Y0 + FEATURES.length * ROW_H + 40;
  const algoSteps = [
    'detect subject number',
    'detect modifier onset',
    'ignore distractor',
    'promote matching verb',
  ];
  const stepRefs = algoSteps.map(() => createRef<Rect>());
  const stepLblRefs = algoSteps.map(() => createRef<Txt>());
  const arrowRefs = algoSteps.slice(0, -1).map(() => createRef<Line>());

  const STEP_W = 230;
  const STEP_H = 50;
  const STEP_GAP = 36;
  const STEP_TOTAL_W = algoSteps.length * STEP_W + (algoSteps.length - 1) * STEP_GAP;
  const STEP_X0 = -STEP_TOTAL_W / 2 + STEP_W / 2;

  for (let s = 0; s < algoSteps.length; s++) {
    const x = STEP_X0 + s * (STEP_W + STEP_GAP);
    view.add(
      <>
        <Rect ref={stepRefs[s]}
          x={x} y={FLOW_Y} width={STEP_W} height={STEP_H}
          fill={'#0b1220'} stroke={colors.sae} lineWidth={2} radius={10}
          opacity={0}
        />
        <Txt ref={stepLblRefs[s]}
          x={x} y={FLOW_Y}
          fontSize={16} fontFamily={fonts.mono} fill={colors.sae}
          text={algoSteps[s]} opacity={0}
        />
      </>,
    );
    if (s < algoSteps.length - 1) {
      const xLeft = x + STEP_W / 2 + 4;
      const xRight = x + STEP_W + STEP_GAP - STEP_W / 2 - 4;
      view.add(
        <Line ref={arrowRefs[s]}
          points={[[xLeft, FLOW_Y], [xRight, FLOW_Y]]}
          stroke={colors.sae} lineWidth={2} endArrow arrowSize={10}
          opacity={0}
        />,
      );
    }
  }

  // ---------- Callback line ----------
  const callback = createRef<Txt>();
  view.add(
    <Txt ref={callback}
      x={0} y={FLOW_Y + STEP_H / 2 + 50}
      fontSize={26} fontFamily={fonts.sans} fill={colors.text}
      text={'LLMs are not basic next-token predictors, they encode structured algorithms.'}
      opacity={0}
    />,
  );

  // =========================================================
  // Animation
  // =========================================================
  yield* layout.showTitle();

  // Tokens fade in
  yield* sequence(
    0.05,
    ...tokenRefs.map((r, i) => all(
      r().opacity(1, 0.3),
      tokenLblRefs[i]().opacity(1, 0.3),
    )),
  );

  yield* slide('circ:setup', `
    Recap: we ran ATP on the verb-agreement task. Got a list of high-IE SAE features.
    The next question: when we INSPECT those features (look at where they fire on real text), do they correspond to anything meaningful? Or just noise?
    Spoiler: meaningful. Paper §3.3 names the groups.
  `, 'Stanislas');

  // Reveal each feature group one at a time
  for (let f = 0; f < FEATURES.length; f++) {
    const refs = rowRefs[f];
    yield* all(
      refs.name().opacity(1, 0.3),
      refs.desc().opacity(1, 0.3),
    );
    yield* sequence(
      0.04,
      ...refs.cells.map(c => c().opacity(1, 0.3)),
    );
    yield* slide(`circ:feature-${f}`, `
      Walk through each discovered feature in the circuit and its role.
    `, 'Stanislas');
  }

  // Reveal algorithm flow
  for (let s = 0; s < algoSteps.length; s++) {
    yield* all(
      stepRefs[s]().opacity(1, 0.25),
      stepLblRefs[s]().opacity(1, 0.25),
      ...(s < arrowRefs.length ? [arrowRefs[s]().opacity(1, 0.25)] : []),
    );
  }

  yield* slide('circ:algorithm', `
    Strung together, these features implement an actual algorithm:
    1. detect subject number
    2. detect modifier (RC/PP) onset
    3. carry the subject's number across the distractor (ignoring the modifier's noun number)
    4. promote the matching verb form at the output position
    Both Pythia and Gemma 2 do this — same algorithm, different sub-features.
  `, 'Stanislas');

  // Callback
  yield* callback().opacity(1, 0.5);
  yield* slide('circ:callback', `
    Back to our intro hook: "are LLMs just stochastic parrots?"
    The answer this paper gives: no. There IS structured, interpretable computation inside.
    These circuits are real. They generalize. They look like algorithms a programmer might have written.
    SAEs + ATP let us read them out.
  `, 'Stanislas');

  yield* waitFor(0.2);
});

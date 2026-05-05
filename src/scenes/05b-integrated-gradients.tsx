import { Circle, Line, makeScene2D, Txt } from '@motion-canvas/2d';
import { all, createRef, sequence, waitFor } from '@motion-canvas/core';
import { addBackground } from '../lib/bg';
import { slide } from '../lib/slide';
import { setupSlide } from '../lib/slide-layout';
import { colors, fonts } from '../lib/theme';

// ---------- m(a): a deliberately nonlinear curve. ----------
// At a=0: m=+0.40 (clean run, "are" wins). At a=1: m=-0.40 (patch run, "is" wins).
// True IE = m(1) - m(0) = -0.80.
// ATP underestimates because ∇m at a=0 = -0.2 only (curve starts shallow).
// IG averages gradients along path → recovers true IE.
const mFn = (a: number) => 0.4 - 0.6 * a * a - 0.2 * a;
const gFn = (a: number) => -1.2 * a - 0.2;

// Endpoints
const A_CLEAN = 0;
const A_PATCH = 1;
const M_CLEAN = mFn(A_CLEAN);  // +0.40
const M_PATCH = mFn(A_PATCH);  // -0.40
const TRUE_IE = M_PATCH - M_CLEAN; // -0.80

// ATP estimate
const ATP_IE = gFn(A_CLEAN) * (A_PATCH - A_CLEAN); // -0.20

// IG estimate (N=10 samples, midpoint rule)
const N_IG = 10;
const IG_GRADS = Array.from({ length: N_IG }, (_, k) => gFn((k + 0.5) / N_IG));
const IG_AVG_GRAD = IG_GRADS.reduce((s, g) => s + g, 0) / N_IG;
const IG_IE = IG_AVG_GRAD * (A_PATCH - A_CLEAN); // ≈ -0.80

// ---------- plot geometry ----------
// Axes extend to AXIS_*; curve/dots stay inside an inset so they don't overlap the axis lines.
const A_MIN = 0, A_MAX = 1;
const M_MIN = -0.6, M_MAX = 0.6;
const AXIS_X0 = -500, AXIS_X1 = 500;
const AXIS_Y0 = -280, AXIS_Y1 = 280;
const PAD_LEFT = 60, PAD_RIGHT = 120;  // big right pad so curve ends well before axis arrow + labels fit
const PAD_TOP = 60, PAD_BOTTOM = 50;

const ax = (a: number) =>
  AXIS_X0 + PAD_LEFT + ((a - A_MIN) / (A_MAX - A_MIN)) * (AXIS_X1 - AXIS_X0 - PAD_LEFT - PAD_RIGHT);
const ay = (m: number) =>
  AXIS_Y1 - PAD_BOTTOM - ((m - M_MIN) / (M_MAX - M_MIN)) * (AXIS_Y1 - AXIS_Y0 - PAD_TOP - PAD_BOTTOM);

const fmt = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2);

const MAGENTA = '#d946ef';

export default makeScene2D(function* (view) {
  addBackground(view);
  const layout = setupSlide(view, { title: 'Beyond ATP: integrated gradients' });

  // ---------- axes ----------
  const xAxis = createRef<Line>();
  const yAxis = createRef<Line>();
  const xLbl = createRef<Txt>();
  const yLbl = createRef<Txt>();
  view.add(
    <>
      <Line ref={xAxis}
        points={[[AXIS_X0, ay(0)], [AXIS_X1, ay(0)]]}
        stroke={colors.edge} lineWidth={1.2} endArrow arrowSize={10} opacity={0}
      />
      <Line ref={yAxis}
        points={[[AXIS_X0, AXIS_Y1], [AXIS_X0, AXIS_Y0]]}
        stroke={colors.edge} lineWidth={1.2} endArrow arrowSize={10} opacity={0}
      />
      <Txt ref={xLbl}
        x={AXIS_X1 + 30} y={ay(0)} offsetX={-1}
        fontSize={20} fontFamily={fonts.mono} fill={colors.textMuted}
        text={'a (feature activation)'} opacity={0}
      />
      <Txt ref={yLbl}
        x={AXIS_X0 - 10} y={AXIS_Y0 - 30} offsetX={1}
        fontSize={20} fontFamily={fonts.mono} fill={colors.textMuted}
        text={'m'} opacity={0}
      />
    </>,
  );

  // ---------- curve m(a) ----------
  const SAMPLES = 80;
  const curvePoints: [number, number][] = [];
  for (let k = 0; k <= SAMPLES; k++) {
    const a = A_MIN + (k / SAMPLES) * (A_MAX - A_MIN);
    curvePoints.push([ax(a), ay(mFn(a))]);
  }
  const curve = createRef<Line>();
  view.add(
    <Line ref={curve}
      points={curvePoints}
      stroke={colors.text} lineWidth={3}
      end={0}
    />,
  );

  // ---------- endpoint markers ----------
  const cleanDot = createRef<Circle>();
  const patchDot = createRef<Circle>();
  const cleanLbl = createRef<Txt>();
  const patchLbl = createRef<Txt>();
  view.add(
    <>
      <Circle ref={cleanDot}
        x={ax(A_CLEAN)} y={ay(M_CLEAN)} size={11}
        fill={colors.active} stroke={colors.active} lineWidth={1.5} opacity={0}
      />
      <Circle ref={patchDot}
        x={ax(A_PATCH)} y={ay(M_PATCH)} size={11}
        fill={colors.bad} stroke={colors.bad} lineWidth={1.5} opacity={0}
      />
      <Txt ref={cleanLbl}
        x={ax(A_CLEAN) + 14} y={ay(M_CLEAN) - 22} offsetX={-1}
        fontSize={18} fontFamily={fonts.mono} fill={colors.active}
        text={'(a_clean, m_clean) = (0.00, +0.40)'} opacity={0}
      />
      <Txt ref={patchLbl}
        x={ax(A_PATCH) - 14} y={ay(M_PATCH) + 30} offsetX={1}
        fontSize={18} fontFamily={fonts.mono} fill={colors.bad}
        text={'(a_patch, m_patch) = (1.00, −0.40)'} opacity={0}
      />
    </>,
  );

  // ---------- intro ----------
  yield* layout.showTitle();
  yield* all(
    xAxis().opacity(1, 0.4),
    yAxis().opacity(1, 0.4),
    xLbl().opacity(1, 0.4),
    yLbl().opacity(1, 0.4),
  );
  yield* curve().end(1, 0.8);
  yield* all(
    cleanDot().opacity(1, 0.3),
    patchDot().opacity(1, 0.3),
    cleanLbl().opacity(1, 0.3),
    patchLbl().opacity(1, 0.3),
  );

  yield* slide('ig:setup', `
    Plot of metric m as a function of one SAE feature's activation a.
    Clean activation = a_clean (left dot, high m, "are" wins).
    Patch activation = a_patch (right dot, low m, "is" wins).
    True IE = m_patch − m_clean = -0.80. The curve is nonlinear — that's the whole point.
  `, 'Stanislas');

  // ---------- Phase 1: ATP ----------
  // Tangent line at a_clean, slope = g(a_clean) = -0.2, extrapolated to a_patch.
  const TANGENT_DOMAIN = 1.05; // extend slightly past a_patch
  const tangentEndA = TANGENT_DOMAIN;
  const tangentEndM = M_CLEAN + gFn(A_CLEAN) * (tangentEndA - A_CLEAN);
  const tangent = createRef<Line>();
  view.add(
    <Line ref={tangent}
      points={[
        [ax(A_CLEAN), ay(M_CLEAN)],
        [ax(tangentEndA), ay(tangentEndM)],
      ]}
      stroke={colors.active} lineWidth={2.5} lineDash={[8, 6]} end={0}
    />,
  );

  // ATP-projected point on tangent at a_patch
  const atpProjY = ay(M_CLEAN + ATP_IE);
  const atpDot = createRef<Circle>();
  const atpLbl = createRef<Txt>();
  view.add(
    <>
      <Circle ref={atpDot}
        x={ax(A_PATCH)} y={atpProjY} size={9}
        fill={'#0b1220'} stroke={colors.active} lineWidth={2} opacity={0}
      />
      <Txt ref={atpLbl}
        x={ax(A_PATCH) - 14} y={AXIS_Y0 + 30} offsetX={1}
        fontSize={18} fontFamily={fonts.mono} fill={colors.active}
        text={`ATP estimate: m ≈ ${fmt(M_CLEAN + ATP_IE)}`} opacity={0}
      />
    </>,
  );

  // ATP error bracket: vertical line between true m_patch and ATP-projected
  const atpErrLine = createRef<Line>();
  const atpErrLbl = createRef<Txt>();
  view.add(
    <>
      <Line ref={atpErrLine}
        points={[
          [ax(A_PATCH) + 8, atpProjY],
          [ax(A_PATCH) + 28, atpProjY],
          [ax(A_PATCH) + 28, ay(M_PATCH)],
          [ax(A_PATCH) + 8, ay(M_PATCH)],
        ]}
        stroke={colors.bad} lineWidth={1.8} opacity={0}
      />
      <Txt ref={atpErrLbl}
        x={ax(A_PATCH) + 36} y={(atpProjY + ay(M_PATCH)) / 2} offsetX={-1}
        fontSize={14} fontFamily={fonts.mono} fill={colors.bad}
        text={`error ${fmt(ATP_IE - TRUE_IE)}`} opacity={0}
      />
    </>,
  );

  yield* tangent().end(1, 0.7);
  yield* all(
    atpDot().opacity(1, 0.3),
    atpLbl().opacity(1, 0.3),
  );
  yield* all(
    atpErrLine().opacity(1, 0.3),
    atpErrLbl().opacity(1, 0.3),
  );

  yield* slide('ig:atp', `
    ATP: take ONE gradient at a_clean. That's a tangent line. Extrapolate to a_patch.
    Tangent stays straight, but the real curve bends. Result: ATP estimate undershoots true m_patch by 0.60.
    This is the underestimation paper's Fig. 25 shows: ATP points fall below the diagonal.
  `, 'Stanislas');

  // ---------- Phase 2: IG ----------
  // Fade tangent + ATP markers
  yield* all(
    tangent().opacity(0.15, 0.4),
    atpDot().opacity(0.25, 0.4),
    atpLbl().opacity(0.25, 0.4),
    atpErrLine().opacity(0.25, 0.4),
    atpErrLbl().opacity(0.25, 0.4),
  );

  // Sample dots along the curve
  const sampleDots: ReturnType<typeof createRef<Circle>>[] = [];
  const sampleSlopes: ReturnType<typeof createRef<Line>>[] = [];
  const SLOPE_HALF = 30; // pixel half-length of each tiny slope arrow
  for (let k = 0; k < N_IG; k++) {
    const a = (k + 0.5) / N_IG;
    const m = mFn(a);
    const g = gFn(a);
    // visual slope: a small line segment whose pixel slope matches dm/da on the plot scale
    const dxPerDa = (AXIS_X1 - AXIS_X0 - PAD_LEFT - PAD_RIGHT) / (A_MAX - A_MIN);
    const dyPerDm = -(AXIS_Y1 - AXIS_Y0 - PAD_TOP - PAD_BOTTOM) / (M_MAX - M_MIN);
    const slopePx = (g * dyPerDm) / dxPerDa;
    const len = SLOPE_HALF;
    const dx = len / Math.sqrt(1 + slopePx * slopePx);
    const dy = slopePx * dx;
    const dot = createRef<Circle>();
    const slope = createRef<Line>();
    sampleDots.push(dot);
    sampleSlopes.push(slope);
    view.add(
      <>
        <Line ref={slope}
          points={[[ax(a) - dx, ay(m) - dy], [ax(a) + dx, ay(m) + dy]]}
          stroke={MAGENTA} lineWidth={2} opacity={0}
        />
        <Circle ref={dot}
          x={ax(a)} y={ay(m)} size={6}
          fill={MAGENTA} stroke={MAGENTA} lineWidth={1} opacity={0}
        />
      </>,
    );
  }

  yield* sequence(
    0.05,
    ...sampleDots.map((d, k) => all(
      d().opacity(1, 0.2),
      sampleSlopes[k]().opacity(1, 0.25),
    )),
  );

  yield* slide('ig:samples', `
    Integrated gradients: don't trust ONE gradient. Sample the gradient at N=10 evenly-spaced points along the path from a_clean to a_patch.
    Each pink mark = one gradient sample. Notice the slopes get steeper as we move right — that's the curvature ATP missed.
  `, 'Stanislas');

  // Average chord (effectively the secant from clean to patch in this case)
  const igChord = createRef<Line>();
  view.add(
    <Line ref={igChord}
      points={[
        [ax(A_CLEAN), ay(M_CLEAN)],
        [ax(A_PATCH), ay(M_CLEAN + IG_IE)],
      ]}
      stroke={MAGENTA} lineWidth={3} lineDash={[10, 6]} end={0}
    />,
  );
  yield* igChord().end(1, 0.6);

  // IG-projected point at a_patch (essentially overlaps true m_patch)
  const igProjY = ay(M_CLEAN + IG_IE);
  const igDot = createRef<Circle>();
  const igLbl = createRef<Txt>();
  view.add(
    <>
      <Circle ref={igDot}
        x={ax(A_PATCH)} y={igProjY} size={9}
        fill={'#0b1220'} stroke={MAGENTA} lineWidth={2} opacity={0}
      />
      <Txt ref={igLbl}
        x={ax(A_PATCH) - 14} y={AXIS_Y0 + 60} offsetX={1}
        fontSize={18} fontFamily={fonts.mono} fill={MAGENTA}
        text={`IG estimate: m ≈ ${fmt(M_CLEAN + IG_IE)}`} opacity={0}
      />
    </>,
  );
  yield* all(
    igDot().opacity(1, 0.3),
    igLbl().opacity(1, 0.3),
  );

  yield* slide('ig:average', `
    Average those 10 gradients → the dashed pink line: a chord that hugs the true curve.
    IG estimate hits m_patch almost exactly. Error: ~0.
  `, 'Stanislas');

  // ---------- Phase 3: cost summary ----------
  const summary1 = createRef<Txt>();
  const summary2 = createRef<Txt>();
  const summary3 = createRef<Txt>();
  view.add(
    <>
      <Txt ref={summary1}
        x={0} y={400}
        fontSize={22} fontFamily={fonts.mono} fill={colors.text} opacity={0}
        text={'Algorithmic cost'}
      />
      <Txt ref={summary2}
        x={0} y={440}
        fontSize={22} fontFamily={fonts.mono} fill={colors.text} opacity={0}
        text={'For N accuracy samples, N fwd + N bwd '}
      />
    </>,
  );
  yield* all(
    summary1().opacity(1, 0.4),
    summary2().opacity(1, 0.4),
  );

  yield* slide('ig:cost', `
    IG cost: ~N forward + N backward, regardless of how many nodes you attribute. The trick: backprop still gives ∇ for ALL activations in one backward pass — so adding more nodes is free.
    What scales the cost: N (integration steps) and the serial depth of the graph (per paper §3).
    Tradeoff: 10× ATP compute for a much tighter approximation. Paper uses IG when accuracy matters; ATP otherwise.
  `, 'Stanislas');

  yield* waitFor(0.2);
});

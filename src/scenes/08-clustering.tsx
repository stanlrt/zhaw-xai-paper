import {makeScene2D, Txt, Circle, Line, Rect} from '@motion-canvas/2d';
import {createRef, all, waitFor, chain} from '@motion-canvas/core';
import {colors, fonts, sizes} from '../lib/theme';
import {slide} from '../lib/slide';
import {addBackground} from '../lib/bg';

// Pseudo-random scatter with cluster centers
const CLUSTERS = [
  {cx: -480, cy: -80, color: colors.active, n: 20},
  {cx: -200, cy: 120, color: colors.sae, n: 18},
  {cx: 60, cy: -60, color: '#a78bfa', n: 22},
  {cx: 340, cy: 60, color: '#34d399', n: 20},
  {cx: -340, cy: 200, color: '#f472b6', n: 16},
];

function rand(seed: number) {
  // deterministic pseudo-random
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
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
      text={'Scaling: cluster behaviors → auto-discover circuits'}
    />,
  );

  // Scatter
  const dots: ReturnType<typeof createRef<Circle>>[] = [];
  let id = 0;
  for (const c of CLUSTERS) {
    for (let i = 0; i < c.n; i++) {
      const r = createRef<Circle>();
      const ox = (rand(id * 7 + 1) - 0.5) * 130;
      const oy = (rand(id * 13 + 3) - 0.5) * 80;
      view.add(
        <Circle ref={r} x={c.cx + ox} y={c.cy + oy} size={14} fill={c.color} opacity={0} />,
      );
      dots.push(r);
      id++;
    }
  }

  // Cluster label for "predicting 'to'"
  const clusterLabel = createRef<Txt>();
  view.add(
    <Txt
      ref={clusterLabel}
      x={60}
      y={-160}
      fontSize={26}
      fontFamily={fonts.mono}
      fill={'#a78bfa'}
      opacity={0}
      text={"cluster: predicting 'to'"}
    />,
  );

  yield* title().opacity(1, 0.5);
  yield* chain(...dots.map(d => d().opacity(1, 0.02)));
  yield* slide('cluster:scatter', `
    Run model on billions of inputs. Cluster prediction patterns.
    Each cluster = one narrow behavior. Thousands of them.
    No human labels needed.
    ~15s.
  `, 'Stanislas');

  yield* clusterLabel().opacity(1, 0.4);
  yield* slide('cluster:focus', `
    Zoom on one: "predict 'to' as infinitive object" — e.g. "X requires Y to act", "X allows Y to act".
    ~12s.
  `, 'Stanislas');

  // Fade scatter, draw two pathways
  yield* all(...dots.map(d => d().opacity(0.1, 0.5)), clusterLabel().opacity(0, 0.3));

  // Two pathways diverge then converge on "to"
  const reqWords = ['requires', 'Y', 'to'];
  const allowWords = ['allows', 'Y', 'to'];

  // Draw nodes for each pathway
  function pathwayNodes(words: string[], y: number, color: string) {
    const nodes = words.map(() => createRef<Circle>());
    const labels = words.map(() => createRef<Txt>());
    const lines: ReturnType<typeof createRef<Line>>[] = [];
    const xs = [-560, -200, 200];
    words.forEach((w, i) => {
      view.add(
        <>
          <Circle ref={nodes[i]} x={xs[i]} y={y} size={64} fill={colors.neuronFill} stroke={color} lineWidth={3} opacity={0} />
          <Txt ref={labels[i]} x={xs[i]} y={y} fontSize={22} fontFamily={fonts.mono} fill={colors.text} opacity={0} text={w} />
        </>,
      );
    });
    for (let i = 0; i < xs.length - 1; i++) {
      const lineRef = createRef<Line>();
      view.add(
        <Line ref={lineRef} points={[[xs[i], y], [xs[i + 1], y]]} stroke={color} lineWidth={3} end={0} />,
      );
      lines.push(lineRef);
    }
    return {nodes, labels, lines};
  }

  const top = pathwayNodes(reqWords, -60, colors.active);
  const bot = pathwayNodes(allowWords, 80, colors.sae);

  // Final shared "to" emphasized
  const finalNode = createRef<Circle>();
  const finalLabel = createRef<Txt>();
  view.add(
    <>
      <Circle ref={finalNode} x={520} y={10} size={100} fill={colors.neuronFill} stroke={colors.accent} lineWidth={4} opacity={0} />
      <Txt ref={finalLabel} x={520} y={10} fontSize={32} fontFamily={fonts.mono} fill={colors.accent} opacity={0} text={'"to"'} />
    </>,
  );

  // Reveal pathways
  yield* all(
    ...top.nodes.map(n => n().opacity(1, 0.3)),
    ...top.labels.map(l => l().opacity(1, 0.3)),
    ...bot.nodes.map(n => n().opacity(1, 0.3)),
    ...bot.labels.map(l => l().opacity(1, 0.3)),
  );
  yield* all(
    ...top.lines.map(l => l().end(1, 0.5)),
    ...bot.lines.map(l => l().end(1, 0.5)),
  );

  // Connect to final
  const tailTop = createRef<Line>();
  const tailBot = createRef<Line>();
  view.add(
    <>
      <Line ref={tailTop} points={[[200, -60], [520, 10]]} stroke={colors.active} lineWidth={3} end={0} />
      <Line ref={tailBot} points={[[200, 80], [520, 10]]} stroke={colors.sae} lineWidth={3} end={0} />
    </>,
  );
  yield* all(
    tailTop().end(1, 0.5),
    tailBot().end(1, 0.5),
    finalNode().opacity(1, 0.4),
    finalLabel().opacity(1, 0.4),
  );

  yield* slide('cluster:pathways', `
    Two distinct sparse-feature pathways converge on the same prediction "to".
    Top: "requires" pattern. Bottom: "allows" pattern.
    Different mechanisms, same surface output.
    THIS is what raw-neuron analysis would miss.
    ~15s.
  `, 'Stanislas');

  yield* slide('cluster:closing', `
    Take-aways:
    1) SAE turns polysemantic neurons into nameable features.
    2) Attribution patching scales causal analysis.
    3) SHIFT lets us edit out spurious cues.
    4) Clustering scales discovery to thousands of behaviors.
    Stochastic parrot? More like an interpretable circuit zoo.
    ~30s.
  `, 'Stanislas');

  yield* waitFor(0.3);
});

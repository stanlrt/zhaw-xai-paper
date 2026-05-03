import {Circle, Line, View2D} from '@motion-canvas/2d';
import {createRef, all, ThreadGenerator} from '@motion-canvas/core';
import {Neuron} from './neuron';
import {colors, sizes} from './theme';

export interface NetworkOptions {
  layers: number[];
  layerGap?: number;
  neuronGap?: number;
  origin?: {x: number; y: number};
}

export interface Network {
  view: View2D;
  neurons: Circle[][];
  linesPerLayer: Line[][];
  intro: () => ThreadGenerator;
  propagate: (opts?: {dur?: number}) => ThreadGenerator;
  pulseNeuron: (layer: number, index: number, duration?: number) => ThreadGenerator;
  pulseNeuronSubset: (layer: number, indices: number[], dur?: number) => ThreadGenerator;
  slideEdges: (
    layerIdx: number,
    fromIdx: number[],
    toIdx: number[],
    dur?: number,
  ) => ThreadGenerator;
  fireTransition: (
    layerIdx: number,
    fromIdx: number[],
    toIdx: number[],
    dur?: number,
  ) => ThreadGenerator;
}

/** Animate a single edge: cyan overlay wipes in from left, then erases from left. */
export function* slideEdgeHighlight(
  view: View2D,
  baseLine: Line,
  color: string = colors.active,
  dur = 0.55,
): ThreadGenerator {
  const overlay = createRef<Line>();
  view.add(
    <Line
      ref={overlay}
      points={baseLine.points() ?? []}
      stroke={color}
      lineWidth={(baseLine.lineWidth() as number) + 2}
      start={0}
      end={0}
      lineCap={'round'}
    />,
  );
  yield* overlay().end(1, dur * 0.55);
  yield* overlay().start(1, dur * 0.45);
  overlay().remove();
}

/** Pulse a subset of neurons in a layer (cyan flash, fade back). */
export function* pulseNeuronSubsetGen(
  neurons: Circle[],
  indices: number[],
  color: string = colors.active,
  dur = 0.45,
): ThreadGenerator {
  yield* all(
    ...indices.map(i =>
      neurons[i]
        .fill(color, dur / 2)
        .to(colors.neuronFill, dur),
    ),
  );
}

export function buildNetwork(view: View2D, opts: NetworkOptions): Network {
  const {
    layers,
    layerGap = 320,
    neuronGap = 140,
    origin = {x: 0, y: 0},
  } = opts;

  const neurons: Circle[][] = [];
  const linesPerLayer: Line[][] = [];

  for (let l = 0; l < layers.length; l++) {
    const count = layers[l];
    const layer: Circle[] = [];
    const x = origin.x + (l - (layers.length - 1) / 2) * layerGap;
    for (let n = 0; n < count; n++) {
      const y = origin.y + (n - (count - 1) / 2) * neuronGap;
      const ref = createRef<Circle>();
      view.add(<Neuron ref={ref} x={x} y={y} scale={0} />);
      layer.push(ref());
    }
    neurons.push(layer);
  }

  for (let l = 0; l < neurons.length - 1; l++) {
    const layerLines: Line[] = [];
    for (const a of neurons[l]) {
      for (const b of neurons[l + 1]) {
        const ref = createRef<Line>();
        view.add(
          <Line
            ref={ref}
            points={[a.position(), b.position()]}
            stroke={colors.edge}
            lineWidth={sizes.edgeWidth}
            end={0}
          />,
        );
        layerLines.push(ref());
      }
    }
    linesPerLayer.push(layerLines);
  }

  function* intro() {
    yield* all(...neurons.flat().map(n => n.scale(1, 0.5)));
    yield* all(...linesPerLayer.flat().map(l => l.end(1, 0.6)));
  }

  function* pulseNeuron(layer: number, index: number, duration = 0.4) {
    const n = neurons[layer][index];
    yield* n.fill(colors.active, duration / 2).to(colors.neuronFill, duration / 2);
  }

  function* pulseNeuronSubset(layer: number, indices: number[], dur = 0.45) {
    yield* pulseNeuronSubsetGen(neurons[layer], indices, colors.active, dur);
  }

  function* slideEdges(
    layerIdx: number,
    fromIdx: number[],
    toIdx: number[],
    dur = 0.55,
  ) {
    const lines = linesPerLayer[layerIdx];
    const toCount = neurons[layerIdx + 1].length;
    const targets: Line[] = [];
    for (const a of fromIdx) for (const b of toIdx) targets.push(lines[a * toCount + b]);
    yield* all(...targets.map(ln => slideEdgeHighlight(view, ln, colors.active, dur)));
  }

  function* fireTransition(
    layerIdx: number,
    fromIdx: number[],
    toIdx: number[],
    dur = 0.55,
  ) {
    yield* all(
      pulseNeuronSubsetGen(neurons[layerIdx], fromIdx, colors.active, dur),
      slideEdges(layerIdx, fromIdx, toIdx, dur),
      pulseNeuronSubsetGen(neurons[layerIdx + 1], toIdx, colors.active, dur),
    );
  }

  function* propagate({dur = 0.55} = {}) {
    // Fire all neurons in layer, then slide all lines, then next layer's neurons.
    for (let l = 0; l < neurons.length; l++) {
      const fromAll = neurons[l].map((_, i) => i);
      if (l < linesPerLayer.length) {
        const toAll = neurons[l + 1].map((_, i) => i);
        yield* all(
          pulseNeuronSubsetGen(neurons[l], fromAll, colors.active, dur),
          slideEdges(l, fromAll, toAll, dur),
        );
      } else {
        yield* pulseNeuronSubsetGen(neurons[l], fromAll, colors.active, dur);
      }
    }
  }

  return {
    view,
    neurons,
    linesPerLayer,
    intro,
    propagate,
    pulseNeuron,
    pulseNeuronSubset,
    slideEdges,
    fireTransition,
  };
}

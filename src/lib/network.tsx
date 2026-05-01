import {Circle, Line, View2D} from '@motion-canvas/2d';
import {createRef, all, chain, ThreadGenerator} from '@motion-canvas/core';
import {Neuron} from './neuron';
import {colors, sizes} from './theme';

export interface NetworkOptions {
  layers: number[];
  layerGap?: number;
  neuronGap?: number;
  origin?: {x: number; y: number};
}

export interface Network {
  neurons: Circle[][];
  linesPerLayer: Line[][];
  /** Reveal neurons (scale 0 → 1) then connections (end 0 → 1). */
  intro: () => ThreadGenerator;
  /** Pulse forward propagation through every layer. */
  propagate: (opts?: {pulseDuration?: number; fadeDuration?: number}) => ThreadGenerator;
  /** Highlight a specific neuron transiently. */
  pulseNeuron: (layer: number, index: number, duration?: number) => ThreadGenerator;
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

  function* propagate({pulseDuration = 0.25, fadeDuration = 0.4} = {}) {
    for (let l = 0; l < neurons.length; l++) {
      yield* all(
        ...neurons[l].map(n =>
          chain(
            n.fill(colors.active, pulseDuration),
            n.fill(colors.neuronFill, fadeDuration),
          ),
        ),
      );
      if (l < linesPerLayer.length) {
        yield* all(
          ...linesPerLayer[l].map(ln =>
            chain(
              ln.stroke(colors.active, pulseDuration),
              ln.stroke(colors.edge, fadeDuration),
            ),
          ),
        );
      }
    }
  }

  function* pulseNeuron(layer: number, index: number, duration = 0.4) {
    const n = neurons[layer][index];
    yield* chain(
      n.fill(colors.active, duration / 2),
      n.fill(colors.neuronFill, duration / 2),
    );
  }

  return {neurons, linesPerLayer, intro, propagate, pulseNeuron};
}

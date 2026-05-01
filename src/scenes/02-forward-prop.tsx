import {makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {colors, fonts, sizes} from '../lib/theme';
import {slide} from '../lib/slide';
import {buildNetwork} from '../lib/network';

export default makeScene2D(function* (view) {
  view.add(<Rect width={'100%'} height={'100%'} fill={colors.bg} zIndex={-100} />);

  const title = createRef<Txt>();
  view.add(
    <Txt
      ref={title}
      y={-380}
      fontSize={sizes.titleSize}
      fontFamily={fonts.sans}
      fill={colors.text}
      opacity={0}
      text={'Forward Propagation'}
    />,
  );

  const net = buildNetwork(view, {layers: [3, 4, 2]});

  yield* title().opacity(1, 0.6);
  yield* slide('fwd:title', `
    Frame the topic: how a signal moves through layers.
    Defer math; visual first.
  `);

  yield* net.intro();
  yield* slide('fwd:network-built', `
    3 input neurons, 4 hidden, 2 output. Fully connected.
    Mention: input = features, output = class scores.
  `);

  yield* net.propagate();
  yield* slide('fwd:propagated', `
    Cyan pulse = activation flowing layer by layer.
    Note: in real net each edge has weight, each neuron has activation fn.
    Next: zoom into one neuron.
  `);

  yield* waitFor(0.3);
});

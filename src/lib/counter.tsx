import {Txt, TxtProps} from '@motion-canvas/2d';
import {createRef, createSignal, tween, easeOutCubic, ThreadGenerator} from '@motion-canvas/core';

export interface CounterHandle {
  ref: ReturnType<typeof createRef<Txt>>;
  countTo: (target: number, duration?: number) => ThreadGenerator;
}

export function makeCounter(
  initial: number,
  decimals: number,
  suffix: string,
  txtProps: TxtProps,
): {node: any; handle: CounterHandle} {
  const ref = createRef<Txt>();
  const sig = createSignal(initial);
  const fmt = () => sig().toFixed(decimals) + suffix;
  const node = <Txt ref={ref} {...txtProps} text={fmt()} />;

  function* countTo(target: number, duration = 1.2): ThreadGenerator {
    const start = sig();
    yield* tween(duration, t => {
      const v = start + (target - start) * easeOutCubic(t);
      sig(v);
      ref().text(fmt());
    });
  }

  return {node, handle: {ref, countTo}};
}

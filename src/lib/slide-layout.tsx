import { Txt, View2D } from '@motion-canvas/2d';
import { createRef, Reference, ThreadGenerator } from '@motion-canvas/core';
import { colors, fonts, sizes } from './theme';

export interface SlideLayoutOpts {
  title: string;
  titleColor?: string;
  titleY?: number;
}

export interface SlideLayoutHandle {
  title: Reference<Txt>;
  showTitle: (dur?: number) => ThreadGenerator;
}

/** Standard slide layout: title at top centered. Content origin = (0, contentY). */
export function setupSlide(view: View2D, opts: SlideLayoutOpts): SlideLayoutHandle {
  const title = createRef<Txt>();
  view.add(
    <Txt
      ref={title}
      y={opts.titleY ?? -440}
      fontSize={sizes.titleSize}
      fontFamily={fonts.sans}
      fontWeight={900}
      fill={opts.titleColor ?? colors.text}
      opacity={0}
      text={opts.title}
    />,
  );

  function* showTitle(dur = 0.5): ThreadGenerator {
    yield* title().opacity(1, dur);
  }

  return { title, showTitle };
}

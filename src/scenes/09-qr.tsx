import { Img, makeScene2D } from '@motion-canvas/2d';
import { createRef, waitFor } from '@motion-canvas/core';
import { addBackground } from '../lib/bg';
import { slide } from '../lib/slide';
import qrSrc from '../assets/qr.svg';

export default makeScene2D(function* (view) {
  addBackground(view);

  const qr = createRef<Img>();
  view.add(
    <Img ref={qr} src={qrSrc} x={0} y={0} size={560} opacity={0} />,
  );

  yield* qr().opacity(1, 0.4);

  yield* slide('qr:end', `
    Final slide. QR code — scan to reach the resource.
  `, 'Stanislas');

  yield* waitFor(0.2);
});

import {Rect, View2D} from '@motion-canvas/2d';
import {colors} from './theme';

export function addBackground(view: View2D) {
  view.add(<Rect width={'100%'} height={'100%'} fill={colors.bg} zIndex={-100} />);
}

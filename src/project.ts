import {makeProject} from '@motion-canvas/core';

import intro from './scenes/01-intro?scene';
import forwardProp from './scenes/02-forward-prop?scene';

export default makeProject({
  scenes: [intro, forwardProp],
});

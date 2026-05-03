import {makeProject} from '@motion-canvas/core';

import intro from './scenes/01-intro?scene';
import polysemantic from './scenes/02-polysemantic?scene';
import sae from './scenes/03-sae?scene';
import results from './scenes/04-results?scene';
import attribPatching from './scenes/05-attrib-patching?scene';
import shift from './scenes/06-shift?scene';
import gemma from './scenes/07-gemma-result?scene';
import clustering from './scenes/08-clustering?scene';

export default makeProject({
  scenes: [intro, polysemantic, sae, results, attribPatching, shift, gemma, clustering],
});

import {makeProject} from '@motion-canvas/core';
import './fonts.css';

import intro from './scenes/01-intro?scene';
import polyAndSae from './scenes/02-polysemantic?scene';
import results from './scenes/04-results?scene';
import attribPatching from './scenes/05-attrib-patching?scene';
import integratedGradients from './scenes/05b-integrated-gradients?scene';
import circuitsFound from './scenes/05c-circuits-found?scene';
import shift from './scenes/06-shift?scene';
import gemma from './scenes/07-gemma-result?scene';
import clustering from './scenes/08-clustering?scene';

export default makeProject({
  scenes: [intro, polyAndSae, results, attribPatching, integratedGradients, circuitsFound, shift, gemma, clustering],
});

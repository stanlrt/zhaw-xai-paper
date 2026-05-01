/// <reference types="vite/client" />

declare module '*?scene' {
  import {FullSceneDescription} from '@motion-canvas/core';
  const scene: FullSceneDescription;
  export default scene;
}

declare module 'virtual:slide-notes' {
  const notes: Record<string, string>;
  export default notes;
}

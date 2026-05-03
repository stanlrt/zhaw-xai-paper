/// <reference types="vite/client" />

declare module '*?scene' {
  import {FullSceneDescription} from '@motion-canvas/core';
  const scene: FullSceneDescription;
  export default scene;
}

declare module 'virtual:slide-notes' {
  export interface SlideMeta {
    notes: string;
    owner?: string;
  }
  const notes: Record<string, SlideMeta>;
  export default notes;
}

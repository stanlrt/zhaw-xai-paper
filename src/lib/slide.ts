import {beginSlide} from '@motion-canvas/core';

/**
 * Slide marker with colocated presenter notes + owner.
 * `notes` and `owner` are ignored at runtime; harvested at build time
 * by the slide-notes Vite plugin.
 */
export function* slide(name: string, _notes?: string, _owner?: string) {
  yield* beginSlide(name);
}

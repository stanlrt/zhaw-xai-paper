import {beginSlide} from '@motion-canvas/core';

/**
 * Slide marker with colocated presenter notes.
 * `notes` is ignored at runtime; harvested by scripts/extract-notes.mjs.
 */
export function* slide(name: string, _notes?: string) {
  yield* beginSlide(name);
}

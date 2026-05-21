import {beginSlide} from '@motion-canvas/core';

/**
 * Slide marker with colocated presenter notes + owner.
 * `notes`, `owner` and `showInPrint` are ignored at runtime; harvested at
 * build time by the slide-notes Vite plugin.
 *
 * `showInPrint: true` forces this marker onto its own PDF-export page. Every
 * scene's final marker is exported anyway; use this for distinct slides that
 * share a scene with later markers (e.g. an MLP block before an SAE morph).
 */
export function* slide(
  name: string,
  _notes?: string,
  _owner?: string,
  _showInPrint?: boolean,
) {
  yield* beginSlide(name);
}

/**
 * Typen der Story-Themenuebersicht — App-Shim.
 *
 * Die Form liegt seit D1 (Plan `story-dreiteilung-fragenchronik`) in
 * `@ks/contracts`, weil das Paket `@ks/module-story` sie fuer Gliederung und
 * Themenkarten liest. Die 14 App-Nutzer importieren unveraendert von hier.
 */

export type { StoryTopicsData, StoryTopic, StoryQuestion } from '@ks/contracts'

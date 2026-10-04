/**
 * `@ks/module-story` — Story-Modul (Fragen-Chronik, Themenuebersicht,
 * Konversation; Plan `docs/plans/story-dreiteilung-fragenchronik.plan.md`).
 *
 * Dieses Barrel haelt den serverseitigen Teil: das Site-Gate. Es ist BEWUSST
 * frei von React (dieselbe Lehre wie beim Explorer, Build-Fehler nach M4b):
 * Wer hier Client-Code exportiert, zieht jede API-Route, die das Gate holt,
 * in den react-server-Layer.
 *
 * Die montierbaren Bausteine liegen unter `@ks/module-story/react`.
 */

export { storyGate, STORY_MODULE } from './api/gate'

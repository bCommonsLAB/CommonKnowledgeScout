/**
 * Ob der Perspektiv-Dialog der App offen ist (09.10.2026).
 *
 * Der Dialog ersetzt die Seiten `/explore/<slug>/perspective` und
 * `/library/gallery/perspective`. Geoeffnet wird er vom Story-Kopf
 * („Perspektive anpassen") und beim ersten Besuch des Story-Modus ohne
 * Perspektive; montiert ist er einmal je Galerie (`GalleryAppProviders`).
 */

import { atom } from 'jotai'

export const storyPerspektiveDialogOffenAtom = atom(false)
storyPerspektiveDialogOffenAtom.debugLabel = 'storyPerspektiveDialogOffenAtom'

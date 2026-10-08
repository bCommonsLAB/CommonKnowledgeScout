/**
 * @fileoverview Schreibweg von `transkript_korrigieren` (Wunschliste 7, B1).
 *
 * @description
 * Familie ueber die QUELLE aufloesen, das Transkript aus MongoDB laden (die
 * fuehrende Fassung), den Spiegel im `_`-Ordner gegen MongoDB UND gegen
 * `ifVersion` pruefen, die Ersetzungen auf den Body anwenden, Revisions-Felder
 * stempeln, nach MongoDB schreiben und danach NUR diese Familie versioniert in
 * den Spiegel exportieren.
 *
 * Warum nicht `datei_patchen` auf den Spiegel: Dann divergierten Spiegel und
 * MongoDB, bis jemand importiert — genau die Drift, die die `_`-Sperre
 * verhindert. Die Sperre bleibt; dieses Fachwerkzeug geht den Weg, den auch die
 * Kuration geht (`curation-patch.ts`): MongoDB zuerst, Spiegel als Export.
 *
 * Bewusst NICHT: Transformations-Bodies anfassen, Re-Transformation starten
 * (kostet Geld — die Antwort empfiehlt sie nur), einen fehlenden Spiegel
 * anlegen (dafuer `twins_synchronisieren export`).
 *
 * @module mcp
 */

import { sammleKorrekturen } from '@/lib/agent-view/korrekturen'
import { parseFrontmatter as parseFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { getShadowTwinsBySourceIds, readTranscriptRecord, type ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import { hasMirrorDrift } from '@/lib/shadow-twin/curation-plan'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { isVersionConflict, supportsVersioning, type StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'
import { normalisiere } from './storage/adressierung'
import { wendeKorrekturAn } from '@/lib/transkript-korrektur/anwenden'
import { schreibeTranskriptKorrektur, transformationenVon } from '@/lib/transkript-korrektur/schreiben'
import { abhaengigeSammeldateien } from '@/lib/shadow-twin/sammeldatei-abhaengigkeit'
import {
  KeinSpiegelError,
  KeinTranskriptError,
  REVISED_BY_BRUECKE,
  TranskriptKonfliktError,
  type KorrekturErgebnis,
  type KorrekturLauf,
} from './transkript-korrektur-typen'

/** Spiegel-Datei des Transkripts aufloesen — oder sagen, warum es keine gibt. */
async function spiegelAufloesen(args: {
  library: Library
  provider: StorageProvider
  doc: ShadowTwinDocument
}): Promise<{ fileId: string; pfad: string }> {
  const { library, provider, doc } = args
  if (!getShadowTwinConfig(library).persistToFilesystem) {
    throw new KeinSpiegelError(
      'Diese Library fuehrt keinen Spiegel (persistToFilesystem=false) — ohne Spiegel gibt es keine ' +
        'Version, gegen die ifVersion gepruft werden koennte. Transkripte dieser Library werden ueber die KS-Oberflaeche korrigiert.',
    )
  }
  const resolved = await resolveArtifact(provider, {
    sourceItemId: doc.sourceId, sourceName: doc.sourceName, parentId: doc.parentId,
    targetLanguage: '', preferredKind: 'transcript',
  })
  if (!resolved) {
    throw new KeinSpiegelError(
      `Kein Spiegel fuer das Transkript von "${doc.sourceName}" im Storage — zuerst twins_synchronisieren ` +
        '(preset export) fuer den Ordner, dann ifVersion aus datei_lesen nehmen.',
    )
  }
  if (resolved.location !== 'dotFolder') {
    throw new KeinSpiegelError(
      `Der Spiegel "${resolved.fileName}" liegt in Alt-Form neben der Quelle, nicht im "_"-Ordner — ` +
        'zuerst twins_synchronisieren (import, dann repair) migrieren.',
    )
  }
  return { fileId: resolved.fileId, pfad: normalisiere(await provider.getPathById(resolved.fileId)) }
}

/**
 * Fuehrt EINE Korrektur aus (oder rendert sie als Vorschau). Wirft typisierte
 * Fehler; in jedem Fehlerfall vor dem Mongo-Write ist NICHTS geschrieben.
 */
export async function korrigiereTranskript(args: KorrekturLauf): Promise<KorrekturErgebnis> {
  const { library, userEmail, provider, source, ifVersion } = args
  const now = args.now ?? (() => new Date().toISOString())

  const docs = await getShadowTwinsBySourceIds({ libraryId: library.id, sourceIds: [source.itemId] })
  const doc = docs.get(source.itemId)
  if (!doc) throw new KeinTranskriptError(`Keine Twin-Familie fuer "${source.name}" — zuerst quelle_erschliessen.`)
  const record = readTranscriptRecord(doc)
  if (!record) throw new KeinTranskriptError(`Die Familie von "${source.name}" hat kein Transkript — zuerst quelle_erschliessen.`)

  if (!supportsVersioning(provider)) {
    throw new Error(`Storage-Provider "${provider.name}" kann nicht versioniert schreiben — es wurde NICHTS geaendert.`)
  }
  const spiegel = await spiegelAufloesen({ library, provider, doc })

  // Drift-Guard VOR dem Versions-Vergleich: Weicht der Spiegel ab, hat jemand
  // von Hand korrigiert — das darf keine Bruecken-Korrektur still ueberschreiben.
  const spiegelItem = await provider.getItemById(spiegel.fileId)
  const spiegelText = await (await provider.getBinary(spiegel.fileId)).blob.text()
  if (hasMirrorDrift({ mongoMarkdown: record.markdown, mirrorMarkdown: spiegelText })) {
    throw new TranskriptKonfliktError(
      `Spiegel "${spiegel.pfad}" weicht vom MongoDB-Stand ab — vermutlich eine Handkorrektur. Nichts geschrieben.`,
      { aktuelleVersion: spiegelItem.metadata.version ?? null, hinweis: 'twins_synchronisieren (preset import) fuer diesen Ordner zuerst, dann erneut korrigieren.' },
    )
  }
  const aktuelleVersion = spiegelItem.metadata.version
  if (aktuelleVersion === undefined) {
    throw new Error(`Storage-Provider "${provider.name}" liefert fuer "${spiegel.pfad}" keine Version — kann nicht versioniert schreiben.`)
  }
  if (aktuelleVersion !== ifVersion) {
    throw new TranskriptKonfliktError(
      `ifVersion "${ifVersion}" ist veraltet — "${spiegel.pfad}" traegt Version "${aktuelleVersion}". Nichts geschrieben.`,
      { erwarteteVersion: ifVersion, aktuelleVersion, hinweis: 'Transkript mit datei_lesen neu lesen und mit aktuelleVersion als ifVersion erneut aufrufen.' },
    )
  }

  const revision = { revised_by: REVISED_BY_BRUECKE, revised_at: now(), revision_note: args.begruendung }
  // Kern (P3b, gemeinsam mit dem Reiter „Korrektur"): `generated_*` bleibt,
  // die drei Revisions-Felder kommen dazu. Die Bruecke kennt keine Sprecher-Zuordnung.
  const { markdownNeu, belege } = wendeKorrekturAn({
    markdown: record.markdown, ersetzungen: args.ersetzungen, sprecher: [], revision,
  })
  const { meta } = parseFrontmatterMeta(record.markdown)

  const twinOrdnerPfad = spiegel.pfad.split('/').slice(0, -1).join('/')
  const offene = sammleKorrekturen([{ sourceId: doc.sourceId, sourceName: doc.sourceName, parentId: doc.parentId, transkript: meta }])
    .filter((auftrag) => auftrag.kind === 'transcript')
    .map((auftrag) => ({ auftrag: auftrag.auftrag, von: auftrag.von, at: auftrag.at }))
  // Welle E: Sammeldateien mit dieser Quelle — nach der Korrektur sind ihre Transformationen ueberholt.
  const abhaengige = (await abhaengigeSammeldateien({ libraryId: library.id, sourceId: doc.sourceId, revisedAt: revision.revised_at }))
    .map((a) => ({ sourceId: a.sourceId, sourceName: a.sourceName, ueberholt: a.ueberholt, ohneTransformation: a.ohneTransformation }))
  const basis = {
    pfad: spiegel.pfad, id: spiegel.fileId, versionVorher: ifVersion, ersetzungen: belege, revision,
    transformationen: transformationenVon(doc, twinOrdnerPfad), offeneKorrekturauftraege: offene,
    abhaengigeSammeldateien: abhaengige,
  }
  if (args.nurVorschau) return { ...basis, geschrieben: false, versionNachher: null }

  // 1. MongoDB (fuehrend) — ohne den Spiegel-Write des Services: der ist
  //    unversioniert und verschluckt Fehler; der Export folgt gleich versioniert.
  await schreibeTranskriptKorrektur({
    library, userEmail, provider, doc, markdownNeu, skipFilesystemMirror: true,
  })

  // 2. Nur diese Familie in den Spiegel — mit ifVersion als Riegel.
  let ergebnis
  try {
    ergebnis = await provider.updateFile(spiegel.fileId, new Blob([markdownNeu], { type: 'text/markdown' }), { ifVersion })
  } catch (fehler) {
    if (!isVersionConflict(fehler)) throw fehler
    throw new TranskriptKonfliktError(
      `Spiegel "${spiegel.pfad}" wurde zwischen Pruefung und Export geaendert (${fehler.message}).`,
      {
        erwarteteVersion: fehler.expectedVersion, aktuelleVersion: fehler.currentVersion, mongoGeschrieben: true,
        hinweis: 'MongoDB traegt die Korrektur bereits. Spiegel mit twins_synchronisieren (preset export) nachziehen — NICHT erneut korrigieren.',
      },
    )
  }
  return { ...basis, id: ergebnis.id, geschrieben: true, versionNachher: ergebnis.version }
}

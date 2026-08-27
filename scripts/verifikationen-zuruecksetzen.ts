/**
 * @fileoverview Uebergang zu ADR 0006: Stempel aus Sammelaktionen zuruecknehmen.
 *
 * @description
 * Bis ADR 0006 verifizierte EIN Klick per Sammelaktion Dutzende Artefakte.
 * Unter Modell B heisst der gruene Haken „ein Mensch hat hingesehen" — bei
 * einer Massen-Bestaetigung ist das unwahr. Dieses Skript nimmt genau diese
 * Stempel zurueck und laesst Einzelklicks stehen; unterschieden wird am Takt
 * (`sammelaktion-stempel.ts`, Regel aus der Messung vom 26.08.2026).
 *
 * Geschrieben wird ueber den BESTEHENDEN Kurations-Weg
 * (`applyCurationPatch`) — also mit Spiegel-Drift-Guard und Spiegel-Write,
 * kein Direktschreiben an der Mongo vorbei. Ein Drift-Befund stoppt die
 * betroffene Datei sichtbar, statt sie zu ueberschreiben.
 *
 * @usage
 * ```powershell
 * # Trockenlauf (schreibt nichts, zeigt jeden Schwung):
 * pnpm tsx scripts/verifikationen-zuruecksetzen.ts --library="Onedrive Test" --userEmail=<mail>
 *
 * # Nach Sichtung wirklich zuruecksetzen:
 * pnpm tsx scripts/verifikationen-zuruecksetzen.ts --library="Onedrive Test" --userEmail=<mail> --schreiben
 *
 * `--library` matcht auf den Namen (Teilstring, gross/klein egal); wer die Id
 * kennt, nimmt `--libraryId=<uuid>`.
 * ```
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import {
  getAllShadowTwins,
  readTranscriptRecord,
  type ShadowTwinArtifactRecord,
  type ShadowTwinDocument,
} from '@/lib/repositories/shadow-twin-repo'
import { LibraryService } from '@/lib/services/library-service'
import { applyCurationPatch } from '@/lib/shadow-twin/curation-patch'
import type { CurationArtifactRef } from '@/lib/shadow-twin/curation-plan'
import {
  baueSchwuenge,
  type VerifikationsStempel,
} from '@/lib/shadow-twin/sammelaktion-stempel'

interface Optionen {
  /** Genau eines von beiden ist gesetzt. */
  libraryId: string
  libraryName: string
  userEmail: string
  schreiben: boolean
}

function leseOptionen(argv: readonly string[]): Optionen {
  const wert = (name: string): string => {
    const treffer = argv.find((arg) => arg.startsWith(`--${name}=`))
    return treffer === undefined ? '' : treffer.slice(name.length + 3).trim()
  }
  const libraryId = wert('libraryId')
  const libraryName = wert('library')
  const userEmail = wert('userEmail')
  if ((libraryId === '' && libraryName === '') || userEmail === '') {
    throw new Error(
      'Aufruf: pnpm tsx scripts/verifikationen-zuruecksetzen.ts ' +
        '(--libraryId=<uuid> | --library="<Name>") --userEmail=<mail> [--schreiben]',
    )
  }
  return { libraryId, libraryName, userEmail, schreiben: argv.includes('--schreiben') }
}

/** Bibliothek per Id ODER per Namen — beides benannt, nie geraten. */
async function findeBibliothek(optionen: Optionen) {
  const alle = await LibraryService.getInstance().getUserLibraries(optionen.userEmail)
  if (optionen.libraryId !== '') {
    const treffer = alle.find((library) => library.id === optionen.libraryId)
    if (!treffer) throw new Error(`Bibliothek ${optionen.libraryId} fuer ${optionen.userEmail} nicht gefunden`)
    return treffer
  }
  const suche = optionen.libraryName.toLowerCase()
  const treffer = alle.filter((library) => library.label.toLowerCase().includes(suche))
  if (treffer.length === 0) {
    throw new Error(
      `Keine Bibliothek passt auf „${optionen.libraryName}". Vorhanden: ${alle.map((l) => l.label).join(', ')}`,
    )
  }
  if (treffer.length > 1) {
    throw new Error(
      `Mehrdeutig — „${optionen.libraryName}" passt auf: ${treffer.map((l) => l.label).join(', ')}`,
    )
  }
  return treffer[0]
}

function metaVon(record: ShadowTwinArtifactRecord): Record<string, unknown> {
  return record.frontmatter ?? parseFrontmatter(record.markdown).meta
}

function textOderNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/** Alle `verified_by`-Stempel eines Twin-Dokuments — mit ihrer Artefakt-Adresse. */
function stempelVon(doc: ShadowTwinDocument): { stempel: VerifikationsStempel; ref: CurationArtifactRef }[] {
  const gefunden: { stempel: VerifikationsStempel; ref: CurationArtifactRef }[] = []

  const nimm = (
    record: ShadowTwinArtifactRecord,
    kind: 'transcript' | 'transformation',
    templateName: string | null,
    targetLanguage: string,
  ) => {
    const meta = metaVon(record)
    const verifiedBy = textOderNull(meta['verified_by'])
    const verifiedAt = textOderNull(meta['verified_at'])
    // Ein Stempel ohne Zeit ist nicht einordbar — er bleibt unangetastet.
    if (verifiedBy === null || verifiedAt === null) return
    gefunden.push({
      stempel: {
        sourceId: doc.sourceId,
        sourceName: doc.sourceName,
        kind,
        templateName,
        targetLanguage,
        verifiedBy,
        verifiedAt,
      },
      ref: { kind, targetLanguage, templateName: templateName ?? undefined },
    })
  }

  const transkript = readTranscriptRecord(doc)
  if (transkript) nimm(transkript, 'transcript', null, '')

  for (const [template, sprachen] of Object.entries(doc.artifacts?.transformation ?? {})) {
    for (const [sprache, record] of Object.entries(sprachen)) {
      if (record && typeof record.markdown === 'string') nimm(record, 'transformation', template, sprache)
    }
  }
  return gefunden
}

async function main(): Promise<void> {
  const optionen = leseOptionen(process.argv.slice(2))

  const library = await findeBibliothek(optionen)
  const docs = await getAllShadowTwins(library.id)
  const alle = docs.flatMap(stempelVon)
  const adresseVon = new Map(
    alle.map((eintrag) => [schluessel(eintrag.stempel), eintrag.ref] as const),
  )
  const { schwuenge, ohneZeit } = baueSchwuenge(alle.map((eintrag) => eintrag.stempel))

  console.log(`Bibliothek „${library.label}" · ${docs.length} Twin-Familien · ${alle.length} Stempel`)
  if (ohneZeit.length > 0) {
    console.log(`  ${ohneZeit.length} Stempel ohne lesbare Zeit — unangetastet:`)
    for (const s of ohneZeit) console.log(`    ${s.sourceName} (${s.verifiedAt})`)
  }

  const sortiert = [...schwuenge].sort((a, b) => a.von.localeCompare(b.von))
  console.log('\nSchwuenge (Takt entscheidet):')
  for (const schwung of sortiert) {
    const marke = schwung.istSammelaktion ? 'SAMMELAKTION → zuruecksetzen' : 'Einzelklicks → bleiben'
    console.log(`  ${schwung.von} – ${schwung.bis} · ${schwung.stempel.length}× ${schwung.art} · ${marke}`)
  }

  const zuruecksetzen = sortiert.filter((s) => s.istSammelaktion).flatMap((s) => s.stempel)
  console.log(`\n${zuruecksetzen.length} Stempel stammen aus Sammelaktionen.`)

  if (!optionen.schreiben) {
    console.log('Trockenlauf — nichts geschrieben. Mit --schreiben wirklich zuruecksetzen.')
    return
  }

  let erledigt = 0
  const fehler: string[] = []
  for (const stempel of zuruecksetzen) {
    const ref = adresseVon.get(schluessel(stempel))
    if (ref === undefined) {
      fehler.push(`${stempel.sourceName}: Artefakt-Adresse nicht mehr auffindbar`)
      continue
    }
    try {
      await applyCurationPatch({
        library,
        userEmail: optionen.userEmail,
        sourceId: stempel.sourceId,
        artifact: ref,
        verify: false,
        entferneVerifikation: true,
      })
      erledigt += 1
      console.log(`  zurueckgesetzt: ${stempel.sourceName} (${ref.kind})`)
    } catch (error) {
      fehler.push(`${stempel.sourceName}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log(`\nFertig: ${erledigt} zurueckgesetzt, ${fehler.length} fehlgeschlagen.`)
  for (const zeile of fehler) console.log(`  FEHLER ${zeile}`)
  if (fehler.length > 0) process.exitCode = 1
}

/** Eindeutige Adresse eines Stempels (Quelle + Artefakt). */
function schluessel(stempel: VerifikationsStempel): string {
  return `${stempel.sourceId}|${stempel.kind}|${stempel.templateName ?? ''}|${stempel.targetLanguage}`
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })

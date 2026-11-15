/**
 * @fileoverview Testdaten fuer das Sitzungs-Register (R1): Register-Zeilen und Ist-Belege.
 */

import type { IstBeleg, SitzungsRegisterDoc } from '@/lib/agent-view/sitzungen-register/types'

export const LIB = 'lib-archiv'
export const JETZT = '2026-11-15T12:00:00.000Z'
/** Volle Kennungen (UUID-Laenge) und eine Cloud-Kennung. */
export const K1 = '0b6c2f8e-1a2b-4c3d-8e9f-a1b2c3d4e5f6'
export const K2 = '7d1e4a90-5b6c-4d7e-9f80-112233445566'
export const K_CLOUD = 'session_01ABCDEFGHJKMNPQRSTVWXYZ0'

export function doc(o: Partial<SitzungsRegisterDoc> = {}): SitzungsRegisterDoc {
  return {
    libraryId: LIB,
    registerId: K1,
    sitzungId: K1,
    kennung: 'voll',
    quelle: 'code_lokal',
    titelOriginal: 'Sitzungsregister',
    beginn: '2026-11-15',
    ende: null,
    link: null,
    repo: null,
    branch: null,
    prs: [],
    nrAlt: null,
    entscheidung: 'offen',
    entscheidungGrund: null,
    zugbereiche: [],
    vorhabenVorschlag: null,
    bemerkung: null,
    belegSourceIds: [],
    altNotizPfad: null,
    ablage: null,
    berichtet: { chronikAm: null, blockAm: null },
    gemeldetVon: 'skill',
    gemeldetAm: '2026-11-15T08:00:00.000Z',
    geaendertAm: '2026-11-15T08:00:00.000Z',
    ...o,
  }
}

export function beleg(o: Partial<IstBeleg> = {}): IstBeleg {
  return {
    sourceId: 'src-1',
    name: '2026-11-15 Code Sitzungsregister.md',
    parentId: 'v-ks',
    kopfKennung: K1,
    notizKennung: K1,
    werkzeug: 'code',
    repo: null,
    branch: null,
    zuege: { von: 1, bis: 20 },
    titel: 'Sitzungsregister',
    datum: '2026-11-15',
    ende: null,
    hatNotiz: true,
    notizAktualisiert: '2026-11-15T10:00:00.000Z',
    ...o,
  }
}

/** Ablage, wie ein Sichten-Lauf sie geschrieben hat. */
export const ABLAGE_KS = {
  vorhabenPfad: '6. Lab/24.09 KnowledgeScout',
  vorhabenFolderId: 'v-ks',
  belegOrdnerPfad: '6. Lab/24.09 KnowledgeScout',
  geprueftAm: '2026-11-15T11:00:00.000Z',
}

/**
 * @fileoverview Zeilen 12–19 des Entscheidungskatalogs: Gewicht „spaeter" —
 * die Vorgabe reicht, gefragt wird nur in den Settings (Plan
 * speicher-verbindungen-und-library-anlage §5, Owner-Entscheid E6).
 *
 * @module library-setup
 */

import type { Library } from '@/types/library'
import type { Entscheidung } from './typen'

function secretary(library: Library) {
  return library.config?.secretaryService
}

export const ENTSCHEIDUNGEN_SPAETER: readonly Entscheidung[] = [
  {
    nr: 12, schluessel: 'zielsprache', titel: 'Zielsprache der Transformation',
    frage: 'In welcher Sprache sollen Transformationen geschrieben werden?',
    gewicht: 'spaeter', schritt: 'settings', feldpfade: ['config.secretaryService.targetLanguage'], giltWenn: 'immer',
    vorgabe: 'Pipeline-Vorgabe', optionen: [{ wert: 'de', label: 'Deutsch' }, { wert: 'en', label: 'Englisch' }],
    beantwortet: (l) => secretary(l)?.targetLanguage !== undefined,
  },
  {
    nr: 13, schluessel: 'vorlage', titel: 'Vorlage (Journalist) statt Standard',
    frage: 'Soll eine eigene Vorlage statt der Standard-Vorlage des Inhaltstyps transformieren?',
    gewicht: 'spaeter', schritt: 'settings', feldpfade: ['config.secretaryService.template'], giltWenn: 'immer',
    vorgabe: 'Standard-Vorlage des Inhaltstyps (standard-<typ>)',
    beantwortet: (l) => secretary(l)?.template !== undefined,
  },
  {
    nr: 14, schluessel: 'pdfMethode', titel: 'PDF-Extraktionsmethode',
    frage: 'Wie soll Text aus PDFs gewonnen werden?',
    gewicht: 'spaeter', schritt: 'settings', feldpfade: ['config.secretaryService.pdfExtractionMethod'], giltWenn: 'immer',
    vorgabe: 'mistral_ocr',
    beantwortet: (l) => secretary(l)?.pdfExtractionMethod !== undefined,
  },
  {
    nr: 15, schluessel: 'coverBild', titel: 'Cover-Bild generieren',
    frage: 'Soll bei der Transformation ein Cover-Bild erzeugt werden, und mit welchem Prompt?',
    gewicht: 'spaeter', schritt: 'settings',
    feldpfade: ['config.secretaryService.generateCoverImage', 'config.secretaryService.coverImagePrompt'], giltWenn: 'immer',
    vorgabe: 'aus',
    beantwortet: (l) => secretary(l)?.generateCoverImage !== undefined,
  },
  {
    nr: 16, schluessel: 'perspektive', titel: 'Perspektive',
    frage: 'Aus welcher Perspektive (Charakter, sozialer Kontext) soll der Story-Modus antworten?',
    gewicht: 'spaeter', schritt: 'settings', feldpfade: ['config.chat.character', 'config.chat.socialContext'], giltWenn: 'immer',
    vorgabe: 'Vorgabe des Chats',
    beantwortet: (l) => l.config?.chat?.character !== undefined || l.config?.chat?.socialContext !== undefined,
  },
  {
    nr: 17, schluessel: 'modelle', titel: 'Modelle Chat/Embeddings (Experte)',
    frage: 'Welche Modelle fuer Chat und Embeddings? Achtung: das Embedding-Modell ist nach dem ersten Ingest fest.',
    gewicht: 'spaeter', schritt: 'settings', feldpfade: ['config.chat.models', 'config.chat.embeddings'], giltWenn: 'immer',
    vorgabe: 'Umgebung (Modelle des Servers)',
    beantwortet: (l) => l.config?.chat?.models !== undefined || l.config?.chat?.embeddings !== undefined,
  },
  {
    nr: 18, schluessel: 'veroeffentlichung', titel: 'Veröffentlichung, Übersetzungen',
    frage: 'Soll die Library oeffentlich erscheinen, und in welche Sprachen wird uebersetzt?',
    gewicht: 'spaeter', schritt: 'settings', feldpfade: ['config.publicPublishing', 'config.translations'], giltWenn: 'immer',
    vorgabe: 'privat, keine Übersetzungen',
    beantwortet: (l) => l.config?.publicPublishing !== undefined || l.config?.translations !== undefined,
  },
  {
    nr: 19, schluessel: 'agentensichtDiva', titel: 'Agentensicht, DIVA',
    frage: 'Ist das eine Archiv-Library (Agentensicht) oder eine DIVA-Library?',
    gewicht: 'spaeter', schritt: 'settings', feldpfade: ['config.agentView.enabled', 'config.divaArchiveDefaults'],
    giltWenn: 'Archiv-Libraries, DIVA-Libraries', vorgabe: 'aus',
    beantwortet: (l) => l.config?.agentView?.enabled !== undefined || l.config?.divaArchiveDefaults !== undefined,
  },
]

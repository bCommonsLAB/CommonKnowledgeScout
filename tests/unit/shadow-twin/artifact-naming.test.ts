/**
 * @fileoverview Unit-Tests für Artefakt-Namenskonventionen
 * 
 * @description
 * Testet Parser/Builder Roundtrip, Eindeutigkeit und Stabilität bei Re-Runs.
 */

import { describe, it, expect } from 'vitest';
import {
  parseArtifactName,
  buildArtifactName,
  extractBaseName,
  artifactKeysEqual,
} from '@/lib/shadow-twin/artifact-naming';
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types';

describe('extractBaseName', () => {
  it('sollte Basisname aus einfachem Transcript extrahieren', () => {
    expect(extractBaseName('audio.de.md')).toBe('audio');
    expect(extractBaseName('document.en.md')).toBe('document');
  });

  it('sollte Basisname aus Transformation extrahieren', () => {
    expect(extractBaseName('audio.Besprechung.de.md')).toBe('audio');
    expect(extractBaseName('document.Zusammenfassung.en.md')).toBe('document');
  });

  it('sollte Basisname mit Punkten im Namen behandeln', () => {
    expect(extractBaseName('file.name.Besprechung.de.md')).toBe('file.name');
    expect(extractBaseName('vs..Besprechung.de.md')).toBe('vs.');
  });

  it('sollte Basisname ohne Extension behandeln', () => {
    expect(extractBaseName('audio.de')).toBe('audio');
    expect(extractBaseName('audio')).toBe('audio');
  });
});

describe('parseArtifactName', () => {
  it('sollte einfaches Transcript parsen', () => {
    const parsed = parseArtifactName('audio.de.md', 'audio');
    expect(parsed.kind).toBe('transcript');
    expect(parsed.targetLanguage).toBe('de');
    expect(parsed.templateName).toBeNull();
    expect(parsed.baseName).toBe('audio');
  });

  it('sollte Transformation mit Template parsen', () => {
    const parsed = parseArtifactName('audio.Besprechung.de.md', 'audio');
    expect(parsed.kind).toBe('transformation');
    expect(parsed.targetLanguage).toBe('de');
    expect(parsed.templateName).toBe('Besprechung');
    expect(parsed.baseName).toBe('audio');
  });

  it('sollte verschiedene Sprachen erkennen', () => {
    expect(parseArtifactName('audio.de.md', 'audio').targetLanguage).toBe('de');
    expect(parseArtifactName('audio.en.md', 'audio').targetLanguage).toBe('en');
    expect(parseArtifactName('audio.fr.md', 'audio').targetLanguage).toBe('fr');
  });

  it('sollte Template-Namen mit Punkten behandeln', () => {
    const parsed = parseArtifactName('file.name.Besprechung.de.md', 'file.name');
    expect(parsed.kind).toBe('transformation');
    expect(parsed.templateName).toBe('Besprechung');
    expect(parsed.baseName).toBe('file.name');
  });

  it('sollte Legacy-Format ohne Language-Suffix erkennen', () => {
    const parsed = parseArtifactName('audio.md', 'audio');
    // Kann als Transcript interpretiert werden (Originalsprache)
    expect(parsed.kind).toBe('transcript');
    expect(parsed.targetLanguage).toBeNull();
  });
});

describe('buildArtifactName', () => {
  it('sollte Transcript-Dateinamen generieren', () => {
    const key: ArtifactKey = {
      sourceId: 'source-123',
      kind: 'transcript',
      targetLanguage: 'de',
    };
    expect(buildArtifactName(key, 'audio.mp3')).toBe('audio.de.md');
    expect(buildArtifactName(key, 'document.pdf')).toBe('document.de.md');
  });

  it('sollte Transformation-Dateinamen generieren', () => {
    const key: ArtifactKey = {
      sourceId: 'source-123',
      kind: 'transformation',
      targetLanguage: 'de',
      templateName: 'Besprechung',
    };
    expect(buildArtifactName(key, 'audio.mp3')).toBe('audio.Besprechung.de.md');
    expect(buildArtifactName(key, 'document.pdf')).toBe('document.Besprechung.de.md');
  });

  it('sollte Fehler werfen wenn templateName bei Transformation fehlt', () => {
    const key: ArtifactKey = {
      sourceId: 'source-123',
      kind: 'transformation',
      targetLanguage: 'de',
      // templateName fehlt
    };
    expect(() => buildArtifactName(key, 'audio.mp3')).toThrow('templateName is required');
  });

  it('sollte Dateinamen mit Punkten behandeln', () => {
    const key: ArtifactKey = {
      sourceId: 'source-123',
      kind: 'transcript',
      targetLanguage: 'de',
    };
    expect(buildArtifactName(key, 'file.name.pdf')).toBe('file.name.de.md');
  });
});

describe('Parser/Builder Roundtrip', () => {
  it('sollte Roundtrip für Transcript durchführen', () => {
    const sourceFileName = 'audio.mp3';
    const key: ArtifactKey = {
      sourceId: 'source-123',
      kind: 'transcript',
      targetLanguage: 'de',
    };
    
    const built = buildArtifactName(key, sourceFileName);
    const parsed = parseArtifactName(built, 'audio');
    
    expect(parsed.kind).toBe(key.kind);
    expect(parsed.targetLanguage).toBe(key.targetLanguage);
    expect(parsed.templateName).toBeNull();
  });

  it('sollte Roundtrip für Transformation durchführen', () => {
    const sourceFileName = 'audio.mp3';
    const key: ArtifactKey = {
      sourceId: 'source-123',
      kind: 'transformation',
      targetLanguage: 'de',
      templateName: 'Besprechung',
    };
    
    const built = buildArtifactName(key, sourceFileName);
    const parsed = parseArtifactName(built, 'audio');
    
    expect(parsed.kind).toBe(key.kind);
    expect(parsed.targetLanguage).toBe(key.targetLanguage);
    expect(parsed.templateName).toBe(key.templateName);
  });
});

describe('Eindeutigkeit', () => {
  it('sollte Transcript und Transformation unterscheiden', () => {
    const transcriptKey: ArtifactKey = {
      sourceId: 'source-123',
      kind: 'transcript',
      targetLanguage: 'de',
    };
    
    const transformationKey: ArtifactKey = {
      sourceId: 'source-123',
      kind: 'transformation',
      targetLanguage: 'de',
      templateName: 'Besprechung',
    };
    
    const transcriptName = buildArtifactName(transcriptKey, 'audio.mp3');
    const transformationName = buildArtifactName(transformationKey, 'audio.mp3');
    
    expect(transcriptName).not.toBe(transformationName);
    expect(transcriptName).toBe('audio.de.md');
    expect(transformationName).toBe('audio.Besprechung.de.md');
  });

  it('sollte verschiedene Templates unterscheiden', () => {
    const key1: ArtifactKey = {
      sourceId: 'source-123',
      kind: 'transformation',
      targetLanguage: 'de',
      templateName: 'Besprechung',
    };
    
    const key2: ArtifactKey = {
      sourceId: 'source-123',
      kind: 'transformation',
      targetLanguage: 'de',
      templateName: 'Zusammenfassung',
    };
    
    const name1 = buildArtifactName(key1, 'audio.mp3');
    const name2 = buildArtifactName(key2, 'audio.mp3');
    
    expect(name1).not.toBe(name2);
  });

  it('sollte verschiedene Sprachen unterscheiden', () => {
    const key1: ArtifactKey = {
      sourceId: 'source-123',
      kind: 'transcript',
      targetLanguage: 'de',
    };
    
    const key2: ArtifactKey = {
      sourceId: 'source-123',
      kind: 'transcript',
      targetLanguage: 'en',
    };
    
    const name1 = buildArtifactName(key1, 'audio.mp3');
    const name2 = buildArtifactName(key2, 'audio.mp3');
    
    expect(name1).not.toBe(name2);
  });
});

describe('Stabilität bei Re-Runs', () => {
  it('sollte gleichen ArtifactKey zu gleichem Dateinamen führen', () => {
    const key: ArtifactKey = {
      sourceId: 'source-123',
      kind: 'transformation',
      targetLanguage: 'de',
      templateName: 'Besprechung',
    };
    
    const name1 = buildArtifactName(key, 'audio.mp3');
    const name2 = buildArtifactName(key, 'audio.mp3');
    
    expect(name1).toBe(name2);
  });

  it('sollte artifactKeysEqual korrekt vergleichen', () => {
    const key1: ArtifactKey = {
      sourceId: 'source-123',
      kind: 'transcript',
      targetLanguage: 'de',
    };
    
    const key2: ArtifactKey = {
      sourceId: 'source-123',
      kind: 'transcript',
      targetLanguage: 'de',
    };
    
    const key3: ArtifactKey = {
      sourceId: 'source-456',
      kind: 'transcript',
      targetLanguage: 'de',
    };
    
    expect(artifactKeysEqual(key1, key2)).toBe(true);
    expect(artifactKeysEqual(key1, key3)).toBe(false);
  });
});





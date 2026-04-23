/**
 * @fileoverview Tests fuer resolveLibrarySecretaryConfig
 *
 * Hintergrund: Bisher gab es zwei parallele Konfig-Aufloesungen
 *   - POST in `start/route.ts` mit `useCustomConfig`-Gate
 *   - Callback in `route.ts` ohne Gate
 * Folge war ein Konfig-Drift: POST an ENV-URL, Downloads an Library-apiUrl -> 404.
 *
 * Diese Tests sichern, dass der zentrale Resolver alle vier relevanten Faelle
 * deterministisch und konsistent behandelt, sodass alle Aufrufer dieselbe
 * Wahrheit sehen.
 */

import { describe, expect, it } from 'vitest'
import { resolveLibrarySecretaryConfig } from '@/lib/external-jobs/secretary-url'

describe('resolveLibrarySecretaryConfig', () => {
  it('liefert leeren Override und source=env, wenn keine Library uebergeben wird', () => {
    const r = resolveLibrarySecretaryConfig(undefined)
    expect(r.override).toEqual({})
    expect(r.effective).toBeUndefined()
    expect(r.source).toBe('env')
  })

  it('liefert leeren Override und source=env, wenn library.config.secretaryService fehlt', () => {
    const r = resolveLibrarySecretaryConfig({ config: {} })
    expect(r.override).toEqual({})
    expect(r.effective).toBeUndefined()
    expect(r.source).toBe('env')
  })

  it('liefert Override und source=library-custom, wenn useCustomConfig=true und apiUrl gesetzt', () => {
    const r = resolveLibrarySecretaryConfig({
      config: {
        secretaryService: {
          useCustomConfig: true,
          apiUrl: 'https://custom.example.com/api',
          apiKey: 'secret-key',
          template: 'mytemplate',
        },
      },
    })
    expect(r.override).toEqual({
      overrideBaseUrl: 'https://custom.example.com/api',
      overrideApiKey: 'secret-key',
    })
    expect(r.effective?.apiUrl).toBe('https://custom.example.com/api')
    expect(r.effective?.template).toBe('mytemplate')
    expect(r.source).toBe('library-custom')
  })

  it('faellt auf ENV zurueck, wenn useCustomConfig=false (auch wenn apiUrl gespeichert ist)', () => {
    // Das ist der zentrale Bug-Fix: vorher wurde apiUrl aus der Library
    // unkonditional verwendet, obwohl useCustomConfig=false war.
    const r = resolveLibrarySecretaryConfig({
      config: {
        secretaryService: {
          useCustomConfig: false,
          apiUrl: 'https://stale-remote.example.com/api',
          apiKey: 'old-key',
          template: 'mytemplate',
          useDirectConnection: true,
        },
      },
    })
    expect(r.override).toEqual({})
    expect(r.source).toBe('env')
    // Verbindungsfelder sind in `effective` geleert, damit nachgelagerter Code
    // nicht versehentlich die ruhenden Werte verwendet.
    expect(r.effective?.apiUrl).toBe('')
    expect(r.effective?.apiKey).toBe('')
    // useDirectConnection wird ebenfalls deaktiviert (gilt nur mit Custom-Config).
    expect(r.effective?.useDirectConnection).toBe(false)
    // Transformations-Felder bleiben erhalten.
    expect(r.effective?.template).toBe('mytemplate')
  })

  it('faellt auf ENV zurueck, wenn useCustomConfig=true aber apiUrl leer ist', () => {
    const r = resolveLibrarySecretaryConfig({
      config: {
        secretaryService: {
          useCustomConfig: true,
          apiUrl: '',
          apiKey: 'whatever',
        },
      },
    })
    expect(r.override).toEqual({})
    expect(r.source).toBe('env')
  })

  it('faellt auf ENV zurueck, wenn useCustomConfig undefined ist (Default = nicht aktiv)', () => {
    const r = resolveLibrarySecretaryConfig({
      config: {
        secretaryService: {
          apiUrl: 'https://maybe.example.com/api',
          apiKey: 'maybe-key',
        },
      },
    })
    expect(r.override).toEqual({})
    expect(r.source).toBe('env')
  })

  it('uebernimmt apiKey nicht in den Override, wenn er leer ist', () => {
    const r = resolveLibrarySecretaryConfig({
      config: {
        secretaryService: {
          useCustomConfig: true,
          apiUrl: 'https://custom.example.com/api',
          apiKey: '',
        },
      },
    })
    expect(r.override.overrideBaseUrl).toBe('https://custom.example.com/api')
    expect(r.override.overrideApiKey).toBeUndefined()
  })
})

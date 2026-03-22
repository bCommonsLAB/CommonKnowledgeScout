/**
 * Electron preload: window.electronAPI (siehe electron/preload.js)
 */
export type StreamRelayProgress = {
  phase: string
  percent?: number
  message?: string
}

export type StreamRelayStartOptions = {
  streamUrl: string
  targetLanguage?: string
  sourceLanguage?: string
  fileName?: string
}

export type StreamRelayStartResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string }

declare global {
  interface Window {
    electronAPI?: {
      isElectron: true
      getVersion: () => Promise<string>
      streamRelayStart: (opts: StreamRelayStartOptions) => Promise<StreamRelayStartResult>
      streamRelayCancel: () => Promise<{ ok: boolean }>
      onStreamRelayProgress: (cb: (p: StreamRelayProgress) => void) => () => void
    }
  }
}

export {}

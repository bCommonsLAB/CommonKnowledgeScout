import type { StorageProvider } from '@/lib/storage/types'

/**
 * Request-lokaler Cache für Storage-Reads.
 *
 * Motivation:
 * - In Next.js (und bei vielen Providern) liegen Methoden oft auf dem Prototype.
 * - Ein `...provider` (Object Spread) verliert diese Methoden → z.B. `getBinary` wird "undefined".
 *
 * Lösung:
 * - Proxy-basiertes Wrapping, das *alle* Methoden/Properties beibehält,
 *   aber ausgewählte Read-Methoden memoized und bei Mutationen invalidiert.
 *
 * Scope:
 * - Der Cache lebt nur in-memory und nur für die Lebensdauer *eines* Request-Flows.
 * - Keine Persistenz, keine Cross-Request Effekte.
 */
export function withRequestStorageCache<T extends StorageProvider>(provider: T): T {
  const cache = new Map<string, Promise<unknown>>()
  type AnyFn = (...args: unknown[]) => unknown

  const memo = <R>(key: string, fn: () => Promise<R>): Promise<R> => {
    const existing = cache.get(key) as Promise<R> | undefined
    if (existing) return existing
    const p = fn().catch((err) => {
      // Fehler nicht cachen
      cache.delete(key)
      throw err
    })
    cache.set(key, p as Promise<unknown>)
    return p
  }

  const invalidateAll = () => {
    cache.clear()
  }

  const handler: ProxyHandler<T> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown

      // Properties (name/id/etc.) unverändert durchreichen
      if (typeof value !== 'function') return value

      // Methoden immer an das Original binden (Provider implementiert teils internal state via `this`)
      const fn = value as AnyFn

      // Read-Methoden memoizen
      if (prop === 'listItemsById') {
        return (folderId: string) => memo(`list:${folderId}`, () => Promise.resolve(fn.call(target, folderId)))
      }
      if (prop === 'getItemById') {
        return (itemId: string) => memo(`get:${itemId}`, () => Promise.resolve(fn.call(target, itemId)))
      }
      if (prop === 'getPathById') {
        return (itemId: string) => memo(`path:${itemId}`, () => Promise.resolve(fn.call(target, itemId)))
      }
      if (prop === 'getPathItemsById') {
        return (itemId: string) => memo(`pathItems:${itemId}`, () => Promise.resolve(fn.call(target, itemId)))
      }
      if (prop === 'getDownloadUrl') {
        return (itemId: string) => memo(`download:${itemId}`, () => Promise.resolve(fn.call(target, itemId)))
      }
      if (prop === 'getStreamingUrl') {
        return (itemId: string) => memo(`stream:${itemId}`, () => Promise.resolve(fn.call(target, itemId)))
      }

      // Mutationen invalidieren den Cache (simpel + korrekt)
      if (prop === 'createFolder') {
        return async (parentId: string, name: string) => {
          const created = await fn.call(target, parentId, name)
          invalidateAll()
          return created
        }
      }
      if (prop === 'uploadFile') {
        return async (parentId: string, file: File) => {
          const created = await fn.call(target, parentId, file)
          invalidateAll()
          return created
        }
      }
      if (prop === 'deleteItem') {
        return async (itemId: string) => {
          await fn.call(target, itemId)
          invalidateAll()
        }
      }
      if (prop === 'moveItem') {
        return async (itemId: string, newParentId: string) => {
          await fn.call(target, itemId, newParentId)
          invalidateAll()
        }
      }
      if (prop === 'renameItem') {
        return async (itemId: string, newName: string) => {
          const renamed = await fn.call(target, itemId, newName)
          invalidateAll()
          return renamed
        }
      }

      // Default: unverändert, aber gebunden zurückgeben (z.B. getBinary)
      return fn.bind(target)
    },
  }

  return new Proxy(provider, handler)
}



/**
 * @fileoverview Batching Utilities - Helper functions for batching operations
 * 
 * @description
 * Utility functions for splitting arrays into batches and merging results.
 * Used for optimizing MongoDB queries by splitting large ID lists
 * into smaller batches that can be processed in parallel.
 * 
 * @module chat/retrievers/utils
 */

/**
 * Splits an array into batches of specified size
 * 
 * @param items - Array of items to split into batches
 * @param batchSize - Maximum size of each batch
 * @returns Array of batches (each batch is an array of items)
 * 
 * @example
 * ```typescript
 * const ids = ['id1', 'id2', 'id3', 'id4', 'id5']
 * const batches = splitIntoBatches(ids, 2)
 * // Result: [['id1', 'id2'], ['id3', 'id4'], ['id5']]
 * ```
 */
export function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  if (batchSize <= 0) {
    throw new Error('Batch size must be greater than 0')
  }
  
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }
  return batches
}

/**
 * Merges multiple result objects into a single object
 * 
 * @param results - Array of result objects to merge
 * @returns Merged result object
 * 
 * @example
 * ```typescript
 * const results = [
 *   { 'id1': { id: 'id1', metadata: {} } },
 *   { 'id2': { id: 'id2', metadata: {} } }
 * ]
 * const merged = mergeResults(results)
 * // Result: { 'id1': { id: 'id1', metadata: {} }, 'id2': { id: 'id2', metadata: {} } }
 * ```
 */
export function mergeResults<T extends Record<string, unknown>>(
  results: T[]
): T extends Record<string, infer V> ? Record<string, V> : never {
  const merged = {} as Record<string, unknown>
  for (const result of results) {
    Object.assign(merged, result)
  }
  return merged as T extends Record<string, infer V> ? Record<string, V> : never
}


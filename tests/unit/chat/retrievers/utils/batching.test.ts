/**
 * @fileoverview Unit Tests for Batching Utilities
 * 
 * @description
 * Tests for batching utility functions used in chunk retrieval optimization.
 */

import { describe, it, expect } from 'vitest'
import { splitIntoBatches, mergeResults } from '@/lib/chat/retrievers/utils/batching'

describe('splitIntoBatches', () => {
  it('should split array into batches of specified size', () => {
    const items = ['id1', 'id2', 'id3', 'id4', 'id5']
    const batches = splitIntoBatches(items, 2)
    
    expect(batches).toEqual([
      ['id1', 'id2'],
      ['id3', 'id4'],
      ['id5']
    ])
  })

  it('should handle exact batch size', () => {
    const items = ['id1', 'id2', 'id3', 'id4']
    const batches = splitIntoBatches(items, 2)
    
    expect(batches).toEqual([
      ['id1', 'id2'],
      ['id3', 'id4']
    ])
  })

  it('should handle batch size larger than array', () => {
    const items = ['id1', 'id2']
    const batches = splitIntoBatches(items, 10)
    
    expect(batches).toEqual([['id1', 'id2']])
  })

  it('should handle empty array', () => {
    const items: string[] = []
    const batches = splitIntoBatches(items, 5)
    
    expect(batches).toEqual([])
  })

  it('should handle single item', () => {
    const items = ['id1']
    const batches = splitIntoBatches(items, 5)
    
    expect(batches).toEqual([['id1']])
  })

  it('should throw error for batch size 0', () => {
    const items = ['id1', 'id2']
    
    expect(() => splitIntoBatches(items, 0)).toThrow('Batch size must be greater than 0')
  })

  it('should throw error for negative batch size', () => {
    const items = ['id1', 'id2']
    
    expect(() => splitIntoBatches(items, -1)).toThrow('Batch size must be greater than 0')
  })

  it('should handle large arrays', () => {
    const items = Array.from({ length: 100 }, (_, i) => `id${i}`)
    const batches = splitIntoBatches(items, 20)
    
    expect(batches.length).toBe(5)
    expect(batches[0].length).toBe(20)
    expect(batches[4].length).toBe(20)
  })

  it('should preserve order', () => {
    const items = ['id1', 'id2', 'id3', 'id4', 'id5']
    const batches = splitIntoBatches(items, 2)
    
    expect(batches.flat()).toEqual(items)
  })
})

describe('mergeResults', () => {
  it('should merge multiple result objects', () => {
    const results = [
      { 'id1': { id: 'id1', metadata: { text: 'text1' } } },
      { 'id2': { id: 'id2', metadata: { text: 'text2' } } }
    ]
    
    const merged = mergeResults(results)
    
    expect(merged).toEqual({
      'id1': { id: 'id1', metadata: { text: 'text1' } },
      'id2': { id: 'id2', metadata: { text: 'text2' } }
    })
  })

  it('should handle empty array', () => {
    const results: Array<Record<string, unknown>> = []
    const merged = mergeResults(results)
    
    expect(merged).toEqual({})
  })

  it('should handle single result', () => {
    const results = [
      { 'id1': { id: 'id1', metadata: {} } }
    ]
    const merged = mergeResults(results)
    
    expect(merged).toEqual({
      'id1': { id: 'id1', metadata: {} }
    })
  })

  it('should overwrite duplicate keys with last value', () => {
    const results = [
      { 'id1': { id: 'id1', metadata: { text: 'text1' } } },
      { 'id1': { id: 'id1', metadata: { text: 'text2' } } }
    ]
    const merged = mergeResults(results)
    
    expect(merged).toEqual({
      'id1': { id: 'id1', metadata: { text: 'text2' } }
    })
  })

  it('should handle many results', () => {
    const results = Array.from({ length: 10 }, (_, i) => ({
      [`id${i}`]: { id: `id${i}`, metadata: { index: i } }
    }))
    const merged = mergeResults(results)
    
    expect(Object.keys(merged).length).toBe(10)
    expect(merged['id0']).toEqual({ id: 'id0', metadata: { index: 0 } })
    expect(merged['id9']).toEqual({ id: 'id9', metadata: { index: 9 } })
  })
})


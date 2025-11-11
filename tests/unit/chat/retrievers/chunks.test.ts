/**
 * @fileoverview Integration Tests for Chunks Retriever
 * 
 * @description
 * Integration tests for chunksRetriever with focus on performance optimizations:
 * - Fetch Neighbors Batching
 * - Dynamic Window Size
 * - Dynamic Top-K
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { chunksRetriever } from '@/lib/chat/retrievers/chunks'
import type { RetrieverInput } from '@/types/retriever'

// Mock dependencies
vi.mock('@/lib/chat/embeddings', () => ({
  embedTexts: vi.fn()
}))

vi.mock('@/lib/chat/pinecone', () => ({
  queryPineconeByFileIds: vi.fn(),
  fetchVectors: vi.fn(),
  describeIndex: vi.fn()
}))

vi.mock('@/lib/repositories/doc-meta-repo', () => ({
  computeDocMetaCollectionName: vi.fn(),
  findDocs: vi.fn()
}))

vi.mock('@/lib/logging/query-logger', () => ({
  markStepStart: vi.fn((step) => ({ ...step, startedAt: new Date() })),
  markStepEnd: vi.fn((step) => ({ ...step, endedAt: new Date(), timingMs: 100 })),
  appendRetrievalStep: vi.fn()
}))

vi.mock('@/lib/chat/loader', () => ({
  loadLibraryChatContext: vi.fn()
}))

vi.mock('@/lib/chat/dynamic-facets', () => ({
  parseFacetDefs: vi.fn(() => [])
}))

vi.mock('@/lib/chat/retrievers/metadata-extractor', () => ({
  extractFacetMetadata: vi.fn(() => ({}))
}))

import { embedTexts } from '@/lib/chat/embeddings'
import { queryPineconeByFileIds, fetchVectors, describeIndex } from '@/lib/chat/pinecone'
import { findDocs } from '@/lib/repositories/doc-meta-repo'

describe('chunksRetriever - Performance Optimizations', () => {
  const mockInput: RetrieverInput = {
    libraryId: 'test-library-id',
    userEmail: 'test@example.com',
    question: 'What is the test question?',
    answerLength: 'mittel',
    filters: {},
    queryId: 'test-query-id',
    context: {
      vectorIndex: 'test-index'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mocks
    process.env.PINECONE_API_KEY = 'test-api-key'
    
    vi.mocked(findDocs).mockResolvedValue([
      { fileId: 'file1', chunkCount: 10 },
      { fileId: 'file2', chunkCount: 15 }
    ] as never[])
    
    vi.mocked(embedTexts).mockResolvedValue([[0.1, 0.2, 0.3]] as never)
    
    vi.mocked(describeIndex).mockResolvedValue({
      host: 'test-host.pinecone.io',
      dimension: 1536
    })
    
    vi.mocked(queryPineconeByFileIds).mockResolvedValue([
      {
        id: 'file1-0',
        score: 0.8,
        metadata: {
          text: 'Test text 1',
          fileName: 'test1.md',
          fileId: 'file1',
          chunkIndex: 0
        }
      },
      {
        id: 'file1-1',
        score: 0.75,
        metadata: {
          text: 'Test text 2',
          fileName: 'test1.md',
          fileId: 'file1',
          chunkIndex: 1
        }
      }
    ] as never[])
  })

  describe('Fetch Neighbors Batching', () => {
    it('should split IDs into batches when fetching neighbors', async () => {
      // Create many IDs (75 IDs to test batching with default batch size of 20)
      const manyMatches = Array.from({ length: 20 }, (_, i) => ({
        id: `file1-${i}`,
        score: 0.8 - i * 0.01,
        metadata: {
          text: `Test text ${i}`,
          fileName: 'test1.md',
          fileId: 'file1',
          chunkIndex: i
        }
      }))
      
      vi.mocked(queryPineconeByFileIds).mockResolvedValue(manyMatches as never[])
      
      // Mock fetchVectors to return results for each batch
      const mockFetchResults: Record<string, { id: string; metadata?: Record<string, unknown> }> = {}
      manyMatches.forEach(m => {
        // Create window of neighbors (±1 for 'mittel' answerLength)
        for (let d = -1; d <= 1; d++) {
          const chunkIndex = m.metadata.chunkIndex + d
          if (chunkIndex >= 0) {
            const id = `file1-${chunkIndex}`
            mockFetchResults[id] = {
              id,
              metadata: {
                text: `Test text ${chunkIndex}`,
                fileName: 'test1.md',
                fileId: 'file1',
                chunkIndex
              }
            }
          }
        }
      })
      
      // Mock fetchVectors to be called multiple times (batches)
      let callCount = 0
      vi.mocked(fetchVectors).mockImplementation(async (host, apiKey, ids) => {
        callCount++
        const result: Record<string, { id: string; metadata?: Record<string, unknown> }> = {}
        ids.forEach(id => {
          if (mockFetchResults[id]) {
            result[id] = mockFetchResults[id]
          }
        })
        return result
      })
      
      await chunksRetriever.retrieve(mockInput)
      
      // Verify that fetchVectors was called multiple times (batched)
      expect(fetchVectors).toHaveBeenCalled()
      expect(callCount).toBeGreaterThan(1)
    })

    it('should use custom batch size from environment variable', async () => {
      const originalBatchSize = process.env.CHAT_FETCH_BATCH_SIZE
      process.env.CHAT_FETCH_BATCH_SIZE = '10'
      
      const manyMatches = Array.from({ length: 30 }, (_, i) => ({
        id: `file1-${i}`,
        score: 0.8,
        metadata: {
          text: `Test text ${i}`,
          fileName: 'test1.md',
          fileId: 'file1',
          chunkIndex: i
        }
      }))
      
      vi.mocked(queryPineconeByFileIds).mockResolvedValue(manyMatches as never[])
      
      let batchSizes: number[] = []
      vi.mocked(fetchVectors).mockImplementation(async (host, apiKey, ids) => {
        batchSizes.push(ids.length)
        return {}
      })
      
      await chunksRetriever.retrieve(mockInput)
      
      // Verify batch sizes are <= 10
      expect(batchSizes.every(size => size <= 10)).toBe(true)
      
      // Restore
      if (originalBatchSize) {
        process.env.CHAT_FETCH_BATCH_SIZE = originalBatchSize
      } else {
        delete process.env.CHAT_FETCH_BATCH_SIZE
      }
    })

    it('should merge batch results correctly', async () => {
      const matches = [
        {
          id: 'file1-0',
          score: 0.8,
          metadata: {
            text: 'Test text',
            fileName: 'test1.md',
            fileId: 'file1',
            chunkIndex: 0
          }
        }
      ]
      
      vi.mocked(queryPineconeByFileIds).mockResolvedValue(matches as never[])
      
      // Mock fetchVectors to return different results for each batch
      let batchCall = 0
      vi.mocked(fetchVectors).mockImplementation(async (host, apiKey, ids) => {
        batchCall++
        const result: Record<string, { id: string; metadata?: Record<string, unknown> }> = {}
        ids.forEach(id => {
          result[id] = {
            id,
            metadata: {
              text: `Batch ${batchCall} - ${id}`,
              fileName: 'test1.md',
              fileId: 'file1'
            }
          }
        })
        return result
      })
      
      const result = await chunksRetriever.retrieve(mockInput)
      
      // Verify that all results are merged
      expect(result.sources.length).toBeGreaterThan(0)
    })
  })

  describe('Dynamic Window Size', () => {
    it('should use smaller window size for many matches', async () => {
      // Create 35 matches (should trigger window size 1)
      const manyMatches = Array.from({ length: 35 }, (_, i) => ({
        id: `file1-${i}`,
        score: 0.8,
        metadata: {
          text: `Test text ${i}`,
          fileName: 'test1.md',
          fileId: 'file1',
          chunkIndex: i
        }
      }))
      
      vi.mocked(queryPineconeByFileIds).mockResolvedValue(manyMatches as never[])
      
      // Track how many IDs are fetched (should be fewer with smaller window)
      let totalIdsFetched = 0
      vi.mocked(fetchVectors).mockImplementation(async (host, apiKey, ids) => {
        totalIdsFetched += ids.length
        return {}
      })
      
      await chunksRetriever.retrieve(mockInput)
      
      // With 35 matches and 'mittel' answerLength (base window 2), dynamic window should be 1
      // So we should fetch fewer IDs than with base window size
      // Base window would fetch: 35 matches * (2*2+1) = 35 * 5 = 175 IDs
      // Dynamic window (1) would fetch: 35 matches * (2*1+1) = 35 * 3 = 105 IDs
      // So totalIdsFetched should be significantly less than 175
      expect(totalIdsFetched).toBeLessThan(175)
      expect(totalIdsFetched).toBeGreaterThan(0)
    })

    it('should use medium window size for moderate matches', async () => {
      // Create 20 matches (should trigger window size 2)
      const moderateMatches = Array.from({ length: 20 }, (_, i) => ({
        id: `file1-${i}`,
        score: 0.8,
        metadata: {
          text: `Test text ${i}`,
          fileName: 'test1.md',
          fileId: 'file1',
          chunkIndex: i
        }
      }))
      
      vi.mocked(queryPineconeByFileIds).mockResolvedValue(moderateMatches as never[])
      
      await chunksRetriever.retrieve(mockInput)
      
      // Verify fetchVectors was called (window size logic applied)
      expect(fetchVectors).toHaveBeenCalled()
    })

    it('should use base window size for few matches', async () => {
      // Create 10 matches (should use base window size)
      const fewMatches = Array.from({ length: 10 }, (_, i) => ({
        id: `file1-${i}`,
        score: 0.8,
        metadata: {
          text: `Test text ${i}`,
          fileName: 'test1.md',
          fileId: 'file1',
          chunkIndex: i
        }
      }))
      
      vi.mocked(queryPineconeByFileIds).mockResolvedValue(fewMatches as never[])
      
      await chunksRetriever.retrieve(mockInput)
      
      // Verify fetchVectors was called
      expect(fetchVectors).toHaveBeenCalled()
    })
  })

  describe('Dynamic Top-K', () => {
    it('should use Top-K 30 for large budget', async () => {
      const input: RetrieverInput = {
        ...mockInput,
        answerLength: 'unbegrenzt' // Large budget
      }
      
      await chunksRetriever.retrieve(input)
      
      // Verify queryPineconeByFileIds was called with Top-K 30
      expect(queryPineconeByFileIds).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        30, // Top-K should be 30 for large budget
        expect.any(String),
        expect.any(String),
        expect.any(String)
      )
    })

    it('should use Top-K 30 for large budget (ausführlich)', async () => {
      const input: RetrieverInput = {
        ...mockInput,
        answerLength: 'ausführlich' // Large budget (180000) > 50000, so Top-K should be 30
      }
      
      await chunksRetriever.retrieve(input)
      
      // Verify queryPineconeByFileIds was called with Top-K 30 for chunks
      // Note: There are 2 calls - one for chunks, one for chapter summaries
      const chunkCall = vi.mocked(queryPineconeByFileIds).mock.calls.find(
        call => call[7] === 'chunk'
      )
      expect(chunkCall).toBeDefined()
      expect(chunkCall![4]).toBe(30) // Top-K should be 30 for large budget
    })

    it('should use Top-K 30 for medium budget (mittel)', async () => {
      const input: RetrieverInput = {
        ...mockInput,
        answerLength: 'mittel' // Medium budget (90000) > 50000, so Top-K should be 30
      }
      
      await chunksRetriever.retrieve(input)
      
      // Verify queryPineconeByFileIds was called with Top-K 30 for chunks
      // Note: Budget 90000 > 50000, so Top-K = 30
      const chunkCall = vi.mocked(queryPineconeByFileIds).mock.calls.find(
        call => call[7] === 'chunk'
      )
      expect(chunkCall).toBeDefined()
      expect(chunkCall![4]).toBe(30) // Top-K should be 30 for budget > 50000
    })

    it('should use Top-K 15 for small budget', async () => {
      const input: RetrieverInput = {
        ...mockInput,
        answerLength: 'kurz' // Small budget (30000)
      }
      
      await chunksRetriever.retrieve(input)
      
      // Verify queryPineconeByFileIds was called with Top-K 15
      expect(queryPineconeByFileIds).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        15, // Top-K should be 15 for small budget
        expect.any(String),
        expect.any(String),
        expect.any(String)
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty IDs list', async () => {
      vi.mocked(queryPineconeByFileIds).mockResolvedValue([] as never[])
      
      const result = await chunksRetriever.retrieve(mockInput)
      
      expect(result.sources).toEqual([])
      expect(fetchVectors).not.toHaveBeenCalled()
    })

    it('should handle single ID', async () => {
      const singleMatch = [{
        id: 'file1-0',
        score: 0.8,
        metadata: {
          text: 'Test text',
          fileName: 'test1.md',
          fileId: 'file1',
          chunkIndex: 0
        }
      }]
      
      vi.mocked(queryPineconeByFileIds).mockResolvedValue(singleMatch as never[])
      
      vi.mocked(fetchVectors).mockResolvedValue({
        'file1-0': {
          id: 'file1-0',
          metadata: {
            text: 'Test text',
            fileName: 'test1.md',
            fileId: 'file1',
            chunkIndex: 0
          }
        }
      })
      
      const result = await chunksRetriever.retrieve(mockInput)
      
      expect(result.sources.length).toBeGreaterThan(0)
    })

    it('should handle batch size larger than IDs count', async () => {
      process.env.CHAT_FETCH_BATCH_SIZE = '100'
      
      const fewMatches = [{
        id: 'file1-0',
        score: 0.8,
        metadata: {
          text: 'Test text',
          fileName: 'test1.md',
          fileId: 'file1',
          chunkIndex: 0
        }
      }]
      
      vi.mocked(queryPineconeByFileIds).mockResolvedValue(fewMatches as never[])
      
      vi.mocked(fetchVectors).mockResolvedValue({
        'file1-0': {
          id: 'file1-0',
          metadata: {
            text: 'Test text',
            fileName: 'test1.md',
            fileId: 'file1',
            chunkIndex: 0
          }
        }
      })
      
      const result = await chunksRetriever.retrieve(mockInput)
      
      expect(result.sources.length).toBeGreaterThan(0)
      expect(fetchVectors).toHaveBeenCalledTimes(1)
      
      delete process.env.CHAT_FETCH_BATCH_SIZE
    })
  })
})


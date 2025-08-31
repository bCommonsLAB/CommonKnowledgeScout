import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeChatConfig, slugifyIndexName, getVectorIndexForLibrary } from '@/lib/chat/config'

test('chat-config: normalizes defaults', () => {
  const cfg = normalizeChatConfig(undefined)
  assert.equal(cfg.public, false)
  assert.equal(cfg.maxChars, 500)
  assert.equal(cfg.features.citations, true)
  assert.equal(cfg.rateLimit.windowSec, 60)
})

test('chat-config: accepts provided values', () => {
  const cfg = normalizeChatConfig({ public: true, maxChars: 1234 })
  assert.equal(cfg.public, true)
  assert.equal(cfg.maxChars, 1234)
})

test('chat-config: slugifies index names safely', () => {
  assert.match(slugifyIndexName('My Fancy Library 2025!'), /^my-fancy-library-2025$/)
  assert.match(slugifyIndexName('123abc'), /^lib-123abc$/)
  assert.equal(slugifyIndexName(''), 'library')
})

test('chat-config: derives index from label with override', () => {
  const name = getVectorIndexForLibrary(
    { id: '611a6640-3fd5-4160-a211-7ea11a098103', label: 'Biodiversität Südtirol' },
    { vectorStore: { indexOverride: 'biodiv-prototyp' }, welcomeMessage: 'hi' }
  )
  assert.equal(name, 'biodiv-prototyp')
})

test('chat-config: derives index from label without override', () => {
  const name = getVectorIndexForLibrary(
    { id: '611a6640-3fd5-4160-a211-7ea11a098103', label: 'Biodiversität Südtirol' },
    { welcomeMessage: 'hi' }
  )
  assert.equal(name, 'biodiversit-t-s-dtirol')
})

test('chat-config: prefixes with user email slug when provided', () => {
  const name = getVectorIndexForLibrary(
    { id: '611a6640-3fd5-4160-a211-7ea11a098103', label: 'Biodiversität Südtirol' },
    { welcomeMessage: 'hi' },
    'paul.aichner@crystal-design.com'
  )
  assert.match(name, /^paul-aichner-crystal-design-com-biodiversit-t-s-dtirol$/)
})



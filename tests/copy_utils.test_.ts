import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  formatFileSize,
  formatDateTime,
  getUserFriendlyAudioErrorMessage,
  getUserFriendlyVideoErrorMessage,
} from '../src/lib/utils'

test('formatFileSize: undefined and basic units', () => {
  assert.equal(formatFileSize(), '-')
  assert.equal(formatFileSize(1023), '1023.0 B')
  assert.equal(formatFileSize(1024), '1.0 KB')
  assert.equal(formatFileSize(1536), '1.5 KB')
})

test('formatDateTime: returns localized de-DE date string', () => {
  const dateIso = '2024-01-02T03:04:00.000Z'
  const formatted = formatDateTime(dateIso)
  assert.ok(formatted.includes('02.01.'), 'should include day and month in de-DE')
  assert.ok(formatted.includes('2024'), 'should include year')
})

test('getUserFriendlyAudioErrorMessage: maps common network errors', () => {
  const err = new Error('ECONNREFUSED 127.0.0.1')
  const msg = getUserFriendlyAudioErrorMessage(err)
  assert.ok(msg.toLowerCase().includes('nicht erreichbar'))
})

test('getUserFriendlyVideoErrorMessage: maps unsupported format', () => {
  const err = new Error('Video-Format wird nicht unterstützt')
  const msg = getUserFriendlyVideoErrorMessage(err)
  assert.ok(msg.toLowerCase().includes('wird nicht unterstützt'))
})



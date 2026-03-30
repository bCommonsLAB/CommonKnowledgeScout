import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveAzureStorageConfig } from '@/lib/config/azure-storage'

describe('resolveAzureStorageConfig', () => {
  const prevConn = process.env.AZURE_STORAGE_CONNECTION_STRING
  const prevContainer = process.env.AZURE_STORAGE_CONTAINER_NAME

  beforeEach(() => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING
    delete process.env.AZURE_STORAGE_CONTAINER_NAME
  })

  afterEach(() => {
    if (prevConn !== undefined) process.env.AZURE_STORAGE_CONNECTION_STRING = prevConn
    else delete process.env.AZURE_STORAGE_CONNECTION_STRING
    if (prevContainer !== undefined) process.env.AZURE_STORAGE_CONTAINER_NAME = prevContainer
    else delete process.env.AZURE_STORAGE_CONTAINER_NAME
  })

  it('nutzt Library ingestionStorage wenn useCustomConfig und beide Felder gesetzt', () => {
    const cfg = resolveAzureStorageConfig({
      ingestionStorage: {
        useCustomConfig: true,
        connectionString: 'AccountName=libacc;AccountKey=key;EndpointSuffix=core.windows.net',
        containerName: 'lib-container',
      },
    })
    expect(cfg).not.toBeNull()
    expect(cfg!.containerName).toBe('lib-container')
    expect(cfg!.connectionString).toContain('libacc')
  })

  it('fällt auf ENV zurück wenn useCustomConfig false', () => {
    process.env.AZURE_STORAGE_CONNECTION_STRING =
      'AccountName=envacc;AccountKey=key;EndpointSuffix=core.windows.net'
    process.env.AZURE_STORAGE_CONTAINER_NAME = 'env-container'
    const cfg = resolveAzureStorageConfig({
      ingestionStorage: {
        useCustomConfig: false,
        connectionString: 'AccountName=ignored;AccountKey=key;EndpointSuffix=core.windows.net',
        containerName: 'ignored',
      },
    })
    expect(cfg).not.toBeNull()
    expect(cfg!.containerName).toBe('env-container')
  })

  it('gibt null wenn weder Library noch ENV vollständig', () => {
    expect(resolveAzureStorageConfig({ ingestionStorage: { useCustomConfig: true, connectionString: '', containerName: 'x' } })).toBeNull()
    expect(resolveAzureStorageConfig(undefined)).toBeNull()
  })
})

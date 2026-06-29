import { createHash } from 'crypto'
import { describe, it, expect } from 'vitest'

describe('Report hashing', () => {
  it('produces consistent SHA-256 hash for same content', () => {
    const content = Buffer.from('test report content')
    const hash1 = createHash('sha256').update(content).digest('hex')
    const hash2 = createHash('sha256').update(content).digest('hex')
    expect(hash1).toBe(hash2)
  })

  it('produces different hash for different content', () => {
    const hash1 = createHash('sha256').update('version 1').digest('hex')
    const hash2 = createHash('sha256').update('version 2').digest('hex')
    expect(hash1).not.toBe(hash2)
  })

  it('SHA-256 hash is 64 characters long', () => {
    const hash = createHash('sha256').update('test').digest('hex')
    expect(hash).toHaveLength(64)
  })

  it('empty content produces a valid hash', () => {
    const hash = createHash('sha256').update('').digest('hex')
    expect(hash).toHaveLength(64)
  })
})
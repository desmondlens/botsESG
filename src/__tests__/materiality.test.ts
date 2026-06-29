import { describe, it, expect } from 'vitest'

describe('Materiality assessment', () => {
  it('topic is material when impact score >= 3', () => {
    const impactScore = 3
    const financialScore = 1
    const isMaterial = impactScore >= 3 || financialScore >= 3
    expect(isMaterial).toBe(true)
  })

  it('topic is material when financial score >= 3', () => {
    const impactScore = 1
    const financialScore = 4
    const isMaterial = impactScore >= 3 || financialScore >= 3
    expect(isMaterial).toBe(true)
  })

  it('topic is not material when both scores below 3', () => {
    const impactScore = 2
    const financialScore = 2
    const isMaterial = impactScore >= 3 || financialScore >= 3
    expect(isMaterial).toBe(false)
  })

  it('topic is material when both scores are 5', () => {
    const impactScore = 5
    const financialScore = 5
    const isMaterial = impactScore >= 3 || financialScore >= 3
    expect(isMaterial).toBe(true)
  })

  it('scores must be between 1 and 5', () => {
    const validScore = (score: number) => score >= 1 && score <= 5
    expect(validScore(3)).toBe(true)
    expect(validScore(0)).toBe(false)
    expect(validScore(6)).toBe(false)
  })
})
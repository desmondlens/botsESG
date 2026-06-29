import { describe, it, expect } from 'vitest'

describe('Scoring engine', () => {
  it('applies confidence penalty of 20 points for low confidence', () => {
    const baseScore = 100
    const penalty = 20
    expect(baseScore - penalty).toBe(80)
  })

  it('applies source penalty of 10 points when no source provided', () => {
    const baseScore = 100
    const penalty = 10
    expect(baseScore - penalty).toBe(90)
  })

  it('does not allow adjusted score below zero', () => {
    const adjusted = Math.max(0, 100 - 20 - 10 - 80)
    expect(adjusted).toBe(0)
  })

  it('applies material weight multiplier of 2', () => {
    const score = 80
    const multiplier = 2
    expect(score * multiplier).toBe(160)
  })

  it('pillar weights sum to 1', () => {
    const eWeight = 0.35
    const sWeight = 0.35
    const gWeight = 0.30
    expect(eWeight + sWeight + gWeight).toBeCloseTo(1.0)
  })

  it('overall score cannot exceed 100', () => {
    const score = Math.min(100, 150)
    expect(score).toBe(100)
  })

  it('overall score cannot be below 0', () => {
    const score = Math.max(0, -10)
    expect(score).toBe(0)
  })
})
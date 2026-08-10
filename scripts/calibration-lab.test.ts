import { describe, expect, it } from 'vitest'
import { runCalibrationLab } from './calibration-lab'

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
}

describe('DealerSim strategy / exploit calibration lab', () => {
  it('finds no scripted-policy calibration warnings across the 384-session suite', () => {
    const results = runCalibrationLab()
    console.log('DealerSim strategy / exploit calibration lab')
    for (const item of results) {
      console.log(`${item.name.padEnd(42)} score=${mean(item.scores).toFixed(1)} avg_return=${mean(item.returns).toFixed(4)} cost=${mean(item.costsBps).toFixed(2)}bp ${item.warnings.length ? `WARN ${item.warnings.join(' | ')}` : 'OK'}`)
    }
    const warningCount = results.reduce((count, item) => count + item.warnings.length, 0)
    console.log(`Warnings: ${warningCount}`)
    expect(warningCount).toBe(0)
  }, 60_000)
})

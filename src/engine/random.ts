export class SeededRandom {
  private state: number
  private spareNormal: number | null = null

  constructor(seed: number) {
    const safeSeed = Number.isFinite(seed) ? Math.floor(seed) : 1
    this.state = (safeSeed >>> 0) || 0x9e3779b9
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296
    this.state >>>= 0
    return result
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1))
  }

  chance(probability: number): boolean {
    return this.next() < Math.max(0, Math.min(1, probability))
  }

  normal(mean = 0, standardDeviation = 1): number {
    if (this.spareNormal !== null) {
      const value = this.spareNormal
      this.spareNormal = null
      return mean + value * standardDeviation
    }

    let u = 0
    let v = 0
    while (u === 0) u = this.next()
    while (v === 0) v = this.next()

    const magnitude = Math.sqrt(-2 * Math.log(u))
    const z0 = magnitude * Math.cos(2 * Math.PI * v)
    const z1 = magnitude * Math.sin(2 * Math.PI * v)
    this.spareNormal = z1
    return mean + z0 * standardDeviation
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty list')
    }
    return items[this.int(0, items.length - 1)]
  }

  weighted<T>(entries: readonly { item: T; weight: number }[]): T {
    if (entries.length === 0) {
      throw new Error('Cannot pick from an empty weighted list')
    }

    const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0)
    if (total <= 0) return entries[entries.length - 1].item

    let draw = this.range(0, total)
    for (const entry of entries) {
      draw -= Math.max(0, entry.weight)
      if (draw <= 0) return entry.item
    }
    return entries[entries.length - 1].item
  }

  fork(salt: number): SeededRandom {
    const mixed = Math.imul(this.state ^ (salt >>> 0), 0x85ebca6b) >>> 0
    return new SeededRandom(mixed)
  }
}

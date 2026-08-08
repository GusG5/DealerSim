import type { FundDealerRelationship, FundDealerRelationshipMemory, FundSessionSummary } from '../engine/fund-types'
import type { MacroSessionSummary } from '../engine/macro-types'
import type { Difficulty, SessionSummary } from '../types'

const STORAGE_KEY = 'dealersim.session-summaries.v1'
const SETTINGS_KEY = 'dealersim.settings.v1'
const MACRO_STORAGE_KEY = 'dealersim.macro-session-summaries.v1'
const FUND_STORAGE_KEY = 'dealersim.fund-session-summaries.v1'
const DEALER_RELATIONSHIP_KEY = 'dealersim.fund-dealer-relationships.v1'
const DEALER_CLIENT_RELATIONSHIP_KEY = 'dealersim.dealer-client-relationships.v1'

const STORAGE_SCHEMA_KEY = 'dealersim.storage-schema'
const STORAGE_SCHEMA_VERSION = 2
const STORAGE_RECOVERY_NOTICE_KEY = 'dealersim.storage-recovery-notice'

const PERSISTED_DATA_KEYS = [
  STORAGE_KEY,
  MACRO_STORAGE_KEY,
  FUND_STORAGE_KEY,
  DEALER_RELATIONSHIP_KEY,
  DEALER_CLIENT_RELATIONSHIP_KEY,
] as const

const DIFFICULTIES = new Set<Difficulty>(['learning', 'standard', 'advanced', 'assessment'])

export interface StoredSettings {
  muted: boolean
  tutorialSeen: boolean
  defaultDifficulty: string
}

/**
 * Run once before React mounts.
 *
 * DealerSim's progress/history schemas have evolved substantially across releases. Older browser
 * data can therefore be structurally valid JSON while still being incompatible with the current UI.
 * Instead of allowing stale data to crash React, the public build maintains an explicit storage
 * schema marker. Unknown schemas are safely reset while user preferences are preserved.
 */
export function initializeStorage(): void {
  if (typeof window === 'undefined') return

  try {
    const storedVersion = window.localStorage.getItem(STORAGE_SCHEMA_KEY)
    const currentVersion = String(STORAGE_SCHEMA_VERSION)

    if (storedVersion === currentVersion) return

    const hadPersistedData = PERSISTED_DATA_KEYS.some((key) => window.localStorage.getItem(key) !== null)
    PERSISTED_DATA_KEYS.forEach((key) => window.localStorage.removeItem(key))
    window.localStorage.setItem(STORAGE_SCHEMA_KEY, currentVersion)

    if (hadPersistedData) {
      setRecoveryNotice('Saved progress from an older DealerSim version was reset safely because its data format is no longer compatible.')
    }
  } catch {
    // Storage can be unavailable in locked-down/private browser contexts. DealerSim should still load.
  }
}

export function consumeStorageRecoveryNotice(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const notice = window.sessionStorage.getItem(STORAGE_RECOVERY_NOTICE_KEY)
    if (notice) window.sessionStorage.removeItem(STORAGE_RECOVERY_NOTICE_KEY)
    return notice
  } catch {
    return null
  }
}

export function loadSessionSummaries(): SessionSummary[] {
  return loadValidatedArray(STORAGE_KEY, isSessionSummary)
}

export function saveSessionSummary(summary: SessionSummary): void {
  const existing = loadSessionSummaries()
  const next = [summary, ...existing.filter((item) => item.id !== summary.id)].slice(0, 150)
  safeSet(STORAGE_KEY, next)
}

export function clearSessionSummaries(): void {
  safeRemove(STORAGE_KEY)
}

export function loadSettings(): StoredSettings {
  const defaults: StoredSettings = {
    muted: false,
    tutorialSeen: false,
    defaultDifficulty: 'standard',
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? { ...defaults, ...(parsed as Partial<StoredSettings>) } : defaults
  } catch {
    return defaults
  }
}

export function saveSettings(settings: StoredSettings): void {
  safeSet(SETTINGS_KEY, settings)
}

export function loadMacroSessionSummaries(): MacroSessionSummary[] {
  return loadValidatedArray(MACRO_STORAGE_KEY, isMacroSessionSummary)
}

export function saveMacroSessionSummary(summary: MacroSessionSummary): void {
  const existing = loadMacroSessionSummaries()
  const next = [summary, ...existing.filter((item) => item.id !== summary.id)].slice(0, 100)
  safeSet(MACRO_STORAGE_KEY, next)
}

export function clearMacroSessionSummaries(): void { safeRemove(MACRO_STORAGE_KEY) }

export function loadFundSessionSummaries(): FundSessionSummary[] {
  return loadValidatedArray(FUND_STORAGE_KEY, isFundSessionSummary)
}

export function saveFundSessionSummary(summary: FundSessionSummary): void {
  const existing = loadFundSessionSummaries()
  const next = [summary, ...existing.filter((item) => item.id !== summary.id)].slice(0, 100)
  safeSet(FUND_STORAGE_KEY, next)
}

export function clearFundSessionSummaries(): void { safeRemove(FUND_STORAGE_KEY) }

export function loadFundDealerRelationships(): Record<string, FundDealerRelationshipMemory> {
  return loadValidatedRecord(DEALER_RELATIONSHIP_KEY, isFundDealerRelationshipMemory)
}

export function saveFundDealerRelationships(relationships: Record<string, FundDealerRelationship>): void {
  const compact = Object.fromEntries(Object.values(relationships).map((item) => [item.dealerId, {
    dealerId: item.dealerId,
    dealerName: item.dealerName,
    relationshipScore: item.relationshipScore,
    rfqs: item.rfqs,
    fills: item.fills,
    executedNotional: item.executedNotional,
    cumulativeSavings: item.cumulativeSavings,
    lastUsedAt: new Date().toISOString(),
  }]))
  safeSet(DEALER_RELATIONSHIP_KEY, compact)
}

export function clearFundDealerRelationships(): void {
  safeRemove(DEALER_RELATIONSHIP_KEY)
}

export interface DealerClientRelationshipMemory {
  clientName: string
  relationshipScore: number
  rfqs: number
  fills: number
  volumeM: number
  commission: number
  staleTrades: number
  lastSeenAt?: string
}

export function loadDealerClientRelationships(): Record<string, DealerClientRelationshipMemory> {
  return loadValidatedRecord(DEALER_CLIENT_RELATIONSHIP_KEY, isDealerClientRelationshipMemory)
}

export function updateDealerClientRelationships(records: import('../types').QuoteRecord[]): void {
  const relationships = loadDealerClientRelationships()
  for (const record of records) {
    const name = record.rfq.clientName
    const prior = relationships[name] ?? { clientName: name, relationshipScore: 50, rfqs: 0, fills: 0, volumeM: 0, commission: 0, staleTrades: 0 }
    const filled = Boolean(record.outcome?.accepted)
    const stale = Boolean(record.outcome?.stale)
    const relationshipDelta = filled ? (stale ? -0.45 : 0.65) : -0.08
    relationships[name] = {
      ...prior,
      relationshipScore: Math.max(25, Math.min(90, prior.relationshipScore + relationshipDelta)),
      rfqs: prior.rfqs + 1,
      fills: prior.fills + (filled ? 1 : 0),
      volumeM: prior.volumeM + (filled ? record.rfq.sizeM : 0),
      commission: prior.commission + (record.outcome?.commission ?? 0),
      staleTrades: prior.staleTrades + (stale ? 1 : 0),
      lastSeenAt: new Date().toISOString(),
    }
  }
  safeSet(DEALER_CLIENT_RELATIONSHIP_KEY, relationships)
}

export function clearDealerClientRelationships(): void {
  safeRemove(DEALER_CLIENT_RELATIONSHIP_KEY)
}

function loadValidatedArray<T>(key: string, guard: (value: unknown) => value is T): T[] {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      recoverKey(key)
      return []
    }
    const clean = parsed.filter(guard)
    if (clean.length !== parsed.length) {
      safeSet(key, clean)
      setRecoveryNotice('Some incompatible or corrupted saved DealerSim progress was removed so the application could start safely.')
    }
    return clean
  } catch {
    recoverKey(key)
    return []
  }
}

function loadValidatedRecord<T>(key: string, guard: (value: unknown) => value is T): Record<string, T> {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) {
      recoverKey(key)
      return {}
    }
    const clean = Object.fromEntries(Object.entries(parsed).filter(([, value]) => guard(value))) as Record<string, T>
    if (Object.keys(clean).length !== Object.keys(parsed).length) {
      safeSet(key, clean)
      setRecoveryNotice('Some incompatible or corrupted saved DealerSim relationship data was removed so the application could start safely.')
    }
    return clean
  } catch {
    recoverKey(key)
    return {}
  }
}

function recoverKey(key: string): void {
  safeRemove(key)
  setRecoveryNotice('Incompatible or corrupted saved DealerSim data was reset safely. Your project files were not affected.')
}

function setRecoveryNotice(message: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_RECOVERY_NOTICE_KEY, message)
  } catch {
    // Non-essential UX notice only.
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage is non-essential; active sessions continue without persistence.
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore unavailable storage.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isString(value: unknown): value is string { return typeof value === 'string' && value.length > 0 }
function isNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }
function isDifficulty(value: unknown): value is Difficulty { return typeof value === 'string' && DIFFICULTIES.has(value as Difficulty) }

function isSessionSummary(value: unknown): value is SessionSummary {
  if (!isRecord(value)) return false
  return isString(value.id)
    && isString(value.completedAt)
    && isNumber(value.seed)
    && isString(value.scenario)
    && isDifficulty(value.difficulty)
    && isString(value.instrumentSymbol)
    && isNumber(value.score)
    && isString(value.rating)
    && isNumber(value.netPnl)
    && isNumber(value.grossCommission)
    && isNumber(value.maximumInventoryM)
    && isNumber(value.acceptanceRate)
    && isNumber(value.staleQuoteRate)
}

function isMacroSessionSummary(value: unknown): value is MacroSessionSummary {
  if (!isRecord(value)) return false
  return isString(value.id)
    && isString(value.completedAt)
    && isNumber(value.seed)
    && isString(value.scenario)
    && isDifficulty(value.difficulty)
    && isNumber(value.returnPct)
    && isNumber(value.score)
    && isString(value.rating)
    && isNumber(value.maxDrawdown)
    && isNumber(value.turnover)
    && isNumber(value.grossExposure)
    && isNumber(value.transactionCosts)
}

function isFundSessionSummary(value: unknown): value is FundSessionSummary {
  if (!isRecord(value)) return false
  return isString(value.id)
    && isString(value.completedAt)
    && (value.mandate === 'long-short' || value.mandate === 'long-only')
    && isNumber(value.seed)
    && isString(value.scenario)
    && isDifficulty(value.difficulty)
    && isNumber(value.returnPct)
    && isNumber(value.benchmarkReturnPct)
    && isNumber(value.alphaPct)
    && isNumber(value.score)
    && isString(value.rating)
    && isNumber(value.maxDrawdown)
    && isNumber(value.turnover)
    && isNumber(value.peakGrossExposure)
    && isNumber(value.peakBetaExposure)
    && isNumber(value.transactionCosts)
    && isNumber(value.borrowCosts)
}

function isFundDealerRelationshipMemory(value: unknown): value is FundDealerRelationshipMemory {
  if (!isRecord(value)) return false
  return isString(value.dealerId)
    && isString(value.dealerName)
    && isNumber(value.relationshipScore)
    && isNumber(value.rfqs)
    && isNumber(value.fills)
    && isNumber(value.executedNotional)
    && isNumber(value.cumulativeSavings)
}

function isDealerClientRelationshipMemory(value: unknown): value is DealerClientRelationshipMemory {
  if (!isRecord(value)) return false
  return isString(value.clientName)
    && isNumber(value.relationshipScore)
    && isNumber(value.rfqs)
    && isNumber(value.fills)
    && isNumber(value.volumeM)
    && isNumber(value.commission)
    && isNumber(value.staleTrades)
}

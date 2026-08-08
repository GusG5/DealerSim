import { useCallback, useRef, useState } from 'react'
import { createMacroEngine, type MacroPortfolioEngine } from '../engine/macro'
import type { MacroSessionOptions, MacroSessionSnapshot, MacroTradeIntent } from '../engine/macro-types'

export function useMacroSim() {
  const engineRef = useRef<MacroPortfolioEngine | null>(null)
  const [snapshot, setSnapshot] = useState<MacroSessionSnapshot | null>(null)
  const [feedback, setFeedback] = useState<string>('')

  const refresh = useCallback(() => {
    setSnapshot(engineRef.current?.snapshot() ?? null)
  }, [])

  const startSession = useCallback((options: MacroSessionOptions) => {
    engineRef.current = createMacroEngine(options)
    setFeedback('')
    refresh()
  }, [refresh])

  const reset = useCallback(() => {
    engineRef.current = null
    setSnapshot(null)
    setFeedback('')
  }, [])

  const executeTarget = useCallback((intent: MacroTradeIntent) => {
    const result = engineRef.current?.executeTarget(intent)
    if (result) setFeedback(result.reason)
    refresh()
    return result
  }, [refresh])


  const requestDealerQuotes = useCallback((intent: MacroTradeIntent, dealerCount = 3) => {
    const result = engineRef.current?.requestDealerQuotes(intent, dealerCount)
    if (result) setFeedback(result.reason)
    refresh()
    return result
  }, [refresh])

  const acceptDealerQuote = useCallback((quoteId: string, fillFraction = 1) => {
    const result = engineRef.current?.acceptDealerQuote(quoteId, fillFraction)
    if (result) setFeedback(result.reason)
    refresh()
    return result
  }, [refresh])

  const cancelDealerRfq = useCallback(() => {
    const result = engineRef.current?.cancelDealerRfq()
    if (result) setFeedback(result.reason)
    refresh()
    return result
  }, [refresh])

  const advanceDay = useCallback(() => {
    engineRef.current?.advanceDay()
    setFeedback('')
    refresh()
  }, [refresh])

  const advanceToNextEvent = useCallback(() => {
    engineRef.current?.advanceToNextEvent()
    setFeedback('')
    refresh()
  }, [refresh])

  const finish = useCallback(() => {
    engineRef.current?.finish()
    refresh()
  }, [refresh])

  return { snapshot, feedback, startSession, reset, executeTarget, requestDealerQuotes, acceptDealerQuote, cancelDealerRfq, advanceDay, advanceToNextEvent, finish }
}

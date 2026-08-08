import { useCallback, useEffect, useRef, useState } from 'react'
import { createLiveMacroEngine, type LiveMacroEngine } from '../engine/live-macro'
import type { LiveMacroSessionOptions, LiveMacroSessionSnapshot, LiveMacroTradeIntent, LiveMacroWorkingStyle } from '../engine/live-macro-types'

export function useLiveMacroSim() {
  const engineRef = useRef<LiveMacroEngine | null>(null)
  const [snapshot, setSnapshot] = useState<LiveMacroSessionSnapshot | null>(null)
  const [feedback, setFeedback] = useState('')

  const refresh = useCallback(() => {
    setSnapshot(engineRef.current?.snapshot() ?? null)
  }, [])

  useEffect(() => {
    if (!snapshot || snapshot.status !== 'running') return
    const id = window.setInterval(() => {
      engineRef.current?.tick(0.25)
      refresh()
    }, 250)
    return () => window.clearInterval(id)
  }, [refresh, snapshot?.status])

  const startSession = useCallback((options: LiveMacroSessionOptions) => {
    engineRef.current = createLiveMacroEngine(options)
    setFeedback('')
    refresh()
  }, [refresh])

  const reset = useCallback(() => {
    engineRef.current = null
    setSnapshot(null)
    setFeedback('')
  }, [])

  const executeTarget = useCallback((intent: LiveMacroTradeIntent) => {
    const result = engineRef.current?.executeTarget(intent)
    if (result) setFeedback(result.reason)
    refresh()
    return result
  }, [refresh])

  const requestDealerQuotes = useCallback((intent: LiveMacroTradeIntent, dealerCount: number) => {
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

  const startWorkingOrder = useCallback((intent: LiveMacroTradeIntent, style: LiveMacroWorkingStyle, durationSeconds: number) => {
    const result = engineRef.current?.startWorkingOrder(intent, style, durationSeconds)
    if (result) setFeedback(result.reason)
    refresh()
    return result
  }, [refresh])

  const pauseWorkingOrder = useCallback((orderId: string) => { engineRef.current?.pauseWorkingOrder(orderId); refresh() }, [refresh])
  const resumeWorkingOrder = useCallback((orderId: string) => { engineRef.current?.resumeWorkingOrder(orderId); refresh() }, [refresh])
  const cancelWorkingOrder = useCallback((orderId: string) => { engineRef.current?.cancelWorkingOrder(orderId); refresh() }, [refresh])
  const crossWorkingOrder = useCallback((orderId: string) => {
    const result = engineRef.current?.crossWorkingOrder(orderId)
    if (result) setFeedback(result.reason)
    refresh()
    return result
  }, [refresh])

  const pause = useCallback(() => { engineRef.current?.pause(); refresh() }, [refresh])
  const resume = useCallback(() => { engineRef.current?.resume(); refresh() }, [refresh])
  const finish = useCallback(() => { engineRef.current?.finish(); refresh() }, [refresh])

  return {
    snapshot,
    feedback,
    startSession,
    reset,
    executeTarget,
    requestDealerQuotes,
    acceptDealerQuote,
    cancelDealerRfq,
    startWorkingOrder,
    pauseWorkingOrder,
    resumeWorkingOrder,
    cancelWorkingOrder,
    crossWorkingOrder,
    pause,
    resume,
    finish,
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { createEquityFundEngine, type EquityFundEngine } from '../engine/fund'
import type { FundSessionOptions, FundSessionSnapshot, FundTradeIntent, FundWorkingStyle } from '../engine/fund-types'

export function useFundSim() {
  const engineRef = useRef<EquityFundEngine | null>(null)
  const [snapshot, setSnapshot] = useState<FundSessionSnapshot | null>(null)
  const [feedback, setFeedback] = useState('')
  const refresh = useCallback(() => setSnapshot(engineRef.current?.snapshot() ?? null), [])

  useEffect(() => {
    if (!snapshot || snapshot.status !== 'running') return
    const id = window.setInterval(() => { engineRef.current?.tick(.25); refresh() }, 250)
    return () => window.clearInterval(id)
  }, [refresh, snapshot?.status])

  const startSession = useCallback((options: FundSessionOptions) => { engineRef.current = createEquityFundEngine(options); setFeedback(''); refresh() }, [refresh])
  const reset = useCallback(() => { engineRef.current = null; setSnapshot(null); setFeedback('') }, [])
  const executeTarget = useCallback((intent: FundTradeIntent) => { const result = engineRef.current?.executeTarget(intent); if (result) setFeedback(result.reason); refresh(); return result }, [refresh])
  const executeAuction = useCallback((intent: FundTradeIntent) => { const result = engineRef.current?.executeAuction(intent); if (result) setFeedback(result.reason); refresh(); return result }, [refresh])
  const requestLocate = useCallback((assetId: FundTradeIntent['assetId'], targetWeight: number) => { const result = engineRef.current?.requestLocate(assetId, targetWeight); if (result) setFeedback(result.reason); refresh(); return result }, [refresh])
  const requestDealerQuotes = useCallback((intent: FundTradeIntent, dealerCount: number) => { const result = engineRef.current?.requestDealerQuotes(intent, dealerCount); if (result) setFeedback(result.reason); refresh(); return result }, [refresh])
  const acceptDealerQuote = useCallback((quoteId: string, fillFraction = 1) => { const result = engineRef.current?.acceptDealerQuote(quoteId, fillFraction); if (result) setFeedback(result.reason); refresh(); return result }, [refresh])
  const cancelDealerRfq = useCallback(() => { const result = engineRef.current?.cancelDealerRfq(); if (result) setFeedback(result.reason); refresh(); return result }, [refresh])
  const startWorkingOrder = useCallback((intent: FundTradeIntent, style: FundWorkingStyle, durationSeconds: number) => { const result = engineRef.current?.startWorkingOrder(intent, style, durationSeconds); if (result) setFeedback(result.reason); refresh(); return result }, [refresh])
  const pauseWorkingOrder = useCallback((id: string) => { engineRef.current?.pauseWorkingOrder(id); refresh() }, [refresh])
  const resumeWorkingOrder = useCallback((id: string) => { engineRef.current?.resumeWorkingOrder(id); refresh() }, [refresh])
  const cancelWorkingOrder = useCallback((id: string) => { engineRef.current?.cancelWorkingOrder(id); refresh() }, [refresh])
  const crossWorkingOrder = useCallback((id: string) => { const result = engineRef.current?.crossWorkingOrder(id); if (result) setFeedback(result.reason); refresh(); return result }, [refresh])
  const hedgeBeta = useCallback(() => { const result = engineRef.current?.hedgeBeta(); if (result) setFeedback(result.reason); refresh(); return result }, [refresh])
  const pause = useCallback(() => { engineRef.current?.pause(); refresh() }, [refresh])
  const resume = useCallback(() => { engineRef.current?.resume(); refresh() }, [refresh])
  const finish = useCallback(() => { engineRef.current?.finish(); refresh() }, [refresh])

  return { snapshot, feedback, startSession, reset, executeTarget, executeAuction, requestLocate, requestDealerQuotes, acceptDealerQuote, cancelDealerRfq, startWorkingOrder, pauseWorkingOrder, resumeWorkingOrder, cancelWorkingOrder, crossWorkingOrder, hedgeBeta, pause, resume, finish }
}

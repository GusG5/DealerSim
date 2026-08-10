import { useCallback, useEffect, useRef, useState } from 'react'
import { MultiDealerSimEngine } from '../engine/multi-session'
import type {
  MultiSessionOptions,
  MultiSessionSnapshot,
  TradeSide,
  WorkingHedgeStrategy,
} from '../types'

export interface MultiDealerSimController {
  snapshot?: MultiSessionSnapshot
  resolvedScenarios?: string[]
  startSession: (options: MultiSessionOptions) => void
  pause: () => void
  resume: () => void
  finishEarly: () => void
  submitQuote: (instrumentId: string, bid?: number, ask?: number) => void
  passRfq: (instrumentId: string) => void
  hedgeMarket: (instrumentId: string, side: TradeSide, sizeM: number) => void
  hedgeInterdealer: (instrumentId: string, side: TradeSide, sizeM: number) => void
  startWorkingHedge: (
    instrumentId: string,
    side: TradeSide,
    sizeM: number,
    strategy: WorkingHedgeStrategy,
    clipSizeM: number,
    intervalSeconds: number,
  ) => void
  cancelWorkingHedge: (instrumentId: string, orderId: string) => void
  pauseWorkingHedge: (instrumentId: string, orderId: string) => void
  resumeWorkingHedge: (instrumentId: string, orderId: string) => void
  modifyWorkingHedge: (instrumentId: string, orderId: string, clipSizeM: number, intervalSeconds: number) => void
  crossWorkingHedge: (instrumentId: string, orderId: string) => void
  placePassiveOrder: (instrumentId: string, side: TradeSide, price: number, sizeM: number) => void
  cancelPassiveOrder: (instrumentId: string, orderId: string) => void
  reset: () => void
}

export function useMultiDealerSim(): MultiDealerSimController {
  const [snapshot, setSnapshot] = useState<MultiSessionSnapshot | undefined>()
  const [resolvedScenarios, setResolvedScenarios] = useState<string[] | undefined>()
  const engineRef = useRef<MultiDealerSimEngine | null>(null)
  const frameRef = useRef<number | undefined>(undefined)
  const lastFrameRef = useRef<number | undefined>(undefined)
  const lastRenderRef = useRef(0)
  const accumulatorRef = useRef(0)

  const stopLoop = useCallback(() => {
    if (frameRef.current !== undefined) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = undefined
    }
    lastFrameRef.current = undefined
    accumulatorRef.current = 0
  }, [])

  const runLoop = useCallback((timestamp: number) => {
    const engine = engineRef.current
    if (!engine) return
    const previous = lastFrameRef.current ?? timestamp
    const dt = Math.min(0.25, Math.max(0, (timestamp - previous) / 1000))
    lastFrameRef.current = timestamp
    accumulatorRef.current += dt
    let status = engine.getStatus()
    while (accumulatorRef.current >= 0.1 && status === 'running') {
      status = engine.tick(0.1, false).status
      accumulatorRef.current -= 0.1
    }
    if (timestamp - lastRenderRef.current >= 200 || status === 'finished') {
      lastRenderRef.current = timestamp
      setSnapshot(engine.getSnapshot())
    }
    if (status === 'running') frameRef.current = window.requestAnimationFrame(runLoop)
    else stopLoop()
  }, [stopLoop])

  const startLoop = useCallback(() => {
    stopLoop()
    lastFrameRef.current = undefined
    frameRef.current = window.requestAnimationFrame(runLoop)
  }, [runLoop, stopLoop])

  const startSession = useCallback((options: MultiSessionOptions) => {
    stopLoop()
    const engine = new MultiDealerSimEngine(options)
    engineRef.current = engine
    setResolvedScenarios(engine.getResolvedScenarios())
    setSnapshot(engine.start())
    startLoop()
  }, [startLoop, stopLoop])

  const pause = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    setSnapshot(engine.pause())
    stopLoop()
  }, [stopLoop])

  const resume = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    setSnapshot(engine.start())
    startLoop()
  }, [startLoop])

  const finishEarly = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    setSnapshot(engine.finishEarly())
    stopLoop()
  }, [stopLoop])

  const route = useCallback((action: (engine: MultiDealerSimEngine) => MultiSessionSnapshot) => {
    const engine = engineRef.current
    if (!engine) return
    setSnapshot(action(engine))
  }, [])

  const reset = useCallback(() => {
    stopLoop()
    engineRef.current = null
    setSnapshot(undefined)
    setResolvedScenarios(undefined)
  }, [stopLoop])

  useEffect(() => stopLoop, [stopLoop])

  return {
    snapshot,
    resolvedScenarios,
    startSession,
    pause,
    resume,
    finishEarly,
    submitQuote: (instrumentId, bid, ask) => route((engine) => engine.submitQuote(instrumentId, bid, ask)),
    passRfq: (instrumentId) => route((engine) => engine.passRfq(instrumentId)),
    hedgeMarket: (instrumentId, side, sizeM) => route((engine) => engine.hedgeMarket(instrumentId, side, sizeM)),
    hedgeInterdealer: (instrumentId, side, sizeM) => route((engine) => engine.hedgeInterdealer(instrumentId, side, sizeM)),
    startWorkingHedge: (instrumentId, side, sizeM, strategy, clipSizeM, intervalSeconds) =>
      route((engine) => engine.startWorkingHedge(instrumentId, side, sizeM, strategy, clipSizeM, intervalSeconds)),
    cancelWorkingHedge: (instrumentId, orderId) => route((engine) => engine.cancelWorkingHedge(instrumentId, orderId)),
    pauseWorkingHedge: (instrumentId, orderId) => route((engine) => engine.pauseWorkingHedge(instrumentId, orderId)),
    resumeWorkingHedge: (instrumentId, orderId) => route((engine) => engine.resumeWorkingHedge(instrumentId, orderId)),
    modifyWorkingHedge: (instrumentId, orderId, clipSizeM, intervalSeconds) => route((engine) => engine.modifyWorkingHedge(instrumentId, orderId, clipSizeM, intervalSeconds)),
    crossWorkingHedge: (instrumentId, orderId) => route((engine) => engine.crossWorkingHedge(instrumentId, orderId)),
    placePassiveOrder: (instrumentId, side, price, sizeM) => route((engine) => engine.placePassiveOrder(instrumentId, side, price, sizeM)),
    cancelPassiveOrder: (instrumentId, orderId) => route((engine) => engine.cancelPassiveOrder(instrumentId, orderId)),
    reset,
  }
}

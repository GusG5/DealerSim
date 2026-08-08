import { useCallback, useEffect, useRef, useState } from 'react'
import { DealerSimEngine } from '../engine/session'
import type { SessionOptions, SessionSnapshot, TradeSide, WorkingHedgeStrategy } from '../types'

export interface DealerSimController {
  snapshot?: SessionSnapshot
  resolvedScenario?: string
  startSession: (options: SessionOptions) => void
  pause: () => void
  resume: () => void
  finishEarly: () => void
  submitQuote: (bid?: number, ask?: number) => void
  passRfq: () => void
  hedgeMarket: (side: TradeSide, sizeM: number) => void
  startWorkingHedge: (side: TradeSide, sizeM: number, strategy: WorkingHedgeStrategy, clipSizeM: number, intervalSeconds: number) => void
  cancelWorkingHedge: (orderId: string) => void
  pauseWorkingHedge: (orderId: string) => void
  resumeWorkingHedge: (orderId: string) => void
  modifyWorkingHedge: (orderId: string, clipSizeM: number, intervalSeconds: number) => void
  crossWorkingHedge: (orderId: string) => void
  placePassiveOrder: (side: TradeSide, price: number, sizeM: number) => void
  cancelPassiveOrder: (orderId: string) => void
  reset: () => void
}

export function useDealerSim(): DealerSimController {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | undefined>(undefined)
  const [resolvedScenario, setResolvedScenario] = useState<string | undefined>(undefined)
  const engineRef = useRef<DealerSimEngine | null>(null)
  const frameRef = useRef<number | undefined>(undefined)
  const lastFrameRef = useRef<number | undefined>(undefined)
  const lastRenderRef = useRef<number>(0)
  const accumulatorRef = useRef<number>(0)

  const stopLoop = useCallback(() => {
    if (frameRef.current !== undefined) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = undefined
    }
    lastFrameRef.current = undefined
    accumulatorRef.current = 0
  }, [])

  const runLoop = useCallback(
    (timestamp: number) => {
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

      if (status === 'running') {
        frameRef.current = window.requestAnimationFrame(runLoop)
      } else {
        stopLoop()
      }
    },
    [stopLoop],
  )

  const startLoop = useCallback(() => {
    stopLoop()
    lastFrameRef.current = undefined
    frameRef.current = window.requestAnimationFrame(runLoop)
  }, [runLoop, stopLoop])

  const startSession = useCallback(
    (options: SessionOptions) => {
      stopLoop()
      const engine = new DealerSimEngine(options)
      engineRef.current = engine
      setResolvedScenario(engine.getResolvedScenario())
      setSnapshot(engine.start())
      startLoop()
    },
    [startLoop, stopLoop],
  )

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

  const submitQuote = useCallback((bid?: number, ask?: number) => {
    const engine = engineRef.current
    if (!engine) return
    setSnapshot(engine.submitQuote(bid, ask))
  }, [])

  const passRfq = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    setSnapshot(engine.passRfq())
  }, [])

  const hedgeMarket = useCallback((side: TradeSide, sizeM: number) => {
    const engine = engineRef.current
    if (!engine) return
    setSnapshot(engine.hedgeMarket(side, sizeM))
  }, [])

  const startWorkingHedge = useCallback((
    side: TradeSide,
    sizeM: number,
    strategy: WorkingHedgeStrategy,
    clipSizeM: number,
    intervalSeconds: number,
  ) => {
    const engine = engineRef.current
    if (!engine) return
    setSnapshot(engine.startWorkingHedge(side, sizeM, strategy, clipSizeM, intervalSeconds))
  }, [])

  const cancelWorkingHedge = useCallback((orderId: string) => {
    const engine = engineRef.current
    if (!engine) return
    setSnapshot(engine.cancelWorkingHedge(orderId))
  }, [])

  const pauseWorkingHedge = useCallback((orderId: string) => { const engine = engineRef.current; if (engine) setSnapshot(engine.pauseWorkingHedge(orderId)) }, [])
  const resumeWorkingHedge = useCallback((orderId: string) => { const engine = engineRef.current; if (engine) setSnapshot(engine.resumeWorkingHedge(orderId)) }, [])
  const modifyWorkingHedge = useCallback((orderId: string, clipSizeM: number, intervalSeconds: number) => { const engine = engineRef.current; if (engine) setSnapshot(engine.modifyWorkingHedge(orderId, clipSizeM, intervalSeconds)) }, [])
  const crossWorkingHedge = useCallback((orderId: string) => { const engine = engineRef.current; if (engine) setSnapshot(engine.crossWorkingHedge(orderId)) }, [])

  const placePassiveOrder = useCallback(
    (side: TradeSide, price: number, sizeM: number) => {
      const engine = engineRef.current
      if (!engine) return
      setSnapshot(engine.placePassiveOrder(side, price, sizeM))
    },
    [],
  )

  const cancelPassiveOrder = useCallback((orderId: string) => {
    const engine = engineRef.current
    if (!engine) return
    setSnapshot(engine.cancelPassiveOrder(orderId))
  }, [])

  const reset = useCallback(() => {
    stopLoop()
    engineRef.current = null
    setSnapshot(undefined)
    setResolvedScenario(undefined)
  }, [stopLoop])

  useEffect(() => stopLoop, [stopLoop])

  return {
    snapshot,
    resolvedScenario,
    startSession,
    pause,
    resume,
    finishEarly,
    submitQuote,
    passRfq,
    hedgeMarket,
    startWorkingHedge,
    cancelWorkingHedge,
    pauseWorkingHedge,
    resumeWorkingHedge,
    modifyWorkingHedge,
    crossWorkingHedge,
    placePassiveOrder,
    cancelPassiveOrder,
    reset,
  }
}

import { useEffect, useRef, useState } from 'react'
import { ProgressCentre } from './components/ProgressCentre'
import { FundReviewScreen } from './components/FundReviewScreen'
import { FundPremarketSetup } from './components/FundPremarketSetup'
import { FundTradingTerminal } from './components/FundTradingTerminal'
import { FundTutorial } from './components/FundTutorial'
import { InteractiveTutorial } from './components/InteractiveTutorial'
import { MacroMethodologyModal } from './components/MacroMethodologyModal'
import { MacroReviewScreen } from './components/MacroReviewScreen'
import { MacroSessionSetup } from './components/MacroSessionSetup'
import { MacroTradingTerminal } from './components/MacroTradingTerminal'
import { LiveMacroTradingTerminal } from './components/LiveMacroTradingTerminal'
import { LiveMacroPremarketSetup } from './components/LiveMacroPremarketSetup'
import { LiveMacroReviewScreen } from './components/LiveMacroReviewScreen'
import { LiveMacroTutorial } from './components/LiveMacroTutorial'
import { MacroTutorial } from './components/MacroTutorial'
import { MethodologyModal } from './components/MethodologyModal'
import { MultiReviewScreen } from './components/MultiReviewScreen'
import { MultiTradingTerminal } from './components/MultiTradingTerminal'
import { ReviewScreen } from './components/ReviewScreen'
import { SessionSetup } from './components/SessionSetup'
import { TradingTerminal } from './components/TradingTerminal'
import { APEX_EQUITY } from './engine/config'
import { useDealerSim } from './hooks/useDealerSim'
import { useFundSim } from './hooks/useFundSim'
import { useMultiDealerSim } from './hooks/useMultiDealerSim'
import { useMacroSim } from './hooks/useMacroSim'
import { useLiveMacroSim } from './hooks/useLiveMacroSim'
import { playSound } from './lib/audio'
import {
  clearDealerClientRelationships,
  consumeStorageRecoveryNotice,
  clearFundSessionSummaries,
  clearMacroSessionSummaries,
  clearSessionSummaries,
  loadDealerClientRelationships,
  loadFundDealerRelationships,
  loadFundSessionSummaries,
  loadMacroSessionSummaries,
  loadSessionSummaries,
  loadSettings,
  saveFundDealerRelationships,
  saveFundSessionSummary,
  saveMacroSessionSummary,
  saveSessionSummary,
  saveSettings,
  updateDealerClientRelationships,
  type StoredSettings,
} from './lib/storage'
import type { FundMandate, FundSessionOptions, FundSessionSummary } from './engine/fund-types'
import type { MacroSessionOptions, MacroSessionSummary } from './engine/macro-types'
import type { LiveMacroSessionOptions } from './engine/live-macro-types'
import type { MultiSessionOptions, SessionOptions, SessionSummary } from './types'

export default function App() {
  const controller = useDealerSim()
  const multiController = useMultiDealerSim()
  const macroController = useMacroSim()
  const liveMacroController = useLiveMacroSim()
  const fundController = useFundSim()
  const [summaries, setSummaries] = useState<SessionSummary[]>(() => loadSessionSummaries())
  const [macroSummaries, setMacroSummaries] = useState<MacroSessionSummary[]>(() => loadMacroSessionSummaries())
  const [fundSummaries, setFundSummaries] = useState<FundSessionSummary[]>(() => loadFundSessionSummaries())
  const [storageNotice, setStorageNotice] = useState<string | null>(() => consumeStorageRecoveryNotice())
  const [surface, setSurface] = useState<'dealer' | 'macro'>('dealer')
  const [showMacroTutorial, setShowMacroTutorial] = useState(false)
  const [showLiveMacroTutorial, setShowLiveMacroTutorial] = useState(false)
  const [fundTutorialMandate, setFundTutorialMandate] = useState<FundMandate | null>(null)
  const [pendingFundPremarket, setPendingFundPremarket] = useState<FundSessionOptions | null>(null)
  const [pendingLiveMacroPremarket, setPendingLiveMacroPremarket] = useState<LiveMacroSessionOptions | null>(null)
  const [showMacroMethodology, setShowMacroMethodology] = useState(false)
  const [settings, setSettings] = useState<StoredSettings>(() => loadSettings())
  const [showTutorial, setShowTutorial] = useState(() => !loadSettings().tutorialSeen)
  const [showMethodology, setShowMethodology] = useState(false)
  const [showProgressCentre, setShowProgressCentre] = useState(false)
  const previousRfqRef = useRef<string | undefined>(undefined)
  const previousTradeCountRef = useRef(0)
  const previousEventIdRef = useRef<string | undefined>(undefined)
  const previousStatusRef = useRef<string | undefined>(undefined)
  const savedResultRef = useRef<string | undefined>(undefined)
  const multiPreviousRfqRef = useRef<string>('')
  const multiPreviousTradeCountRef = useRef(0)
  const multiPreviousEventIdRef = useRef<string | undefined>(undefined)
  const multiPreviousStatusRef = useRef<string | undefined>(undefined)
  const multiSavedResultRef = useRef<string | undefined>(undefined)
  const macroSavedResultRef = useRef<string | undefined>(undefined)
  const liveMacroSavedResultRef = useRef<string | undefined>(undefined)
  const fundSavedResultRef = useRef<string | undefined>(undefined)

  const snapshot = controller.snapshot
  const multiSnapshot = multiController.snapshot
  const macroSnapshot = macroController.snapshot
  const liveMacroSnapshot = liveMacroController.snapshot
  const fundSnapshot = fundController.snapshot

  useEffect(() => {
    if (!snapshot || multiSnapshot) return
    if (snapshot.elapsedSeconds < 0.25 && snapshot.status === 'running') {
      previousRfqRef.current = undefined
      previousTradeCountRef.current = 0
      previousEventIdRef.current = undefined
      previousStatusRef.current = undefined
      savedResultRef.current = undefined
    }
    const activeRfqId = snapshot.activeRfq?.id
    if (activeRfqId && activeRfqId !== previousRfqRef.current) playSound('rfq', settings.muted)
    previousRfqRef.current = activeRfqId

    if (snapshot.trades.length > previousTradeCountRef.current) playSound('trade', settings.muted)
    previousTradeCountRef.current = snapshot.trades.length

    const newestEvent = snapshot.events[0]
    if (newestEvent && newestEvent.id !== previousEventIdRef.current) {
      if (newestEvent.category === 'news' && newestEvent.severity === 'critical') playSound('news', settings.muted)
      else if (newestEvent.severity === 'critical' || newestEvent.category === 'risk') playSound('warning', settings.muted)
    }
    previousEventIdRef.current = newestEvent?.id

    if (snapshot.status === 'finished' && previousStatusRef.current !== 'finished') playSound('finish', settings.muted)
    previousStatusRef.current = snapshot.status
  }, [multiSnapshot, settings.muted, snapshot])

  useEffect(() => {
    if (!multiSnapshot) return
    if (multiSnapshot.elapsedSeconds < 0.25 && multiSnapshot.status === 'running') {
      multiPreviousRfqRef.current = ''
      multiPreviousTradeCountRef.current = 0
      multiPreviousEventIdRef.current = undefined
      multiPreviousStatusRef.current = undefined
      multiSavedResultRef.current = undefined
    }
    const activeIds = multiSnapshot.legs.map((leg) => leg.activeRfq?.id ?? '').join('|')
    if (activeIds !== multiPreviousRfqRef.current && multiSnapshot.legs.some((leg) => leg.activeRfq)) playSound('rfq', settings.muted)
    multiPreviousRfqRef.current = activeIds

    const tradeCount = multiSnapshot.legs.reduce((total, leg) => total + leg.trades.length, 0)
    if (tradeCount > multiPreviousTradeCountRef.current) playSound('trade', settings.muted)
    multiPreviousTradeCountRef.current = tradeCount

    const newestEvent = multiSnapshot.events[0]
    if (newestEvent && newestEvent.id !== multiPreviousEventIdRef.current) {
      if (newestEvent.category === 'news' && newestEvent.severity === 'critical') playSound('news', settings.muted)
      else if (newestEvent.severity === 'critical' || newestEvent.category === 'risk') playSound('warning', settings.muted)
    }
    multiPreviousEventIdRef.current = newestEvent?.id
    if (multiSnapshot.status === 'finished' && multiPreviousStatusRef.current !== 'finished') playSound('finish', settings.muted)
    multiPreviousStatusRef.current = multiSnapshot.status
  }, [multiSnapshot, settings.muted])

  useEffect(() => {
    if (!snapshot?.score || snapshot.status !== 'finished' || multiSnapshot) return
    const saveKey = `${snapshot.options.seed}-${snapshot.elapsedSeconds}-${snapshot.score.overall}`
    if (savedResultRef.current === saveKey) return
    savedResultRef.current = saveKey
    const acceptanceRate = snapshot.metrics.quotesSubmitted > 0 ? snapshot.metrics.quotesAccepted / snapshot.metrics.quotesSubmitted : 0
    const staleQuoteRate = snapshot.metrics.quotesSubmitted > 0 ? snapshot.metrics.staleQuotes / snapshot.metrics.quotesSubmitted : 0
    const summary: SessionSummary = {
      id: `${snapshot.options.seed}-${Date.now()}`,
      completedAt: new Date().toISOString(),
      seed: snapshot.options.seed,
      scenario: (controller.resolvedScenario ?? snapshot.options.scenario) as SessionSummary['scenario'],
      difficulty: snapshot.options.difficulty,
      instrumentId: snapshot.options.instrument.id,
      instrumentSymbol: snapshot.options.instrument.symbol,
      score: snapshot.score.overall,
      rating: snapshot.score.rating,
      netPnl: snapshot.currentEquity,
      grossCommission: snapshot.position.grossCommission,
      maximumInventoryM: snapshot.metrics.maximumInventoryM,
      acceptanceRate,
      staleQuoteRate,
      sessionMode: 'single',
      durationSeconds: snapshot.options.durationSeconds,
      averageCommission: snapshot.metrics.clientTrades > 0 ? snapshot.position.grossCommission / snapshot.metrics.clientTrades : 0,
      internalisationRate: snapshot.metrics.grossClientVolumeM > 0 ? snapshot.metrics.internalisedVolumeM / snapshot.metrics.grossClientVolumeM : 0,
      marketImpactCost: snapshot.metrics.marketImpactCost,
      maximumDrawdown: snapshot.metrics.maximumDrawdown,
      rfqsExpired: snapshot.metrics.rfqsExpired,
      quotesSubmitted: snapshot.metrics.quotesSubmitted,
      grossClientVolumeM: snapshot.metrics.grossClientVolumeM,
      pnlCurrency: snapshot.options.instrument.quoteCurrency,
      pnlScore: snapshot.score.pnl,
      commissionScore: snapshot.score.commission,
      inventoryScore: snapshot.score.inventory,
      quoteQualityScore: snapshot.score.quoteQuality,
      adverseSelectionScore: snapshot.score.adverseSelection,
      executionScore: snapshot.score.execution,
    }
    saveSessionSummary(summary)
    updateDealerClientRelationships(snapshot.quoteHistory)
    setSummaries(loadSessionSummaries())
  }, [controller.resolvedScenario, multiSnapshot, snapshot])

  useEffect(() => {
    if (!multiSnapshot?.score || multiSnapshot.status !== 'finished') return
    const saveKey = `${multiSnapshot.options.seed}-${multiSnapshot.elapsedSeconds}-${multiSnapshot.score.overall}`
    if (multiSavedResultRef.current === saveKey) return
    multiSavedResultRef.current = saveKey
    const quotes = multiSnapshot.portfolio.quotesSubmitted
    const stale = multiSnapshot.legs.reduce((total, leg) => total + leg.metrics.staleQuotes, 0)
    const summary: SessionSummary = {
      id: `multi-${multiSnapshot.options.seed}-${Date.now()}`,
      completedAt: new Date().toISOString(),
      seed: multiSnapshot.options.seed,
      scenario: multiSnapshot.options.scenario,
      difficulty: multiSnapshot.options.difficulty,
      instrumentId: 'multi',
      instrumentSymbol: multiSnapshot.options.instruments.map((instrument) => instrument.symbol).join(' + '),
      score: multiSnapshot.score.overall,
      rating: multiSnapshot.score.rating,
      netPnl: multiSnapshot.portfolio.totalPnl,
      grossCommission: multiSnapshot.portfolio.totalCommission,
      maximumInventoryM: multiSnapshot.portfolio.peakGrossRiskUtilisation,
      acceptanceRate: quotes > 0 ? multiSnapshot.portfolio.quotesAccepted / quotes : 0,
      staleQuoteRate: quotes > 0 ? stale / quotes : 0,
      sessionMode: multiSnapshot.options.instruments.length === 3 ? 'triple' : 'dual',
      durationSeconds: multiSnapshot.options.durationSeconds,
      averageCommission: multiSnapshot.portfolio.quotesAccepted > 0 ? multiSnapshot.portfolio.totalCommission / multiSnapshot.portfolio.quotesAccepted : 0,
      internalisationRate: multiSnapshot.attribution?.internalisationRate ?? 0,
      marketImpactCost: Math.abs(multiSnapshot.attribution?.marketImpact ?? 0),
      maximumDrawdown: multiSnapshot.legs.reduce((total, leg) => total + Math.abs(leg.metrics.maximumDrawdown), 0),
      rfqsExpired: multiSnapshot.portfolio.rfqsExpired,
      quotesSubmitted: multiSnapshot.portfolio.quotesSubmitted,
      grossClientVolumeM: multiSnapshot.legs.reduce((total, leg) => total + leg.metrics.grossClientVolumeM, 0),
      pnlCurrency: 'USD_EQ',
      pnlScore: multiSnapshot.score.pnl,
      commissionScore: multiSnapshot.score.commission,
      inventoryScore: multiSnapshot.score.inventory,
      quoteQualityScore: multiSnapshot.score.quoteQuality,
      adverseSelectionScore: multiSnapshot.score.adverseSelection,
      executionScore: multiSnapshot.score.execution,
    }
    saveSessionSummary(summary)
    multiSnapshot.legs.forEach((leg) => updateDealerClientRelationships(leg.quoteHistory))
    setSummaries(loadSessionSummaries())
  }, [multiSnapshot])

  useEffect(() => {
    if (!macroSnapshot?.score || macroSnapshot.status !== 'finished') return
    const saveKey = `${macroSnapshot.options.seed}-${macroSnapshot.day}-${macroSnapshot.score.overall.toFixed(2)}`
    if (macroSavedResultRef.current === saveKey) return
    macroSavedResultRef.current = saveKey
    const summary: MacroSessionSummary = {
      id: `macro-${macroSnapshot.options.seed}-${Date.now()}`,
      mode: 'strategic',
      completedAt: new Date().toISOString(),
      seed: macroSnapshot.options.seed,
      scenario: macroSnapshot.options.scenario,
      difficulty: macroSnapshot.options.difficulty,
      returnPct: macroSnapshot.nav / macroSnapshot.options.initialNav - 1,
      score: macroSnapshot.score.overall,
      rating: macroSnapshot.score.rating,
      maxDrawdown: macroSnapshot.maxDrawdown,
      turnover: macroSnapshot.turnover,
      grossExposure: macroSnapshot.peakGrossExposure,
      transactionCosts: macroSnapshot.transactionCosts,
      commissions: macroSnapshot.commissions,
      dealerTrades: macroSnapshot.dealerTrades,
      dealerSavings: macroSnapshot.dealerSavings,
      returnScore: macroSnapshot.score.return,
      riskScore: macroSnapshot.score.risk,
      sizingScore: macroSnapshot.score.sizing,
      thesisScore: macroSnapshot.score.thesis,
      efficiencyScore: macroSnapshot.score.efficiency,
      adaptabilityScore: macroSnapshot.score.adaptability,
    }
    saveMacroSessionSummary(summary)
    setMacroSummaries(loadMacroSessionSummaries())
  }, [macroSnapshot])

  useEffect(() => {
    if (!liveMacroSnapshot?.score || liveMacroSnapshot.status !== 'finished') return
    const saveKey = `${liveMacroSnapshot.options.seed}-${liveMacroSnapshot.elapsedSeconds.toFixed(1)}-${liveMacroSnapshot.score.overall.toFixed(2)}`
    if (liveMacroSavedResultRef.current === saveKey) return
    liveMacroSavedResultRef.current = saveKey
    const summary: MacroSessionSummary = {
      id: `live-macro-${liveMacroSnapshot.options.seed}-${Date.now()}`,
      mode: 'live',
      durationSeconds: liveMacroSnapshot.options.durationSeconds,
      completedAt: new Date().toISOString(),
      seed: liveMacroSnapshot.options.seed,
      scenario: liveMacroSnapshot.options.scenario,
      difficulty: liveMacroSnapshot.options.difficulty,
      startingPortfolio: liveMacroSnapshot.options.startingPortfolio,
      returnPct: liveMacroSnapshot.nav / liveMacroSnapshot.options.initialNav - 1,
      score: liveMacroSnapshot.score.overall,
      rating: liveMacroSnapshot.score.rating,
      maxDrawdown: liveMacroSnapshot.maxDrawdown,
      turnover: liveMacroSnapshot.turnover,
      grossExposure: liveMacroSnapshot.peakGrossExposure,
      transactionCosts: liveMacroSnapshot.transactionCosts,
      commissions: liveMacroSnapshot.commissions,
      dealerTrades: liveMacroSnapshot.dealerTrades,
      dealerSavings: liveMacroSnapshot.dealerSavings,
      returnScore: liveMacroSnapshot.score.return,
      riskScore: liveMacroSnapshot.score.risk,
      sizingScore: liveMacroSnapshot.score.sizing,
      thesisScore: liveMacroSnapshot.score.thesis,
      efficiencyScore: liveMacroSnapshot.score.efficiency,
      adaptabilityScore: liveMacroSnapshot.score.adaptability,
    }
    saveMacroSessionSummary(summary)
    setMacroSummaries(loadMacroSessionSummaries())
  }, [liveMacroSnapshot])

  useEffect(() => {
    if (!fundSnapshot?.score || fundSnapshot.status !== 'finished') return
    const saveKey = `${fundSnapshot.options.seed}-${fundSnapshot.elapsedSeconds.toFixed(1)}-${fundSnapshot.score.overall.toFixed(2)}`
    if (fundSavedResultRef.current === saveKey) return
    fundSavedResultRef.current = saveKey
    const summary: FundSessionSummary = {
      id: `fund-${fundSnapshot.options.mandate}-${fundSnapshot.options.seed}-${Date.now()}`,
      completedAt: new Date().toISOString(),
      mandate: fundSnapshot.options.mandate,
      seed: fundSnapshot.options.seed,
      scenario: fundSnapshot.options.scenario,
      difficulty: fundSnapshot.options.difficulty,
      startingPortfolio: fundSnapshot.options.startingPortfolio,
      returnPct: fundSnapshot.nav / fundSnapshot.options.initialNav - 1,
      benchmarkReturnPct: fundSnapshot.benchmarkNav / fundSnapshot.options.initialNav - 1,
      alphaPct: fundSnapshot.options.mandate === 'long-only' ? (fundSnapshot.nav - fundSnapshot.benchmarkNav) / fundSnapshot.options.initialNav : fundSnapshot.attribution.alphaPnl / fundSnapshot.options.initialNav,
      score: fundSnapshot.score.overall,
      rating: fundSnapshot.score.rating,
      maxDrawdown: fundSnapshot.maxDrawdown,
      turnover: fundSnapshot.turnover,
      peakGrossExposure: fundSnapshot.peakGrossExposure,
      peakBetaExposure: fundSnapshot.peakBetaExposure,
      transactionCosts: fundSnapshot.transactionCosts,
      commissions: fundSnapshot.commissions,
      borrowCosts: fundSnapshot.borrowCosts,
      dealerTrades: fundSnapshot.dealerTrades,
      dealerSavings: fundSnapshot.dealerSavings,
      implementationShortfallBps: fundSnapshot.executionQuality.implementationShortfallBps,
      timingCostBps: fundSnapshot.executionQuality.timingCostBps,
      marketImpactBps: fundSnapshot.executionQuality.marketImpactBps,
      dealerFillRate: fundSnapshot.dealerRfqs.length > 0 ? fundSnapshot.dealerTrades / fundSnapshot.dealerRfqs.length : 0,
      alphaScore: fundSnapshot.score.alpha,
      riskScore: fundSnapshot.score.risk,
      sizingScore: fundSnapshot.score.sizing,
      executionScore: fundSnapshot.score.execution,
      thesisScore: fundSnapshot.score.thesis,
      efficiencyScore: fundSnapshot.score.efficiency,
      resolvedScenario: fundSnapshot.resolvedScenario,
      correlationRegime: fundSnapshot.marketContext.correlationRegime,
      bestAssetSymbol: Object.entries(fundSnapshot.attribution.byAsset).sort((a, b) => b[1] - a[1])[0]?.[0]?.replace('-fund', '').toUpperCase(),
      worstAssetSymbol: Object.entries(fundSnapshot.attribution.byAsset).sort((a, b) => a[1] - b[1])[0]?.[0]?.replace('-fund', '').toUpperCase(),
      assetPnl: { ...fundSnapshot.attribution.byAsset },
    }
    saveFundSessionSummary(summary)
    saveFundDealerRelationships(fundSnapshot.dealerRelationships)
    setFundSummaries(loadFundSessionSummaries())
  }, [fundSnapshot])

  const updateSettings = (next: StoredSettings) => {
    setSettings(next)
    saveSettings(next)
  }

  const finishTutorial = () => updateSettings({ ...settings, tutorialSeen: true })
  const exitTutorial = () => setShowTutorial(false)

  const startCoachedPractice = () => {
    setShowTutorial(false)
    multiController.reset()
    controller.startSession({
      seed: 830_021,
      scenario: 'balanced',
      difficulty: 'learning',
      durationSeconds: 3 * 60,
      instrument: APEX_EQUITY,
      coachingMode: 'assisted',
      clientMemory: loadDealerClientRelationships(),
    })
  }

  const startSingle = (options: SessionOptions) => {
    multiController.reset()
    controller.startSession({ ...options, clientMemory: loadDealerClientRelationships() })
  }

  const startMulti = (options: MultiSessionOptions) => {
    controller.reset()
    multiController.startSession({ ...options, clientMemory: loadDealerClientRelationships() })
  }

  const startMacro = (options: MacroSessionOptions) => {
    controller.reset()
    multiController.reset()
    fundController.reset()
    setSurface('macro')
    macroSavedResultRef.current = undefined
    macroController.startSession(options)
  }

  const startLiveMacro = (options: LiveMacroSessionOptions) => {
    controller.reset()
    multiController.reset()
    macroController.reset()
    fundController.reset()
    setSurface('macro')
    liveMacroSavedResultRef.current = undefined
    setPendingFundPremarket(null)
    setPendingLiveMacroPremarket(options)
  }

  const openLiveMacroMarket = (options: LiveMacroSessionOptions) => {
    setPendingLiveMacroPremarket(null)
    liveMacroController.startSession(options)
  }

  const startFund = (options: FundSessionOptions) => {
    controller.reset()
    multiController.reset()
    macroController.reset()
    liveMacroController.reset()
    setSurface('macro')
    fundSavedResultRef.current = undefined
    setPendingLiveMacroPremarket(null)
    setPendingFundPremarket({ ...options, dealerMemory: loadFundDealerRelationships() })
  }

  const openFundMarket = (options: FundSessionOptions) => {
    setPendingFundPremarket(null)
    fundController.startSession(options)
  }

  const startGuidedMacro = () => {
    setShowMacroTutorial(false)
    startMacro({ seed: 620_021, scenario: 'inflation-resurgence', difficulty: 'learning', days: 30, initialNav: 100_000_000 })
  }

  const startGuidedLiveMacro = () => {
    setShowLiveMacroTutorial(false)
    startLiveMacro({ seed: 720_021, scenario: 'inflation-resurgence', difficulty: 'learning', durationSeconds: 15 * 60, initialNav: 100_000_000 })
  }

  const startGuidedFund = () => {
    const mandate = fundTutorialMandate ?? 'long-short'
    setFundTutorialMandate(null)
    startFund({ seed: 820_021, mandate, scenario: mandate === 'long-short' ? 'earnings-season' : 'stock-pickers', difficulty: 'learning', durationSeconds: 15 * 60, initialNav: 100_000_000 })
  }

  const backToDealer = () => {
    macroController.reset()
    liveMacroController.reset()
    fundController.reset()
    setPendingFundPremarket(null)
    setPendingLiveMacroPremarket(null)
    setFundTutorialMandate(null)
    setShowMacroTutorial(false)
    setShowLiveMacroTutorial(false)
    setShowMacroMethodology(false)
    setSurface('dealer')
  }

  const toggleMute = () => updateSettings({ ...settings, muted: !settings.muted })
  const clearHistory = () => { clearSessionSummaries(); setSummaries([]) }
  const clearAllHistory = () => {
    clearSessionSummaries()
    clearMacroSessionSummaries()
    clearFundSessionSummaries()
    clearDealerClientRelationships()
    setSummaries([])
    setMacroSummaries([])
    setFundSummaries([])
  }
  const noSession = !snapshot && !multiSnapshot

  return (
    <>
      {storageNotice && (
        <div className="storage-recovery-notice" role="status">
          <span>{storageNotice}</span>
          <button type="button" onClick={() => setStorageNotice(null)} aria-label="Dismiss storage notice">Dismiss</button>
        </div>
      )}
      {surface === 'dealer' && showTutorial && <InteractiveTutorial onExit={exitTutorial} onComplete={finishTutorial} onStartCoachedPractice={startCoachedPractice} />}

      {surface === 'dealer' && !showTutorial && noSession && (
        <SessionSetup
          summaries={summaries}
          onStart={startSingle}
          onStartMulti={startMulti}
          onOpenTutorial={() => setShowTutorial(true)}
          onOpenMethodology={() => setShowMethodology(true)}
          onOpenProgress={() => setShowProgressCentre(true)}
          onClearHistory={clearHistory}
          onOpenMacro={() => setSurface('macro')}
        />
      )}

      {surface === 'dealer' && !showTutorial && snapshot && !multiSnapshot && snapshot.status !== 'finished' && (
        <TradingTerminal
          snapshot={snapshot}
          resolvedScenario={controller.resolvedScenario}
          muted={settings.muted}
          onToggleMute={toggleMute}
          onPause={controller.pause}
          onResume={controller.resume}
          onFinish={controller.finishEarly}
          onSubmitQuote={controller.submitQuote}
          onPassRfq={controller.passRfq}
          onMarketHedge={controller.hedgeMarket}
          onInterdealerHedge={controller.hedgeInterdealer}
          onStartWorkingHedge={controller.startWorkingHedge}
          onCancelWorkingHedge={controller.cancelWorkingHedge}
          onPauseWorkingHedge={controller.pauseWorkingHedge}
          onResumeWorkingHedge={controller.resumeWorkingHedge}
          onModifyWorkingHedge={controller.modifyWorkingHedge}
          onCrossWorkingHedge={controller.crossWorkingHedge}
          onPassiveOrder={controller.placePassiveOrder}
          onCancelPassive={controller.cancelPassiveOrder}
        />
      )}

      {surface === 'dealer' && !showTutorial && multiSnapshot && multiSnapshot.status !== 'finished' && (
        <MultiTradingTerminal
          snapshot={multiSnapshot}
          muted={settings.muted}
          onToggleMute={toggleMute}
          onPause={multiController.pause}
          onResume={multiController.resume}
          onFinish={multiController.finishEarly}
          onSubmitQuote={multiController.submitQuote}
          onPassRfq={multiController.passRfq}
          onMarketHedge={multiController.hedgeMarket}
          onInterdealerHedge={multiController.hedgeInterdealer}
          onStartWorkingHedge={multiController.startWorkingHedge}
          onCancelWorkingHedge={multiController.cancelWorkingHedge}
          onPauseWorkingHedge={multiController.pauseWorkingHedge}
          onResumeWorkingHedge={multiController.resumeWorkingHedge}
          onModifyWorkingHedge={multiController.modifyWorkingHedge}
          onCrossWorkingHedge={multiController.crossWorkingHedge}
          onPassiveOrder={multiController.placePassiveOrder}
          onCancelPassive={multiController.cancelPassiveOrder}
        />
      )}

      {surface === 'dealer' && !showTutorial && snapshot?.status === 'finished' && !multiSnapshot && (
        <ReviewScreen snapshot={snapshot} resolvedScenario={controller.resolvedScenario} onReplay={() => controller.startSession({ ...snapshot.options, clientMemory: loadDealerClientRelationships() })} onNewSession={controller.reset} onOpenMethodology={() => setShowMethodology(true)} />
      )}

      {surface === 'dealer' && !showTutorial && multiSnapshot?.status === 'finished' && (
        <MultiReviewScreen snapshot={multiSnapshot} onReplay={() => multiController.startSession({ ...multiSnapshot.options, clientMemory: loadDealerClientRelationships() })} onNewSession={multiController.reset} onOpenMethodology={() => setShowMethodology(true)} />
      )}

      {surface === 'macro' && showMacroTutorial && <MacroTutorial onExit={() => setShowMacroTutorial(false)} onStartPractice={startGuidedMacro} />}
      {surface === 'macro' && showLiveMacroTutorial && <LiveMacroTutorial onExit={() => setShowLiveMacroTutorial(false)} onStartPractice={startGuidedLiveMacro} />}
      {surface === 'macro' && fundTutorialMandate && <FundTutorial mandate={fundTutorialMandate} onExit={() => setFundTutorialMandate(null)} onStartPractice={startGuidedFund} />}

      {surface === 'macro' && !showMacroTutorial && !showLiveMacroTutorial && !fundTutorialMandate && pendingFundPremarket && !fundSnapshot && (
        <FundPremarketSetup options={pendingFundPremarket} onOpenMarket={openFundMarket} onBack={() => setPendingFundPremarket(null)} />
      )}

      {surface === 'macro' && !showMacroTutorial && !showLiveMacroTutorial && !fundTutorialMandate && pendingLiveMacroPremarket && !liveMacroSnapshot && (
        <LiveMacroPremarketSetup options={pendingLiveMacroPremarket} onOpenMarket={openLiveMacroMarket} onBack={() => setPendingLiveMacroPremarket(null)} />
      )}

      {surface === 'macro' && !showMacroTutorial && !showLiveMacroTutorial && !fundTutorialMandate && !pendingFundPremarket && !pendingLiveMacroPremarket && !macroSnapshot && !liveMacroSnapshot && !fundSnapshot && (
        <MacroSessionSetup summaries={macroSummaries} fundSummaries={fundSummaries} onStart={startMacro} onStartLive={startLiveMacro} onStartFund={startFund} onBackDealer={backToDealer} onOpenTutorial={() => setShowMacroTutorial(true)} onOpenLiveTutorial={() => setShowLiveMacroTutorial(true)} onOpenFundTutorial={(mandate) => setFundTutorialMandate(mandate)} onOpenMethodology={() => setShowMacroMethodology(true)} onOpenProgress={() => setShowProgressCentre(true)} />
      )}

      {surface === 'macro' && !showMacroTutorial && !showLiveMacroTutorial && !fundTutorialMandate && fundSnapshot && fundSnapshot.status !== 'finished' && (
        <FundTradingTerminal snapshot={fundSnapshot} feedback={fundController.feedback} onExecuteTarget={fundController.executeTarget} onExecuteAuction={fundController.executeAuction} onRequestLocate={fundController.requestLocate} onRequestDealerQuotes={fundController.requestDealerQuotes} onAcceptDealerQuote={fundController.acceptDealerQuote} onCancelDealerRfq={fundController.cancelDealerRfq} onStartWorkingOrder={fundController.startWorkingOrder} onPauseWorkingOrder={fundController.pauseWorkingOrder} onResumeWorkingOrder={fundController.resumeWorkingOrder} onCancelWorkingOrder={fundController.cancelWorkingOrder} onCrossWorkingOrder={fundController.crossWorkingOrder} onHedgeBeta={fundController.hedgeBeta} onPause={fundController.pause} onResume={fundController.resume} onFinish={fundController.finish} />
      )}

      {surface === 'macro' && !showMacroTutorial && !showLiveMacroTutorial && !fundTutorialMandate && fundSnapshot?.status === 'finished' && (
        <FundReviewScreen snapshot={fundSnapshot} priorAttempts={fundSummaries.filter((item) => item.mandate === fundSnapshot.options.mandate && item.seed === fundSnapshot.options.seed)} onReplay={() => fundController.startSession({ ...fundSnapshot.options, dealerMemory: loadFundDealerRelationships() })} onNewSession={fundController.reset} />
      )}

      {surface === 'macro' && !showMacroTutorial && !showLiveMacroTutorial && liveMacroSnapshot && liveMacroSnapshot.status !== 'finished' && (
        <LiveMacroTradingTerminal snapshot={liveMacroSnapshot} feedback={liveMacroController.feedback} onExecuteTarget={liveMacroController.executeTarget} onRequestDealerQuotes={liveMacroController.requestDealerQuotes} onAcceptDealerQuote={liveMacroController.acceptDealerQuote} onCancelDealerRfq={liveMacroController.cancelDealerRfq} onStartWorkingOrder={liveMacroController.startWorkingOrder} onPauseWorkingOrder={liveMacroController.pauseWorkingOrder} onResumeWorkingOrder={liveMacroController.resumeWorkingOrder} onCancelWorkingOrder={liveMacroController.cancelWorkingOrder} onCrossWorkingOrder={liveMacroController.crossWorkingOrder} onPause={liveMacroController.pause} onResume={liveMacroController.resume} onFinish={liveMacroController.finish} />
      )}

      {surface === 'macro' && !showMacroTutorial && !showLiveMacroTutorial && liveMacroSnapshot?.status === 'finished' && (
        <LiveMacroReviewScreen snapshot={liveMacroSnapshot} onReplay={() => liveMacroController.startSession(liveMacroSnapshot.options)} onNewSession={liveMacroController.reset} />
      )}

      {surface === 'macro' && !showMacroTutorial && !showLiveMacroTutorial && macroSnapshot?.status === 'running' && (
        <MacroTradingTerminal snapshot={macroSnapshot} feedback={macroController.feedback} onExecuteTarget={macroController.executeTarget} onRequestDealerQuotes={macroController.requestDealerQuotes} onAcceptDealerQuote={macroController.acceptDealerQuote} onCancelDealerRfq={macroController.cancelDealerRfq} onAdvanceDay={macroController.advanceDay} onAdvanceToNextEvent={macroController.advanceToNextEvent} onFinish={macroController.finish} />
      )}

      {surface === 'macro' && !showMacroTutorial && !showLiveMacroTutorial && macroSnapshot?.status === 'finished' && (
        <MacroReviewScreen snapshot={macroSnapshot} onReplay={() => macroController.startSession(macroSnapshot.options)} onNewSession={macroController.reset} />
      )}

      {surface === 'macro' && showMacroMethodology && <MacroMethodologyModal onClose={() => setShowMacroMethodology(false)} />}

      {showProgressCentre && <ProgressCentre dealerSummaries={summaries} macroSummaries={macroSummaries} fundSummaries={fundSummaries} fundDealerRelationships={loadFundDealerRelationships()} clientRelationships={loadDealerClientRelationships()} onClose={() => setShowProgressCentre(false)} onClearAll={clearAllHistory} />}
      {showMethodology && <MethodologyModal onClose={() => setShowMethodology(false)} />}
    </>
  )
}

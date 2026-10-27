import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import { useI18n } from '../i18n'
import { canModify, getStoredAdminPassword } from '../store/adminStore'
import type { PokerSession, BalanceMode, TransferMode } from '../types'
import { formatCents, parseDollarsToCents } from '../utils/format'
import { hasActiveEarlyCashOutRecorded } from '../utils/session'
import ChipLoader from '../components/ChipLoader'

export default function SettlePage() {
  const { numericId } = useParams<{ numericId: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()
  
  const [session, setSession] = useState<PokerSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [settling, setSettling] = useState(false)
  const [error, setError] = useState('')
  
  const [cashOuts, setCashOuts] = useState<Record<string, string>>({})
  const [balanceMode, setBalanceMode] = useState<BalanceMode>('MAX_WINNER')
  const [transferMode, setTransferMode] = useState<TransferMode>('MINIMAL')
  const [dealerPlayerId, setDealerPlayerId] = useState<string | null>(null)

  useEffect(() => {
    if (!numericId) return
    
    const fetchSession = async () => {
      try {
        const data = await api.getSession(numericId)
        if (data.status === 'SETTLED') {
          navigate(`/${numericId}`)
          return
        }
        if (data.adminOnly && !canModify(numericId, true)) {
          navigate(`/${numericId}`)
          return
        }
        setSession(data)
        setDealerPlayerId(data.players[0]?.id ?? null)
        const initial: Record<string, string> = {}
        data.players.forEach(p => {
          // 提前离场的玩家预填筹码量（含带出为 0）
          initial[p.id] =
            p.cashOut > 0 || hasActiveEarlyCashOutRecorded(p, data.logs)
              ? (p.cashOut / 100).toFixed(2)
              : ''
        })
        setCashOuts(initial)
      } catch (err) {
        setError(err instanceof Error ? err.message : t.session.loadFailed)
      } finally {
        setLoading(false)
      }
    }
    
    fetchSession()
  }, [numericId, navigate])

  useEffect(() => {
    if (balanceMode === 'DEALER') setTransferMode('CENTRAL')
  }, [balanceMode])

  const { totalBuyIn, totalCashOut, diff, allFilled } = useMemo(() => {
    if (!session) return { totalBuyIn: 0, totalCashOut: 0, diff: 0, allFilled: false }
    
    const totalBuyIn = session.players.reduce((sum, p) => sum + p.buyIn, 0)
    let totalCashOut = 0
    let allFilled = true
    
    for (const player of session.players) {
      const value = cashOuts[player.id]
      if (value === '' || value === undefined) {
        allFilled = false
      } else {
        totalCashOut += parseDollarsToCents(value)
      }
    }
    
    return {
      totalBuyIn,
      totalCashOut,
      diff: totalBuyIn - totalCashOut,
      allFilled,
    }
  }, [session, cashOuts])

  const balanceDetails = useMemo((): { playerId: string; playerName: string; adjustment: number }[] => {
    if (!session || !allFilled || diff === 0) return []
    const playersWithNet = session.players.map(p => ({
      ...p,
      net: parseDollarsToCents(cashOuts[p.id] || '0') - p.buyIn,
    }))
    if (balanceMode === 'MAX_WINNER') {
      const maxWinner = playersWithNet.reduce((a, b) => (a.net >= b.net ? a : b))
      return [{ playerId: maxWinner.id, playerName: maxWinner.name, adjustment: diff }]
    }
    if (balanceMode === 'DEALER' && dealerPlayerId) {
      const dealer = session.players.find(p => p.id === dealerPlayerId)
      if (dealer) return [{ playerId: dealer.id, playerName: dealer.name, adjustment: diff }]
      return []
    }
    if (balanceMode === 'PROPORTIONAL') {
      const winners = playersWithNet.filter(p => p.net > 0)
      if (winners.length === 0) {
        const maxWinner = playersWithNet.reduce((a, b) => (a.net >= b.net ? a : b))
        return [{ playerId: maxWinner.id, playerName: maxWinner.name, adjustment: diff }]
      }
      const totalWinnings = winners.reduce((s, p) => s + p.net, 0)
      const quotaResults = winners.map(p => {
        const proportion = p.net / totalWinnings
        const quota = proportion * diff
        const integerPart = diff >= 0 ? Math.floor(quota) : Math.ceil(quota)
        return { playerId: p.id, playerName: p.name, integerPart, remainder: quota - integerPart }
      })
      let remaining = diff - quotaResults.reduce((s, r) => s + r.integerPart, 0)
      const sorted = diff >= 0
        ? [...quotaResults].sort((a, b) => b.remainder - a.remainder)
        : [...quotaResults].sort((a, b) => a.remainder - b.remainder)
      const step = diff >= 0 ? 1 : -1
      const adjustments = Object.fromEntries(quotaResults.map(r => [r.playerId, r.integerPart]))
      for (const r of sorted) {
        if (remaining === 0) break
        adjustments[r.playerId] += step
        remaining -= step
      }
      return quotaResults.map(r => ({
        playerId: r.playerId,
        playerName: r.playerName,
        adjustment: adjustments[r.playerId],
      })).filter(x => x.adjustment !== 0)
    }
    return []
  }, [session, cashOuts, allFilled, diff, balanceMode, dealerPlayerId])

  const handleCashOutChange = (playerId: string, value: string) => {
    setCashOuts(prev => ({
      ...prev,
      [playerId]: value,
    }))
  }

  const adminPassword = numericId ? getStoredAdminPassword(numericId) : null

  const handleSettle = async () => {
    if (!numericId || !session) return
    
    setSettling(true)
    setError('')
    
    try {
      const cashOutsCents: Record<string, number> = {}
      for (const player of session.players) {
        cashOutsCents[player.id] = parseDollarsToCents(cashOuts[player.id] || '0')
      }
      
      const needsDealer = transferMode === 'CENTRAL' || balanceMode === 'DEALER'
      await api.settle(
        numericId,
        cashOutsCents,
        balanceMode,
        transferMode,
        needsDealer ? dealerPlayerId : null,
        adminPassword
      )
      navigate(`/${numericId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.settle.settleFailed)
    } finally {
      setSettling(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ChipLoader size="lg" />
      </div>
    )
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-rose-600 text-xl mb-4">{error}</div>
        <Link to="/" className="btn-secondary">{t.common.home}</Link>
      </div>
    )
  }

  if (!session) return null

  const needsDealer = transferMode === 'CENTRAL' || balanceMode === 'DEALER'
  const canSettle = allFilled && (diff === 0 || diff !== 0) &&
    (!needsDealer || dealerPlayerId != null)

  return (
    <div className="min-h-screen p-4 pb-32">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link to={`/${numericId}`} className="text-gray-400 hover:text-gray-900">
            ← {t.common.back}
          </Link>
          <span className="text-gray-400">{t.settle.title}</span>
        </div>

        {/* Summary */}
        <div className="card mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-400 mb-1">{t.settle.totalBuyIn}</div>
              <div className="text-xl font-semibold text-gray-900">{formatCents(totalBuyIn)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">{t.settle.totalCashOut}</div>
              <div className="text-xl font-semibold text-gray-900">{formatCents(totalCashOut)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">{t.settle.difference}</div>
              <div className={`text-xl font-semibold ${
                diff === 0 ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                {diff >= 0 ? '+' : ''}{formatCents(diff)}
              </div>
            </div>
          </div>
          
          {allFilled && (
            <div className={`mt-4 p-3 rounded-lg ${
              diff !== 0
                ? 'bg-amber-50 border border-amber-200'
                : 'bg-white/50'
            }`}>
              {diff !== 0 && (
                <div className="text-amber-600 text-sm mb-2">
                  {t.settle.diffWarning.replace('{amount}', formatCents(Math.abs(diff)))}
                </div>
              )}
              <div className="flex flex-col gap-3">
                {diff !== 0 && (
                  <>
                    <div className="text-gray-400 text-sm">{t.settle.balanceMode}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBalanceMode('MAX_WINNER')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                          balanceMode === 'MAX_WINNER'
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {t.settle.maxWinner}
                      </button>
                      <button
                        onClick={() => setBalanceMode('PROPORTIONAL')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                          balanceMode === 'PROPORTIONAL'
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {t.settle.proportional}
                      </button>
                      <button
                        onClick={() => setBalanceMode('DEALER')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                          balanceMode === 'DEALER'
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {t.settle.dealer}
                      </button>
                    </div>
                    {balanceDetails.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-amber-200">
                        <div className="text-gray-400 text-sm mb-2">{t.settle.balanceDetails}</div>
                        <div className="space-y-1.5">
                          {balanceDetails.map(({ playerId, playerName, adjustment }) => (
                            <div key={playerId} className="flex justify-between text-sm">
                              <span className="text-gray-900">{playerName}</span>
                              <span className="text-slate-800 font-medium">
                                {t.settle.bearsDiff} {adjustment >= 0 ? '+' : ''}{formatCents(adjustment)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="text-gray-400 text-sm">{t.settle.transferMode}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTransferMode('MINIMAL')}
                    disabled={balanceMode === 'DEALER'}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                      balanceMode === 'DEALER'
                        ? 'bg-white text-gray-400 cursor-not-allowed'
                        : transferMode === 'MINIMAL'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t.settle.transferMinimal}
                  </button>
                  <button
                    onClick={() => setTransferMode('CENTRAL')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                      transferMode === 'CENTRAL'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t.settle.transferCentral}
                  </button>
                </div>
                {needsDealer && (
                  <div>
                    <div className="text-gray-400 text-sm mb-2">{t.settle.selectDealer}</div>
                    <select
                      value={dealerPlayerId ?? ''}
                      onChange={(e) => setDealerPlayerId(e.target.value || null)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-100 text-gray-900 border border-gray-200 focus:border-indigo-500 focus:outline-none"
                    >
                      {session.players.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cash Out Input */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">{t.settle.enterCashOut}</h2>
          <div className="space-y-4">
            {session.players.map((player) => (
              <div key={player.id} className="flex items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="chip">{player.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="font-medium">{player.name}</div>
                    <div className="text-sm text-gray-400">{t.player.buyIn}: {formatCents(player.buyIn)}</div>
                  </div>
                </div>
                <div className="w-32">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={cashOuts[player.id] || ''}
                      onChange={(e) => handleCashOutChange(player.id, e.target.value)}
                      placeholder="0"
                      className="input-field pl-7 text-right"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-lg p-3 mb-6 text-center">
            {error}
          </div>
        )}

        {/* Settle Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-50/95 border-t border-gray-200">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleSettle}
              disabled={!canSettle || settling}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {settling ? <ChipLoader size="sm" /> : null}
              {settling ? t.settle.settling : t.settle.complete}
            </button>
            {!allFilled && (
              <p className="text-center text-gray-400 text-sm mt-2">
                {t.settle.enterAllCashOuts}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

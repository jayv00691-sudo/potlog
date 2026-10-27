import { useState } from 'react'
import type { Debt, Player } from '../types'
import { formatCents } from '../utils/format'
import { useI18n } from '../i18n'

interface DebtCardProps {
  debt: Debt
  players: Player[]
  onSettle?: (amount: number) => Promise<void>
}

export default function DebtCard({ debt, players, onSettle }: DebtCardProps) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  
  const fromPlayer = players.find(p => p.id === debt.fromPlayerId)
  const toPlayer = players.find(p => p.id === debt.toPlayerId)
  
  const remainingAmount = debt.amount - debt.settledAmount
  const isFullySettled = debt.settled || remainingAmount <= 0

  const handleSettle = async () => {
    if (!onSettle) return
    setLoading(true)
    try {
      await onSettle(remainingAmount)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`p-4 rounded-lg border ${
      isFullySettled 
        ? 'bg-emerald-50 border-green-700/50' 
        : 'bg-gray-100/50 border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="chip text-xs">{fromPlayer?.name.charAt(0) || '?'}</div>
          <span className="text-gray-400">→</span>
          <div className="chip text-xs">{toPlayer?.name.charAt(0) || '?'}</div>
          <div className="ml-2">
            <span className="font-medium">{fromPlayer?.name}</span>
            <span className="text-gray-400 mx-2">{t.debt.payTo}</span>
            <span className="font-medium">{toPlayer?.name}</span>
          </div>
        </div>
        
        <div className="text-right">
          <div className={`text-lg font-semibold ${isFullySettled ? 'text-emerald-600 line-through' : 'text-gray-900'}`}>
            {formatCents(debt.amount)}
          </div>
          {debt.settledAmount > 0 && !isFullySettled && (
            <div className="text-sm text-gray-400">
              {t.debt.settledAmount} {formatCents(debt.settledAmount)}
            </div>
          )}
        </div>
      </div>
      
      {!isFullySettled && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">{t.debt.settleHint}</span>
          {onSettle && (
          <button
            onClick={handleSettle}
            disabled={loading}
            className="bg-green-700 text-gray-900 px-4 py-1.5 rounded-lg text-sm hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? t.common.processing : t.debt.markSettled}
          </button>
          )}
        </div>
      )}
      
      {isFullySettled && (
        <div className="mt-2 text-emerald-600 text-sm text-right">
          ✓ {t.debt.fullySettled}
        </div>
      )}
    </div>
  )
}

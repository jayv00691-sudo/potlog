import type { Player } from '../types'
import { formatCents, formatNet, formatNetClass } from '../utils/format'
import { useI18n } from '../i18n'

interface PlayerCardProps {
  player: Player
  showNet?: boolean
  onRebuy?: () => void
  onCashOut?: () => void
  onRevokeCashOut?: () => void
  /** 已记录提前离场（含带出筹码为 0） */
  hasEarlyCashOutRecorded?: boolean
  isSettled?: boolean
}

export default function PlayerCard({
  player,
  showNet,
  onRebuy,
  onCashOut,
  onRevokeCashOut,
  hasEarlyCashOutRecorded = false,
  isSettled,
}: PlayerCardProps) {
  const { t } = useI18n()
  
  return (
    <div className="bg-gray-100/50 rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="chip">{player.name.charAt(0).toUpperCase()}</div>
        <div>
          <div className="font-medium text-gray-900">{player.name}</div>
          <div className="text-sm text-gray-400">
            {t.player.buyIn}: {formatCents(player.buyIn)}
            {(player.cashOut > 0 || hasEarlyCashOutRecorded) && !isSettled && (
              <span className="ml-2 text-emerald-600">
                · {t.player.cashOut}: {formatCents(player.cashOut)}
                {onRevokeCashOut && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRevokeCashOut() }}
                    className="ml-2 text-xs text-gray-400 hover:text-amber-600"
                    title={t.player.revokeCashOut}
                  >
                    ({t.player.revokeCashOut})
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {showNet && isSettled && (
          <div className={`text-lg font-semibold ${formatNetClass(player.net)}`}>
            {formatNet(player.net)}
          </div>
        )}
        
        {!isSettled && (
          <div className="flex gap-2">
            {onRebuy && (
              <button
                onClick={onRebuy}
                className="bg-slate-100 text-slate-800 px-3 py-1 rounded-lg text-sm hover:bg-slate-100 transition-colors"
              >
                + {t.player.rebuy}
              </button>
            )}
            {onCashOut && (
              <button
                onClick={onCashOut}
                className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-sm hover:bg-green-700/50 transition-colors"
              >
                {t.player.earlyCashOut}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

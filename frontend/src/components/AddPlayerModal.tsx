import { useState } from 'react'
import { parseDollarsToCents } from '../utils/format'
import { BUY_IN_QUICK_AMOUNTS } from '../utils/buyInQuickAmounts'
import { useI18n } from '../i18n'

interface AddPlayerModalProps {
  onClose: () => void
  onAdd: (name: string, buyIn: number) => void
}

export default function AddPlayerModal({ onClose, onAdd }: AddPlayerModalProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [buyIn, setBuyIn] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !buyIn) return
    
    setLoading(true)
    await onAdd(name.trim(), parseDollarsToCents(buyIn))
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm border border-gray-200">
        <h3 className="text-xl font-semibold mb-4">{t.player.addPlayer}</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t.player.playerName}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.player.namePlaceholder}
              className="input-field"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t.player.initialBuyIn}</label>
            <input
              type="number"
              value={buyIn}
              onChange={(e) => setBuyIn(e.target.value)}
              placeholder={t.player.buyInPlaceholder}
              className="input-field"
              min="0"
              step="0.01"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {BUY_IN_QUICK_AMOUNTS.map((qa) => (
                <button
                  key={qa}
                  type="button"
                  onClick={() => setBuyIn(qa.toString())}
                  className="bg-gray-100 px-3 py-1 rounded-lg text-sm hover:bg-gray-200"
                >
                  ${qa}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !buyIn || loading}
              className="btn-primary flex-1"
            >
              {loading ? t.player.adding : t.common.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { parseDollarsToCents } from '../utils/format'
import { useI18n } from '../i18n'

interface CashOutModalProps {
  playerName: string
  onClose: () => void
  onCashOut: (amount: number) => void
}

export default function CashOutModal({ playerName, onClose, onCashOut }: CashOutModalProps) {
  const { t } = useI18n()
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const trimmed = amount.trim()
  const parsed = parseFloat(trimmed)
  const canSubmit = trimmed !== '' && !Number.isNaN(parsed) && parsed >= 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    await onCashOut(parseDollarsToCents(trimmed))
    setLoading(false)
  }

  const quickAmounts = [50, 100, 200, 500]

  return (
    <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm border border-gray-200">
        <h3 className="text-xl font-semibold mb-2">{t.cashOut.title}</h3>
        <p className="text-gray-400 mb-1">{playerName}</p>
        <p className="text-gray-400 text-sm mb-4">{t.cashOut.hint}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t.cashOut.amount}</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t.cashOut.amountPlaceholder}
              className="input-field"
              min="0"
              step="0.01"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {quickAmounts.map((qa) => (
              <button
                key={qa}
                type="button"
                onClick={() => setAmount(qa.toString())}
                className="bg-gray-100 px-3 py-1 rounded-lg text-sm hover:bg-gray-200"
              >
                ${qa}
              </button>
            ))}
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
              disabled={!canSubmit || loading}
              className="btn-primary flex-1"
            >
              {loading ? t.common.processing : t.cashOut.confirm}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

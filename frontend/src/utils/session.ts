import type { Player, TransactionLog } from '../types'

/** 该玩家最近一次 CASH_OUT 日志（按时间） */
export function lastCashOutLogForPlayer(
  logs: TransactionLog[] | undefined,
  playerId: string
): TransactionLog | undefined {
  if (!logs?.length) return undefined
  return [...logs]
    .filter((l) => l.playerId === playerId && l.type === 'CASH_OUT')
    .sort((a, b) => b.timestamp - a.timestamp)[0]
}

/**
 * 当前是否处于「已记录提前离场」状态：玩家 cashOut 与最近一次 CASH_OUT 日志金额一致（含带出为 0）
 */
export function hasActiveEarlyCashOutRecorded(
  player: Player,
  logs: TransactionLog[] | undefined
): boolean {
  const last = lastCashOutLogForPlayer(logs, player.id)
  return last != null && player.cashOut === last.amount
}

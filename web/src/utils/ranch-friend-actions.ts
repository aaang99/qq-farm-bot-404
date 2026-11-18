export type RanchFriendAction = 'steal' | 'help' | 'stroke' | 'putHazard'

export function ranchFriendActions(detail: any, action: RanchFriendAction): Record<string, unknown>[] {
  if (!detail?.hostGid)
    return []
  const remaining = (id: string) => Number(detail.ops?.find((op: any) => String(op.opId) === id)?.remainingTimes || 0)
  if ((action === 'stroke' && remaining('11009') <= 0) || (action === 'putHazard' && remaining('11003') <= 0))
    return []
  return (detail.ranches || []).flatMap((ranch: any) => {
    const base = { action, hostGid: String(detail.hostGid), ranchId: ranch.ranchInstId }
    if (action === 'steal')
      return (ranch.shelves || []).filter((s: any) => s.canSteal).map((s: any) => ({ ...base, slotIndex: s.slotIndex }))
    if (action === 'help')
      return ranch.hazards?.length ? [base] : []
    if (action === 'stroke')
      return (ranch.animals || []).filter((a: any) => a.canStroke).map((a: any) => ({ ...base, animalInstId: a.animalInstId }))
    return [base]
  })
}

export async function runRanchFriendActions(action: RanchFriendAction, context: {
  active: () => boolean
  detail: () => any
  mutate: (payload: Record<string, unknown>) => Promise<boolean>
}) {
  const attempted = new Set<string>()
  let count = 0
  while (context.active()) {
    const next = ranchFriendActions(context.detail(), action).find(payload => !attempted.has(JSON.stringify(payload)))
    if (!next)
      break
    attempted.add(JSON.stringify(next))
    if (!await context.mutate(next))
      break
    count++
  }
  return count
}

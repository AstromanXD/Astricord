const channelSubs = new Map()

export function subscribe(channelId, ws) {
  if (!channelSubs.has(channelId)) channelSubs.set(channelId, new Set())
  channelSubs.get(channelId).add(ws)
}

export function unsubscribe(channelId, ws) {
  const set = channelSubs.get(channelId)
  if (set) {
    set.delete(ws)
    if (!set.size) channelSubs.delete(channelId)
  }
}

export function broadcast(channelId, event, payload) {
  const set = channelSubs.get(channelId)
  if (!set) return
  const msg = JSON.stringify({ event, payload })
  set.forEach((ws) => {
    if (ws.readyState === 1) ws.send(msg)
  })
}

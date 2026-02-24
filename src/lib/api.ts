/**
 * API Client für Astricord Backend (Node.js + MySQL)
 * Ersetzt Supabase bei Verwendung des eigenen Backends
 */
import { useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const FETCH_TIMEOUT_MS = 8000

function getToken(): string | null {
  return localStorage.getItem('astricord_token')
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

function isNetworkError(e: unknown): boolean {
  if (e instanceof Error) {
    if (e.name === 'AbortError') return true
    const msg = (e.message || '').toLowerCase()
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout') || msg.includes('failed')) return true
  }
  return false
}

const CONNECTION_ERROR_MSG = 'Server nicht erreichbar. Prüfe die Verbindung und ob die Firewall den API-Port freigibt.'

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } catch (e) {
    if (isNetworkError(e)) throw new Error(CONNECTION_ERROR_MSG)
    throw e
  } finally {
    clearTimeout(timeout)
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const res = await fetchWithTimeout(`${API_URL}${path}`, {
      ...options,
      headers: { ...getHeaders(), ...(options.headers as Record<string, string>) },
    })
    if (res.status === 204) return undefined as T
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    return data as T
  } catch (e) {
    if (isNetworkError(e)) throw new Error(CONNECTION_ERROR_MSG)
    throw e
  }
}

export const auth = {
  async register(email: string, password: string, username?: string) {
    try {
      const data = await api<{ token: string; user: { id: string; email: string }; profile: unknown }>(
        '/api/auth/register',
        { method: 'POST', body: JSON.stringify({ email, password, username }) }
      )
      if (data?.token) localStorage.setItem('astricord_token', data.token)
      return { data, error: null }
    } catch (e) {
      return { data: null, error: e as Error }
    }
  },
  async login(email: string, password: string) {
    try {
      const data = await api<{ token: string; user: { id: string; email: string }; profile: unknown }>(
        '/api/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) }
      )
      if (data?.token) localStorage.setItem('astricord_token', data.token)
      return { data, error: null }
    } catch (e) {
      return { data: null, error: e as Error }
    }
  },
  async getSession() {
    const token = getToken()
    if (!token) return { data: { session: null } }
    try {
      const profile = await api<{ id: string }>('/api/auth/me')
      return {
        data: {
          session: { user: { id: profile.id } },
          user: { id: profile.id },
        },
      }
    } catch {
      localStorage.removeItem('astricord_token')
      return { data: { session: null } }
    }
  },
  signOut() {
    localStorage.removeItem('astricord_token')
    return Promise.resolve()
  },
}

export const useBackend = (): boolean => !!import.meta.env.VITE_API_URL

export function createWebSocket(channel: string): WebSocket {
  const token = getToken()
  const url = `${API_URL.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token || '')}`
  const ws = new WebSocket(url)
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', channel }))
  }
  return ws
}

/** WebSocket-Broadcast senden (für Voice-Signaling etc.) */
export function sendBroadcast(ws: WebSocket | null, channel: string, event: string, payload: unknown) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'broadcast', channel, event, payload }))
  }
}

/** WebSocket-Realtime für Backend: Nachrichten-Events empfangen */
export function useBackendRealtime(
  channelName: string | null,
  onEvent: (event: 'INSERT' | 'UPDATE' | 'DELETE', payload: unknown) => void
) {
  const onEventRef = { current: onEvent }
  onEventRef.current = onEvent

  useEffect(() => {
    if (!channelName || !import.meta.env.VITE_API_URL) return
    const ws = createWebSocket(channelName)
    const handler = (e: MessageEvent) => {
      try {
        const { event, payload } = JSON.parse(e.data as string)
        if (event && payload !== undefined) onEventRef.current(event, payload)
      } catch (_) {}
    }
    ws.addEventListener('message', handler)
    return () => {
      ws.removeEventListener('message', handler)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', channel: channelName }))
      }
      ws.close()
    }
  }, [channelName])
}

// Messages API
export interface ApiMessage {
  id: string
  channel_id: string | null
  dm_conversation_id?: string | null
  user_id: string
  content: string
  attachments?: { url: string; type: string; filename?: string; fileSize?: number }[]
  is_pinned?: boolean
  edited_at?: string | null
  parent_message_id?: string | null
  created_at: string
}

export const messages = {
  async getByChannel(channelId: string, limit = 50, before?: string, parentMessageId?: string) {
    let path = `/api/messages?channelId=${channelId}&limit=${limit}`
    if (before) path += `&before=${encodeURIComponent(before)}`
    if (parentMessageId) path += `&parentMessageId=${encodeURIComponent(parentMessageId)}`
    return api<ApiMessage[]>(path)
  },
  search: (channelId: string, q: string, limit = 20) =>
    api<ApiMessage[]>(`/api/messages/search?channelId=${channelId}&q=${encodeURIComponent(q)}&limit=${limit}`),
  async getByDm(conversationId: string, limit = 50, before?: string) {
    let path = `/api/messages?dmConversationId=${conversationId}&limit=${limit}`
    if (before) path += `&before=${encodeURIComponent(before)}`
    return api<ApiMessage[]>(path)
  },
  async create(data: {
    channel_id?: string
    dm_conversation_id?: string
    content: string
    attachments?: unknown[]
    parent_message_id?: string
  }) {
    return api<ApiMessage>('/api/messages', { method: 'POST', body: JSON.stringify(data) })
  },
  async update(id: string, data: { content?: string; is_pinned?: boolean }) {
    return api<ApiMessage>(`/api/messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  },
  async delete(id: string) {
    return api(`/api/messages/${id}`, { method: 'DELETE' })
  },
}

// Profiles API (Batch)
export interface ApiProfile {
  id: string
  username: string
  avatar_url: string | null
  theme?: string
  created_at?: string
}

export async function searchProfiles(q: string): Promise<ApiProfile[]> {
  if (!q?.trim() || q.trim().length < 2) return []
  return api<ApiProfile[]>(`/api/profiles/search?q=${encodeURIComponent(q.trim())}`)
}

export async function blockUser(blockedUserId: string) {
  return api('/api/profiles/block', { method: 'POST', body: JSON.stringify({ blocked_user_id: blockedUserId }) })
}

export async function updateProfile(data: Partial<{ username: string; avatar_url: string; theme: string; status: string; status_message: string; custom_status: string }>) {
  return api<ApiProfile>('/api/profiles/me', { method: 'PATCH', body: JSON.stringify(data) })
}

export async function getProfilesByIds(ids: string[]): Promise<ApiProfile[]> {
  if (!ids.length) return []
  const map = await api<Record<string, ApiProfile>>('/api/profiles/batch', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
  return ids.map((id) => map[id]).filter(Boolean)
}

// Servers
export const servers = {
  list: () => api<ApiServer[]>('/api/servers'),
  get: (id: string) => api<ApiServer>(`/api/servers/${id}`),
  create: (data: { name?: string; icon_url?: string; description?: string; banner_color?: string }) =>
    api<ApiServer>('/api/servers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ApiServer>) =>
    api<ApiServer>(`/api/servers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/api/servers/${id}`, { method: 'DELETE' }),
  join: (code: string) => api<ApiServer>('/api/servers/join', { method: 'POST', body: JSON.stringify({ code }) }),
  getPermissions: (id: string) => api<{ isAdmin: boolean; isOwner: boolean; permissions: number }>(`/api/servers/${id}/permissions`),
  getMembers: (id: string) => api<string[]>(`/api/servers/${id}/members`),
  getMembersDetail: (id: string) =>
    api<{ members: { userId: string; profile: ApiProfile; roles: { id: string; name: string; color: string; position: number }[] }[]; roles: { id: string; name: string; color: string; position: number }[] }>(
      `/api/servers/${id}/members-detail`
    ),
  kickMember: (serverId: string, userId: string) =>
    api(`/api/servers/${serverId}/members/${userId}`, { method: 'DELETE' }),
  banMember: (serverId: string, userId: string) =>
    api(`/api/servers/${serverId}/members/${userId}/ban`, { method: 'POST' }),
  toggleMemberRole: (serverId: string, userId: string, roleId: string, add: boolean) =>
    api(`/api/servers/${serverId}/members/${userId}/roles`, {
      method: 'PATCH',
      body: JSON.stringify({ role_id: roleId, add }),
    }),
  getRoleColors: (id: string, userIds: string[]) =>
    userIds.length ? api<Record<string, string>>(`/api/servers/${id}/role-colors?userIds=${userIds.join(',')}`).catch(() => ({})) : Promise.resolve({}),
  getRoles: (id: string) =>
    api<{ id: string; server_id: string; name: string; color: string; position: number; permissions?: number }[]>(
      `/api/servers/${id}/roles`
    ),
  createRole: (serverId: string, data: { name: string; color?: string; position?: number }) =>
    api<{ id: string; server_id: string; name: string; color: string; position: number }>(
      `/api/servers/${serverId}/roles`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  updateRole: (serverId: string, roleId: string, data: { name?: string; color?: string; position?: number; permissions?: number }) =>
    api<{ id: string; server_id: string; name: string; color: string; position: number }>(
      `/api/servers/${serverId}/roles/${roleId}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    ),
  deleteRole: (serverId: string, roleId: string) =>
    api(`/api/servers/${serverId}/roles/${roleId}`, { method: 'DELETE' }),
  getAuditLog: (id: string) =>
    api<{ id: string; server_id: string; user_id: string; action: string; target_type: string | null; target_id: string | null; details: Record<string, unknown>; created_at: string }[]>(
      `/api/servers/${id}/audit-log`
    ),
  getBans: (id: string) =>
    api<{ user_id: string; banned_by: string | null; created_at: string; username: string; avatar_url: string | null }[]>(
      `/api/servers/${id}/bans`
    ),
  unbanMember: (serverId: string, userId: string) =>
    api(`/api/servers/${serverId}/bans/${userId}`, { method: 'DELETE' }),
  setMemberTimeout: (serverId: string, userId: string, timeoutUntil: string | null) =>
    api(`/api/servers/${serverId}/members/${userId}/timeout`, {
      method: 'PATCH',
      body: JSON.stringify({ timeout_until: timeoutUntil }),
    }),
  setMemberNickname: (serverId: string, userId: string, nickname: string) =>
    api(`/api/servers/${serverId}/members/${userId}/nickname`, {
      method: 'PATCH',
      body: JSON.stringify({ nickname: nickname.trim() }),
    }),
  transferOwnership: (serverId: string, newOwnerId: string) =>
    api(`/api/servers/${serverId}/transfer-ownership`, {
      method: 'POST',
      body: JSON.stringify({ new_owner_id: newOwnerId }),
    }),
}

export interface ApiServer {
  id: string
  name: string
  icon_url: string | null
  description?: string | null
  banner_color?: string | null
  created_at?: string
}

// Channels
export const channels = {
  list: (serverId: string) => api<ApiChannel[]>(`/api/channels?serverId=${serverId}`),
  listCategories: (serverId: string) =>
    api<ApiChannelCategory[]>(`/api/channels/categories?serverId=${serverId}`),
  createCategory: (data: { server_id: string; name: string; position?: number }) =>
    api<ApiChannelCategory>('/api/channels/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: { name?: string; position?: number }) =>
    api<ApiChannelCategory>(`/api/channels/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCategory: (id: string) =>
    api(`/api/channels/categories/${id}`, { method: 'DELETE' }),
  create: (data: { server_id: string; name: string; type?: string; category_id?: string; position?: number }) =>
    api<ApiChannel>('/api/channels', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ApiChannel>) =>
    api<ApiChannel>(`/api/channels/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/api/channels/${id}`, { method: 'DELETE' }),
  getOverwrites: (channelId: string) =>
    api<{ id: string; channel_id: string; role_id: string | null; user_id: string | null; allow: number; deny: number; created_at: string }[]>(
      `/api/channels/${channelId}/overwrites`
    ),
  addOverwrite: (channelId: string, data: { role_id?: string; user_id?: string }) =>
    api<{ id: string; channel_id: string; role_id: string | null; user_id: string | null; allow: number; deny: number; created_at: string }>(
      `/api/channels/${channelId}/overwrites`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  updateOverwrite: (channelId: string, overwriteId: string, data: { allow?: number; deny?: number }) =>
    api<{ id: string; channel_id: string; role_id: string | null; user_id: string | null; allow: number; deny: number; created_at: string }>(
      `/api/channels/${channelId}/overwrites/${overwriteId}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    ),
  deleteOverwrite: (channelId: string, overwriteId: string) =>
    api(`/api/channels/${channelId}/overwrites/${overwriteId}`, { method: 'DELETE' }),
}

export interface ApiChannel {
  id: string
  server_id: string
  category_id?: string | null
  name: string
  type: 'text' | 'voice' | 'forum'
  position: number
  slow_mode_seconds?: number
  created_at?: string
}

export interface ApiChannelCategory {
  id: string
  server_id: string
  name: string
  position: number
  created_at?: string
}

// Friends
export const friends = {
  list: () => api<ApiFriend[]>('/api/friends'),
  request: (to_user_id: string) =>
    api<{ id: string }>('/api/friends/request', { method: 'POST', body: JSON.stringify({ to_user_id }) }),
  accept: (id: string) =>
    api(`/api/friends/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) }),
}

export interface ApiFriend {
  id: string
  userId: string
  username: string
  avatarUrl: string | null
  status: string
  isIncoming?: boolean
  created_at?: string
}

// DM
export const dm = {
  createConversation: (other_user_id: string) =>
    api<{ id: string; created?: boolean }>('/api/dm/conversation', {
      method: 'POST',
      body: JSON.stringify({ other_user_id }),
    }),
  getConversations: () =>
    api<{ conversationId: string; otherUser: ApiProfile }[]>('/api/dm/conversations'),
}

// Invites
export const invites = {
  list: (server_id: string) =>
    api<{ id: string; server_id: string; code: string; created_by: string | null; created_at: string }[]>(
      `/api/invites?server_id=${server_id}`
    ),
  create: (server_id: string, options?: { expires_at?: string; max_uses?: number }) =>
    api<{ id: string; server_id: string; code: string; created_by: string; created_at: string; expires_at?: string; max_uses?: number; uses?: number }>('/api/invites', {
      method: 'POST',
      body: JSON.stringify({ server_id, ...options }),
    }),
  delete: (id: string) => api(`/api/invites/${id}`, { method: 'DELETE' }),
  getByCode: (code: string) => api<{ server_id: string; name: string }>(`/api/invites/code/${code}`),
}

// Voice
export const voice = {
  getSessions: (channelIds: string[]) =>
    api<Record<string, { userId: string; username: string; avatarUrl: string | null; isMuted: boolean; hasVideo: boolean; isScreenSharing: boolean }[]>>(
      `/api/voice/sessions?channelIds=${channelIds.join(',')}`
    ),
  join: (channel_id: string) =>
    api<{ channel_id: string }>('/api/voice/join', { method: 'POST', body: JSON.stringify({ channel_id }) }),
  leave: (channel_id: string) =>
    api('/api/voice/leave', { method: 'POST', body: JSON.stringify({ channel_id }) }),
  mute: (channel_id: string, is_muted: boolean) =>
    api('/api/voice/mute', { method: 'PATCH', body: JSON.stringify({ channel_id, is_muted }) }),
  video: (channel_id: string, has_video: boolean) =>
    api('/api/voice/video', { method: 'PATCH', body: JSON.stringify({ channel_id, has_video }) }),
  screen: (channel_id: string, is_screen_sharing: boolean) =>
    api('/api/voice/screen', { method: 'PATCH', body: JSON.stringify({ channel_id, is_screen_sharing }) }),
}

// Reactions
export const reactions = {
  getByMessages: (messageIds: string[]) =>
    api<Record<string, { id: string; message_id: string; user_id: string; emoji: string }[]>>(
      messageIds.length ? `/api/reactions?messageIds=${messageIds.join(',')}` : '/api/reactions'
    ).then((r) => r || {}),
  toggle: (message_id: string, emoji: string) =>
    api<{ action: string }>('/api/reactions', { method: 'POST', body: JSON.stringify({ message_id, emoji }) }),
}

// Emojis
export const emojis = {
  list: (serverId: string) => api<ApiEmoji[]>(`/api/emojis?serverId=${serverId}`),
  create: (server_id: string, name: string, image_url: string) =>
    api<ApiEmoji>('/api/emojis', {
      method: 'POST',
      body: JSON.stringify({ server_id, name, image_url }),
    }),
  delete: (id: string) => api(`/api/emojis/${id}`, { method: 'DELETE' }),
}

export interface ApiEmoji {
  id: string
  server_id: string
  name: string
  image_url: string
  created_at?: string
}

// Upload
export async function uploadFile(file: File): Promise<string | null> {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/upload/message-attachment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.url ?? null
  } catch {
    return null
  }
}

export async function uploadServerEmoji(file: File): Promise<string | null> {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/upload/server-emoji`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.url ?? null
  } catch {
    return null
  }
}

export async function uploadServerIcon(file: File): Promise<string | null> {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/upload/server-icon`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.url ?? null
  } catch {
    return null
  }
}

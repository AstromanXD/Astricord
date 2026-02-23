/**
 * Supabase Client - zentrale Konfiguration
 * Kein echtes Discord, nur Demo/Lernzwecke
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase nicht konfiguriert. Bitte VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in .env setzen.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Typen für die Datenbank
export type Theme = 'light' | 'dark' | 'midnight' | 'neon'

export interface Profile {
  id: string
  username: string
  avatar_url: string | null
  theme: Theme
  created_at: string
  status?: string | null
  status_message?: string | null
  custom_status?: string | null
}

export interface Server {
  id: string
  name: string
  icon_url: string | null
  description?: string | null
  banner_color?: string | null
  created_at?: string
}

export interface ServerEmoji {
  id: string
  server_id: string
  name: string
  image_url: string
  created_at?: string
}

export type ChannelType = 'text' | 'voice' | 'forum'
export interface Channel {
  id: string
  server_id: string
  name: string
  type: ChannelType
  created_at?: string
}

export interface Message {
  id: string
  channel_id: string | null
  dm_conversation_id?: string | null
  user_id: string
  content: string
  attachments?: { url: string; type: 'image' | 'audio' | 'video'; filename?: string; fileSize?: number }[]
  is_pinned?: boolean
  edited_at?: string | null
  created_at: string
  parent_message_id?: string | null
}

export interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface AuditLogEntry {
  id: string
  server_id: string
  user_id: string
  action: string
  target_type?: string | null
  target_id?: string | null
  details?: Record<string, unknown>
  created_at: string
}

export interface ServerInvite {
  id: string
  server_id: string
  code: string
  created_by: string | null
  created_at: string
}

export interface FriendRequest {
  id: string
  from_user_id: string
  to_user_id: string
  status: 'pending' | 'accepted' | 'blocked'
  created_at: string
}

export interface DmConversation {
  id: string
  created_at: string
}

export interface DmParticipant {
  conversation_id: string
  user_id: string
}

export interface VoiceSession {
  id: string
  channel_id: string
  user_id: string
  joined_at: string
  is_muted: boolean
}

export interface ServerRole {
  id: string
  server_id: string
  name: string
  color: string
  position: number
  permissions?: number
  created_at?: string
}

export interface ServerMember {
  server_id: string
  user_id: string
  joined_at: string
}

export interface ServerMemberRole {
  server_id: string
  user_id: string
  role_id: string
}

export interface ChannelCategory {
  id: string
  server_id: string
  name: string
  position: number
  created_at?: string
}

export interface ChannelPermissionOverwrite {
  id: string
  channel_id: string
  role_id: string | null
  user_id: string | null
  allow: number
  deny: number
  created_at?: string
}

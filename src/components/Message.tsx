/**
 * Message - Einzelne Chat-Nachricht (Text, Emojis, Bilder, Reaktionen)
 */
import { useState, memo } from 'react'
import type { Message as MessageType } from '../lib/supabase'
import type { Profile, ServerEmoji } from '../lib/supabase'
import type { ReactionGroup } from '../hooks/useMessageReactions'
import { AudioPlayer } from './AudioPlayer'
import { LinkEmbed, extractEmbedUrls } from './LinkEmbed'

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

interface MessageProps {
  message: MessageType
  profile: Profile | null
  isOwn: boolean
  serverEmojis?: ServerEmoji[]
  roleColor?: string
  onPin?: () => void
  onUnpin?: () => void
  reactions?: ReactionGroup[]
  onToggleReaction?: (emoji: string) => void
  onEdit?: (newContent: string) => void
  onReply?: () => void
  onDelete?: () => void
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g

function linkify(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match
  const re = new RegExp(URL_REGEX.source, 'g')
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(
      <a
        key={`${keyPrefix}-${match.index}`}
        href={match[1]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--text-link)] hover:underline"
      >
        {match[1]}
      </a>
    )
    lastIndex = re.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts.length > 0 ? parts : [text]
}

function renderContent(content: string, serverEmojis: ServerEmoji[] = []) {
  const emojiMap = Object.fromEntries(serverEmojis.map((e) => [e.name.toLowerCase(), e]))
  const parts: React.ReactNode[] = []
  const regex = /:([a-zA-Z0-9_]+):/g
  let lastIndex = 0
  let match
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...linkify(content.slice(lastIndex, match.index), `t-${match.index}`))
    }
    const emoji = emojiMap[match[1].toLowerCase()]
    if (emoji) {
      parts.push(
        <img
          key={match.index}
          src={emoji.image_url}
          alt={`:${emoji.name}:`}
          className="inline-block w-5 h-5 align-middle mx-0.5"
          title={`:${emoji.name}:`}
        />
      )
    } else {
      parts.push(match[0])
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < content.length) {
    parts.push(...linkify(content.slice(lastIndex), `e-${lastIndex}`))
  }
  return parts.length > 0 ? parts : content
}

export const Message = memo(function Message({ message, profile, isOwn, serverEmojis = [], roleColor, onPin, onUnpin, reactions = [], onToggleReaction, onEdit, onReply, onDelete }: MessageProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const content = message.content?.trim() === ' ' ? '' : message.content
  const attachments = message.attachments ?? []
  const isPinned = message.is_pinned ?? false
  const isEdited = !!message.edited_at

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim() !== message.content) {
      onEdit(editContent.trim())
    }
    setIsEditing(false)
  }

  return (
    <div
      className={`group flex gap-4 px-4 py-1 hover:bg-[var(--bg-hover)]/50 relative ${
        isOwn ? 'bg-[var(--bg-hover)]/30' : ''
      }`}
    >
      {isPinned && (
        <span className="absolute left-1 top-1 text-[var(--accent)]" title="Angeheftet">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/></svg>
        </span>
      )}
      {isOwn && (onPin || onUnpin) && (
        <div className="absolute right-2 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={isPinned ? onUnpin : onPin}
            className="p-1 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title={isPinned ? 'Lösen' : 'Anheften'}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/></svg>
          </button>
        </div>
      )}
      <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-[var(--bg-tertiary)]">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg font-bold text-[var(--text-muted)]">
            {(profile?.username ?? '?').charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className={`font-medium ${!roleColor ? 'text-[var(--text-muted)]' : ''}`}
            style={roleColor ? { color: roleColor } : undefined}
          >
            {profile?.username ?? 'Unbekannt'}
          </span>
          <span className="text-xs text-[var(--text-muted)]">{formatTime(message.created_at)}</span>
          {isEdited && <span className="text-xs text-[var(--text-muted)]">(bearbeitet)</span>}
        </div>
        {(content || attachments.length > 0 || isEditing) && (
          <div className="space-y-1">
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-3 py-1 rounded bg-[var(--accent)] text-white text-sm"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsEditing(false); setEditContent(message.content) }}
                    className="px-3 py-1 rounded bg-[var(--bg-modifier-hover)] text-[var(--text-primary)] text-sm"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : content ? (
              <>
                <p className="text-[var(--text-primary)] break-words whitespace-pre-wrap">
                  {renderContent(content, serverEmojis)}
                </p>
                {extractEmbedUrls(content).map((url) => (
                  <LinkEmbed key={url} url={url} />
                ))}
                {isOwn && onEdit && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100"
                  >
                    Bearbeiten
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="text-xs text-[var(--accent-danger)] hover:underline opacity-0 group-hover:opacity-100 ml-1"
                  >
                    Löschen
                  </button>
                )}
              </>
            ) : null}
            {attachments.length > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                {attachments.map((att, i) => {
                  if (att.type === 'image') {
                    return (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block max-w-sm"
                      >
                        <img
                          src={att.url}
                          alt=""
                          className="max-h-64 rounded-lg object-cover"
                        />
                      </a>
                    )
                  }
                  if (att.type === 'audio') {
                    return (
                      <AudioPlayer
                        key={i}
                        src={att.url}
                        filename={att.filename}
                        fileSize={att.fileSize}
                      />
                    )
                  }
                  if (att.type === 'video') {
                    return (
                      <div key={i} className="max-w-lg">
                        <video
                          controls
                          src={att.url}
                          className="w-full max-h-80 rounded-lg bg-black"
                          preload="metadata"
                          playsInline
                        >
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)]">
                            Video ansehen
                          </a>
                        </video>
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            )}
          </div>
        )}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {reactions.map((g) => (
              <button
                key={g.emoji}
                type="button"
                onClick={() => onToggleReaction?.(g.emoji)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-modifier-hover)] text-sm"
              >
                <span>{g.emoji}</span>
                {g.count > 1 && <span className="text-[var(--text-muted)]">{g.count}</span>}
              </button>
            ))}
          </div>
        )}
        {(onReply || onToggleReaction) && (
          <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity items-center">
            {onReply && (
              <button
                type="button"
                onClick={onReply}
                className="px-2 py-0.5 rounded text-xs text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-primary)]"
              >
                Antworten
              </button>
            )}
            {onToggleReaction && QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onToggleReaction(emoji)}
                className="p-1 rounded hover:bg-[var(--bg-modifier-hover)] text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

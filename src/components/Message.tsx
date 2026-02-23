/**
 * Message - Einzelne Chat-Nachricht (Text, Emojis, Bilder, Reaktionen)
 */
import { useState, memo, useRef, useEffect } from 'react'
import type { Message as MessageType } from '../lib/supabase'
import type { Profile, ServerEmoji } from '../lib/supabase'
import type { ReactionGroup } from '../hooks/useMessageReactions'
import { useUserSettings } from '../contexts/UserSettingsContext'
import { formatTime } from '../lib/formatDate'
import { AudioPlayer } from './AudioPlayer'
import { LinkEmbed, extractEmbedUrls } from './LinkEmbed'
import { EmojiPicker } from './EmojiPicker'

const QUICK_REACTIONS = ['✅', '😂', '👍', '❤️', '😮', '🔥']

interface ParentMessageInfo {
  id: string
  content: string
  username: string
  avatarUrl: string | null
}

interface MessageProps {
  message: MessageType
  profile: Profile | null
  isOwn: boolean
  serverEmojis?: ServerEmoji[]
  roleColor?: string
  parentMessage?: ParentMessageInfo | null
  onScrollToMessage?: (messageId: string) => void
  isHighlighted?: boolean
  onPin?: () => void
  onUnpin?: () => void
  reactions?: ReactionGroup[]
  onToggleReaction?: (emoji: string) => void
  onEdit?: (newContent: string) => void
  onReply?: () => void
  onOpenThread?: () => void
  onDelete?: () => void
  /** Reaktions-EmojiPicker */
  showReactionPicker?: boolean
  reactionPickerButtonRef?: React.RefObject<HTMLButtonElement | null>
  onOpenReactionPicker?: () => void
  onReactionSelect?: (emoji: string) => void
  onReactionPickerClose?: () => void
  serverEmojisForPicker?: ServerEmoji[]
  serverNameForPicker?: string
  onOpenEmojiSettings?: () => void
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

export const Message = memo(function Message({ message, profile, isOwn, serverEmojis = [], roleColor, parentMessage, onScrollToMessage, isHighlighted, onPin, onUnpin, reactions = [], onToggleReaction, onEdit, onReply, onOpenThread, onDelete, showReactionPicker, reactionPickerButtonRef, onOpenReactionPicker, onReactionSelect, onReactionPickerClose, serverEmojisForPicker = [], serverNameForPicker, onOpenEmojiSettings }: MessageProps) {
  const { settings } = useUserSettings()
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  const content = message.content?.trim() === ' ' ? '' : message.content
  const attachments = message.attachments ?? []
  const isPinned = message.is_pinned ?? false
  const isEdited = !!message.edited_at

  useEffect(() => {
    if (!showMoreMenu) return
    const close = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showMoreMenu])

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim() !== message.content) {
      onEdit(editContent.trim())
    }
    setIsEditing(false)
  }

  const hasActions = onReply || onOpenThread || onToggleReaction || onDelete || onEdit || onPin || onUnpin

  const parentContent = parentMessage?.content?.trim() ?? ''
  const parentContentPreview = parentContent
    ? parentContent.slice(0, 80) + (parentContent.length > 80 ? '…' : '')
    : ''

  return (
    <div
      data-message-row
      className={`group flex gap-4 px-4 py-1 hover:bg-[var(--bg-hover)]/50 relative transition-colors duration-300 ${
        isOwn ? 'bg-[var(--bg-hover)]/30' : ''
      } ${isHighlighted ? 'bg-[var(--accent)]/20' : ''}`}
    >
      {isPinned && (
        <span className="absolute left-1 top-1 text-[var(--accent)]" title="Angeheftet">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/></svg>
        </span>
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
      <div className="flex-1 min-w-0 relative">
        {parentMessage && onScrollToMessage && (
          <button
            type="button"
            onClick={() => onScrollToMessage(parentMessage.id)}
            className="flex items-center gap-2 mb-1 pl-3 border-l-2 border-[var(--text-muted)]/40 text-left hover:border-[var(--text-link)]/60 hover:opacity-90 transition-all group/reply"
          >
            <div className="w-5 h-5 rounded-full overflow-hidden bg-[var(--bg-tertiary)] flex-shrink-0">
              {parentMessage.avatarUrl ? (
                <img src={parentMessage.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)]">
                  {(parentMessage.username ?? '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className="text-sm text-[var(--text-link)] group-hover/reply:underline truncate min-w-0">
              <span className="font-medium">{parentMessage.username}</span>
              {parentContentPreview && (
                <span className="text-[var(--text-muted)] font-normal"> {parentContentPreview}</span>
              )}
            </span>
          </button>
        )}
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
        {hasActions && (
          <div className="flex gap-0.5 py-1.5 px-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity w-fit mb-0.5">
            {onToggleReaction && QUICK_REACTIONS.slice(0, 3).map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onToggleReaction(emoji)}
                className="p-1.5 rounded hover:bg-[var(--bg-modifier-hover)] text-base leading-none"
                title={`Reagieren mit ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 rounded hover:bg-red-500/20 text-red-400"
                title="Löschen"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            )}
            {onToggleReaction && onOpenReactionPicker && (
              <div className="relative">
                <button
                  ref={showReactionPicker ? reactionPickerButtonRef : undefined}
                  type="button"
                  onClick={onOpenReactionPicker}
                  className="p-1.5 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  title="Emoji auswählen"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </button>
                {showReactionPicker && onReactionSelect && onReactionPickerClose && (
                  <EmojiPicker
                    serverEmojis={serverEmojisForPicker}
                    serverName={serverNameForPicker}
                    initialTab="emojis"
                    onSelect={(emoji) => onReactionSelect(emoji)}
                    onSelectCustom={(name) => onReactionSelect(`:${name}:`)}
                    onClose={onReactionPickerClose}
                    onAddEmoji={onOpenEmojiSettings}
                    anchorRef={reactionPickerButtonRef!}
                  />
                )}
              </div>
            )}
            {onReply && (
              <button
                type="button"
                onClick={onReply}
                className="p-1.5 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                title="Antworten"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
              </button>
            )}
            {(onEdit || onDelete || onPin || onUnpin || onOpenThread) && (
              <div className="relative" ref={moreMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowMoreMenu((p) => !p)}
                  className="p-1.5 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  title="Mehr Optionen"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 top-full mt-1 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] shadow-xl z-50 min-w-[140px]">
                    {onOpenThread && (
                      <button type="button" onClick={() => { onOpenThread(); setShowMoreMenu(false) }} className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)]">Thread öffnen</button>
                    )}
                    {isOwn && onEdit && (
                      <button type="button" onClick={() => { setIsEditing(true); setShowMoreMenu(false) }} className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)]">Bearbeiten</button>
                    )}
                    {(onPin || onUnpin) && (
                      <button type="button" onClick={() => { (isPinned ? onUnpin : onPin)?.(); setShowMoreMenu(false) }} className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)]">{isPinned ? 'Lösen' : 'Anheften'}</button>
                    )}
                    {onDelete && (
                      <button type="button" onClick={() => { onDelete(); setShowMoreMenu(false) }} className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20">Löschen</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
                <p data-message-content className="text-[var(--text-primary)] break-words whitespace-pre-wrap">
                  {renderContent(content, serverEmojis)}
                </p>
                {settings.showLinkPreview && extractEmbedUrls(content).map((url) => (
                  <LinkEmbed key={url} url={url} />
                ))}
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
      </div>
    </div>
  )
})

/**
 * LinkEmbed - Vorschau für TikTok, YouTube, Instagram Links
 * YouTube und TikTok: Video direkt in der Vorschau abspielbar
 */
import { useEffect, useState } from 'react'

const YOUTUBE_REGEX = /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
const TIKTOK_VIDEO_REGEX = /tiktok\.com\/@[^/]+\/video\/(\d+)/

/** TikTok-Embed: player/v1/ID für Standard-URLs, embed?url= für Kurzlinks */
function getTiktokEmbedUrl(url: string): string {
  const m = url.match(TIKTOK_VIDEO_REGEX)
  if (m) {
    return `https://www.tiktok.com/player/v1/${m[1]}`
  }
  return `https://www.tiktok.com/embed/?lang=de&url=${encodeURIComponent(url)}`
}

interface EmbedData {
  url: string
  title?: string
  author_name?: string
  thumbnail_url?: string
  provider_name?: string
}

interface LinkEmbedProps {
  url: string
}

function getPlatform(url: string): 'youtube' | 'tiktok' | 'instagram' | null {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('tiktok.com') || url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com')) return 'tiktok'
  if (url.includes('instagram.com')) return 'instagram'
  return null
}

function getYoutubeVideoId(url: string): string | null {
  const m = url.match(YOUTUBE_REGEX)
  return m ? m[1] : null
}

function getYoutubeThumbnail(url: string): string | null {
  const id = getYoutubeVideoId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

export function LinkEmbed({ url }: LinkEmbedProps) {
  const [data, setData] = useState<EmbedData | null>(null)
  const [loading, setLoading] = useState(true)
  const platform = getPlatform(url)
  const youtubeId = getYoutubeVideoId(url)
  const canEmbedYoutube = platform === 'youtube' && youtubeId
  const canEmbedTiktok = platform === 'tiktok'

  useEffect(() => {
    if (!platform) {
      setLoading(false)
      return
    }

    if (platform === 'youtube') {
      const thumb = getYoutubeThumbnail(url)
      setData({
        url,
        thumbnail_url: thumb ?? undefined,
        title: 'YouTube Video',
        provider_name: 'YouTube',
      })
      setLoading(false)
      return
    }

    const fetchEmbed = async () => {
      try {
        const res = await fetch(
          `https://noembed.com/embed?url=${encodeURIComponent(url)}`
        )
        if (res.ok) {
          const json = await res.json()
          setData({
            url: json.url ?? url,
            title: json.title,
            author_name: json.author_name,
            thumbnail_url: json.thumbnail_url,
            provider_name: json.provider_name ?? platform,
          })
        } else {
          setData({ url, provider_name: platform })
        }
      } catch {
        setData({ url, provider_name: platform })
      }
      setLoading(false)
    }
    fetchEmbed()
  }, [url, platform])

  if (!platform || loading) return null

  const displayTitle = data?.title || data?.author_name || platform
  const thumb = data?.thumbnail_url ?? (platform === 'youtube' ? getYoutubeThumbnail(url) : null)

  const borderColor =
    platform === 'youtube' ? '#ed4245' :
    platform === 'tiktok' ? '#00f2ea' :
    platform === 'instagram' ? '#e4405f' : '#ed4245'

  return (
    <div
      className="mt-2 max-w-2xl rounded overflow-hidden border-l-4 bg-[var(--bg-tertiary)]"
      style={{ borderLeftColor: borderColor }}
    >
      {/* Header mit Plattform + Link */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--text-muted)] uppercase font-medium">
            {data?.provider_name ?? platform}
          </p>
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {displayTitle}
          </p>
          {data?.author_name && data.author_name !== displayTitle && (
            <p className="text-xs text-[var(--text-muted)] truncate">{data.author_name}</p>
          )}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 ml-2 text-xs text-[var(--text-link)] hover:underline"
        >
          Öffnen →
        </a>
      </div>

      {/* Video-Embed oder Thumbnail */}
      {canEmbedYoutube && (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title="YouTube Video"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}

      {canEmbedTiktok && (
        <div className="aspect-[9/16] max-h-[500px] w-full max-w-[min(400px,100%)] mx-auto bg-black">
          <iframe
            src={getTiktokEmbedUrl(url)}
            title="TikTok Video"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {!canEmbedYoutube && !canEmbedTiktok && thumb && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <div className="relative aspect-video bg-[var(--bg-secondary)]">
            <img src={thumb} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
        </a>
      )}

      {!canEmbedYoutube && !canEmbedTiktok && !thumb && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-3 text-sm text-[var(--text-link)] hover:underline"
        >
          Video ansehen →
        </a>
      )}
    </div>
  )
}

export function extractEmbedUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/g
  const urls: string[] = []
  let m
  while ((m = urlRegex.exec(text)) !== null) {
    const url = m[0].replace(/[.,;:!?)]+$/, '')
    if (getPlatform(url)) {
      urls.push(url)
    }
  }
  return [...new Set(urls)]
}

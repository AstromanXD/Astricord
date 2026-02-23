/**
 * useVoiceChat - WebRTC Voice/Video Chat
 * Supabase Realtime ODER Backend WebSocket für Signaling
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useBackend, createWebSocket, sendBroadcast, voice } from '../lib/api'
import { playSoundVoiceJoin, playSoundVoiceLeave, playSoundMute, playSoundUnmute } from '../lib/sounds'
import { getVoiceSettings } from '../lib/voiceSettings'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

interface VoiceUser {
  userId: string
  username: string
  avatarUrl: string | null
  isMuted: boolean
  hasVideo?: boolean
  isScreenSharing?: boolean
}

interface UseVoiceChatReturn {
  isInVoice: boolean
  isMuted: boolean
  isVideoOn: boolean
  isScreenSharing: boolean
  localVideoStream: MediaStream | null
  remoteStreams: Map<string, MediaStream>
  currentChannelId: string | null
  voiceUsers: VoiceUser[]
  speakingUserIds: Set<string>
  joinVoice: (channelId: string) => Promise<void>
  leaveVoice: () => Promise<void>
  toggleMute: () => Promise<void>
  toggleVideo: () => Promise<void>
  toggleScreenShare: () => Promise<void>
}

const SPEAKING_THRESHOLD = 0.012
const SILENCE_DELAY_MS = 400

export function useVoiceChat(userId: string | undefined, username: string, avatarUrl?: string | null): UseVoiceChatReturn {
  const backend = useBackend()
  const [isInVoice, setIsInVoice] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [voiceUsers, setVoiceUsers] = useState<VoiceUser[]>([])
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null)
  const [speakingUserIds, setSpeakingUserIds] = useState<Set<string>>(new Set())

  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const currentChannelIdRef = useRef<string | null>(null)
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const channelRef = useRef<RealtimeChannel | { send: (m: { type: string; event: string; payload: unknown }) => void; unsubscribe: () => void } | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const isSpeakingRef = useRef(false)
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)

  const addRemoteStream = useCallback((remoteUserId: string, stream: MediaStream) => {
    setRemoteStreams((prev) => {
      const next = new Map(prev)
      prev.get(remoteUserId)?.getTracks().forEach((t) => t.stop())
      next.set(remoteUserId, stream)
      return next
    })
  }, [])

  const removeRemoteStream = useCallback((remoteUserId: string) => {
    setRemoteStreams((prev) => {
      const next = new Map(prev)
      prev.get(remoteUserId)?.getTracks().forEach((t) => t.stop())
      next.delete(remoteUserId)
      return next
    })
  }, [])

  const createPeerConnection = useCallback(
    (remoteUserId: string) => {
      if (peerConnectionsRef.current.has(remoteUserId)) return
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!)
      })

      pc.ontrack = (e) => {
        const stream = e.streams[0] || new MediaStream(e.track ? [e.track] : [])
        addRemoteStream(remoteUserId, stream)
      }

      pc.onicecandidate = (e) => {
        if (e.candidate && channelRef.current) {
          const ch = channelRef.current as { send: (m: { type: string; event: string; payload: unknown }) => void }
          ch.send({
            type: 'broadcast',
            event: 'webrtc-ice',
            payload: { fromUserId: userId, toUserId: remoteUserId, candidate: e.candidate },
          })
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
          removeRemoteStream(remoteUserId)
        }
      }

      peerConnectionsRef.current.set(remoteUserId, pc)
      pendingIceRef.current.set(remoteUserId, [])
    },
    [userId, addRemoteStream, removeRemoteStream]
  )

  const joinVoice = useCallback(
    async (channelId: string) => {
      if (!userId) return

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        localStreamRef.current = stream

        const audioContext = new AudioContext()
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
        }
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.8
        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)
        analyserRef.current = analyser

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const chName = `voice:${channelId}`
        const doSend = (event: string, payload: unknown) => {
          const ch = channelRef.current
          if (ch && 'send' in ch) ch.send({ type: 'broadcast', event, payload })
          else if (ch && typeof (ch as RealtimeChannel).send === 'function') (ch as RealtimeChannel).send({ type: 'broadcast', event, payload })
        }
        const checkSpeaking = () => {
          if (!analyserRef.current || !localStreamRef.current || !channelRef.current || !userId) return
          analyserRef.current.getByteFrequencyData(dataArray)
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          const normalized = avg / 255
          const isMutedNow = localStreamRef.current.getAudioTracks()[0]?.enabled === false

          if (isMutedNow || normalized < SPEAKING_THRESHOLD) {
            if (isSpeakingRef.current && !silenceTimeoutRef.current) {
              silenceTimeoutRef.current = setTimeout(() => {
                isSpeakingRef.current = false
                silenceTimeoutRef.current = null
                setSpeakingUserIds((prev) => {
                  const next = new Set(prev)
                  next.delete(userId!)
                  return next
                })
                doSend('voice-stopped', { userId })
              }, SILENCE_DELAY_MS)
            }
          } else {
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current)
              silenceTimeoutRef.current = null
            }
            if (!isSpeakingRef.current) {
              isSpeakingRef.current = true
              setSpeakingUserIds((prev) => new Set(prev).add(userId!))
              doSend('voice-speaking', { userId })
            }
          }
          animationRef.current = requestAnimationFrame(checkSpeaking)
        }
        checkSpeaking()

        if (backend) {
          await voice.join(channelId)
        } else {
          await supabase.from('voice_sessions').upsert(
            { channel_id: channelId, user_id: userId, is_muted: false, has_video: false, is_screen_sharing: false },
            { onConflict: 'channel_id,user_id' }
          )
        }

        currentChannelIdRef.current = channelId
        setCurrentChannelId(channelId)
        setIsInVoice(true)
        setIsMuted(false)
        playSoundVoiceJoin()

        if (backend) {
          const ws = createWebSocket(chName)
          const backendChannel = {
            send: (m: { type: string; event: string; payload: unknown }) => {
              if (m.type === 'broadcast') sendBroadcast(ws, chName, m.event, m.payload)
            },
            unsubscribe: () => {
              if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'unsubscribe', channel: chName }))
              ws.close()
            },
          }
          channelRef.current = backendChannel

          const handleMsg = (e: MessageEvent) => {
            try {
              const { event, payload } = JSON.parse(e.data as string)
              if (!event || payload === undefined) return
              if (event === 'voice-join' && payload.userId !== userId) {
                setVoiceUsers((prev) => {
                  if (prev.some((u) => u.userId === payload.userId)) return prev
                  return [...prev, { ...payload, hasVideo: payload.hasVideo ?? false, isScreenSharing: payload.isScreenSharing ?? false }]
                })
              } else if (event === 'voice-video-update') {
                setVoiceUsers((prev) => prev.map((u) => (u.userId === payload.userId ? { ...u, hasVideo: payload.hasVideo } : u)))
              } else if (event === 'voice-screen-update') {
                setVoiceUsers((prev) => prev.map((u) => (u.userId === payload.userId ? { ...u, isScreenSharing: payload.isScreenSharing } : u)))
              } else if (event === 'voice-leave') {
                setVoiceUsers((prev) => prev.filter((u) => u.userId !== payload.userId))
                setSpeakingUserIds((prev) => { const n = new Set(prev); n.delete(payload.userId); return n })
                peerConnectionsRef.current.get(payload.userId)?.close()
                peerConnectionsRef.current.delete(payload.userId)
                pendingIceRef.current.delete(payload.userId)
                removeRemoteStream(payload.userId)
              } else if (event === 'voice-speaking' && payload.userId !== userId) {
                setSpeakingUserIds((prev) => new Set(prev).add(payload.userId))
              } else if (event === 'voice-stopped') {
                setSpeakingUserIds((prev) => { const n = new Set(prev); n.delete(payload.userId); return n })
              } else if (event === 'webrtc-offer' && payload.toUserId === userId) {
                createPeerConnection(payload.fromUserId)
                const pc = peerConnectionsRef.current.get(payload.fromUserId)
                if (!pc) return
                pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)).then(() => pc.createAnswer())
                  .then((answer) => { pc.setLocalDescription(answer); return answer })
                  .then((answer) => backendChannel.send({ type: 'broadcast', event: 'webrtc-answer', payload: { fromUserId: userId, toUserId: payload.fromUserId, sdp: answer } }))
                  .then(() => { const pending = pendingIceRef.current.get(payload.fromUserId) ?? []; pending.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c))); pendingIceRef.current.set(payload.fromUserId, []) })
                  .catch((err) => console.error('Handle offer failed:', err))
              } else if (event === 'webrtc-answer' && payload.toUserId === userId) {
                const pc = peerConnectionsRef.current.get(payload.fromUserId)
                if (!pc) return
                pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)).then(() => {
                  const pending = pendingIceRef.current.get(payload.fromUserId) ?? []
                  pending.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)))
                  pendingIceRef.current.set(payload.fromUserId, [])
                }).catch((err) => console.error('Handle answer failed:', err))
              } else if (event === 'webrtc-ice' && payload.toUserId === userId) {
                const pc = peerConnectionsRef.current.get(payload.fromUserId)
                if (pc?.remoteDescription) {
                  pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch((err) => console.error('Add ICE failed:', err))
                } else {
                  const pending = pendingIceRef.current.get(payload.fromUserId) ?? []
                  pending.push(payload.candidate)
                  pendingIceRef.current.set(payload.fromUserId, pending)
                }
              }
            } catch (_) {}
          }
          ws.addEventListener('message', handleMsg)

          await new Promise<void>((resolve) => {
            if (ws.readyState === WebSocket.OPEN) resolve()
            else ws.addEventListener('open', () => resolve(), { once: true })
          })

          const localUser: VoiceUser = { userId, username, avatarUrl: avatarUrl ?? null, isMuted: false, hasVideo: false, isScreenSharing: false }
          backendChannel.send({ type: 'broadcast', event: 'voice-join', payload: { userId, username, avatarUrl: avatarUrl ?? null, isMuted: false, hasVideo: false, isScreenSharing: false } })

          const sessionsData = await voice.getSessions([channelId])
          const sessions = sessionsData?.[channelId] ?? []
          const existingUsers: VoiceUser[] = sessions
            .filter((s: { userId: string }) => s.userId !== userId)
            .map((s: { userId: string; username: string; avatarUrl: string | null; isMuted: boolean; hasVideo?: boolean; isScreenSharing?: boolean }) => ({
              userId: s.userId,
              username: s.username ?? 'Unbekannt',
              avatarUrl: s.avatarUrl ?? null,
              isMuted: s.isMuted,
              hasVideo: s.hasVideo ?? false,
              isScreenSharing: s.isScreenSharing ?? false,
            }))
          setVoiceUsers([localUser, ...existingUsers])
          for (const u of existingUsers) {
            createPeerConnection(u.userId)
            const pc = peerConnectionsRef.current.get(u.userId)
            if (pc?.signalingState === 'stable') {
              pc.createOffer().then((offer) => pc.setLocalDescription(offer))
                .then(() => backendChannel.send({ type: 'broadcast', event: 'webrtc-offer', payload: { fromUserId: userId, toUserId: u.userId, sdp: (pc as RTCPeerConnection & { localDescription?: RTCSessionDescription }).localDescription } }))
                .catch((err) => console.error('Create offer failed:', err))
            }
          }
          return
        }

        const channel = supabase.channel(`voice:${channelId}`)
        channelRef.current = channel

        channel
          .on('broadcast', { event: 'voice-join' }, ({ payload }) => {
            if (payload.userId === userId) return
            setVoiceUsers((prev) => {
              if (prev.some((u) => u.userId === payload.userId)) return prev
              return [...prev, { ...payload, hasVideo: payload.hasVideo ?? false, isScreenSharing: payload.isScreenSharing ?? false }]
            })
          })
          .on('broadcast', { event: 'voice-video-update' }, ({ payload }) => {
            setVoiceUsers((prev) =>
              prev.map((u) => (u.userId === payload.userId ? { ...u, hasVideo: payload.hasVideo } : u))
            )
          })
          .on('broadcast', { event: 'voice-screen-update' }, ({ payload }) => {
            setVoiceUsers((prev) =>
              prev.map((u) => (u.userId === payload.userId ? { ...u, isScreenSharing: payload.isScreenSharing } : u))
            )
          })
          .on('broadcast', { event: 'voice-leave' }, ({ payload }) => {
            setVoiceUsers((prev) => prev.filter((u) => u.userId !== payload.userId))
            setSpeakingUserIds((prev) => {
              const next = new Set(prev)
              next.delete(payload.userId)
              return next
            })
            peerConnectionsRef.current.get(payload.userId)?.close()
            peerConnectionsRef.current.delete(payload.userId)
            pendingIceRef.current.delete(payload.userId)
            removeRemoteStream(payload.userId)
          })
          .on('broadcast', { event: 'voice-speaking' }, ({ payload }) => {
            if (payload.userId !== userId) setSpeakingUserIds((prev) => new Set(prev).add(payload.userId))
          })
          .on('broadcast', { event: 'voice-stopped' }, ({ payload }) => {
            setSpeakingUserIds((prev) => {
              const next = new Set(prev)
              next.delete(payload.userId)
              return next
            })
          })
          .on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
            if (payload.toUserId !== userId) return
            const existing = peerConnectionsRef.current.get(payload.fromUserId)
            if (existing) {
              existing.close()
              peerConnectionsRef.current.delete(payload.fromUserId)
            }
            createPeerConnection(payload.fromUserId)
            const pc = peerConnectionsRef.current.get(payload.fromUserId)
            if (!pc) return
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)
              channel.send({
                type: 'broadcast',
                event: 'webrtc-answer',
                payload: { fromUserId: userId, toUserId: payload.fromUserId, sdp: answer },
              })
              const pending = pendingIceRef.current.get(payload.fromUserId) ?? []
              for (const c of pending) await pc.addIceCandidate(new RTCIceCandidate(c))
              pendingIceRef.current.set(payload.fromUserId, [])
            } catch (err) {
              console.error('Handle offer failed:', err)
            }
          })
          .on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
            if (payload.toUserId !== userId) return
            const pc = peerConnectionsRef.current.get(payload.fromUserId)
            if (!pc) return
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
              const pending = pendingIceRef.current.get(payload.fromUserId) ?? []
              for (const c of pending) await pc.addIceCandidate(new RTCIceCandidate(c))
              pendingIceRef.current.set(payload.fromUserId, [])
            } catch (err) {
              console.error('Handle answer failed:', err)
            }
          })
          .on('broadcast', { event: 'webrtc-ice' }, async ({ payload }) => {
            if (payload.toUserId !== userId) return
            const pc = peerConnectionsRef.current.get(payload.fromUserId)
            if (pc?.remoteDescription) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
              } catch (err) {
                console.error('Add ICE candidate failed:', err)
              }
            } else {
              const pending = pendingIceRef.current.get(payload.fromUserId) ?? []
              pending.push(payload.candidate)
              pendingIceRef.current.set(payload.fromUserId, pending)
            }
          })
          .subscribe()

        channel.send({
          type: 'broadcast',
          event: 'voice-join',
          payload: { userId, username, avatarUrl: avatarUrl ?? null, isMuted: false, hasVideo: false, isScreenSharing: false },
        })

        const { data: sessions } = await supabase
          .from('voice_sessions')
          .select('user_id, is_muted, has_video, is_screen_sharing')
          .eq('channel_id', channelId)

        const existingUsers: VoiceUser[] = await Promise.all(
          (sessions ?? [])
            .filter((s) => s.user_id !== userId)
            .map(async (s) => {
              const { data: p } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', s.user_id)
                .single()
              return {
                userId: s.user_id,
                username: p?.username ?? 'Unbekannt',
                avatarUrl: p?.avatar_url ?? null,
                isMuted: s.is_muted,
                hasVideo: s.has_video ?? false,
                isScreenSharing: s.is_screen_sharing ?? false,
              }
            })
        )
        const localUser: VoiceUser = {
          userId: userId!,
          username,
          avatarUrl: avatarUrl ?? null,
          isMuted: false,
          hasVideo: isVideoOn,
          isScreenSharing: isScreenSharing,
        }
        setVoiceUsers([localUser, ...existingUsers])

        for (const u of existingUsers) {
          createPeerConnection(u.userId)
          const pc = peerConnectionsRef.current.get(u.userId)
          if (pc) {
            try {
              const offer = await pc.createOffer()
              await pc.setLocalDescription(offer)
              channel.send({
                type: 'broadcast',
                event: 'webrtc-offer',
                payload: { fromUserId: userId, toUserId: u.userId, sdp: offer },
              })
            } catch (err) {
              console.error('Create offer failed:', err)
            }
          }
        }
      } catch (err) {
        console.error('Voice join failed:', err)
      }
    },
    [userId, username, avatarUrl, createPeerConnection, removeRemoteStream, backend]
  )

  const leaveVoice = useCallback(async () => {
    const channelId = currentChannelIdRef.current ?? currentChannelId
    if (!channelId || !userId) return

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    isSpeakingRef.current = false
    analyserRef.current = null

    playSoundVoiceLeave()
    channelRef.current?.send({ type: 'broadcast', event: 'voice-leave', payload: { userId } })
    channelRef.current?.unsubscribe?.()
    channelRef.current = null

    if (backend) {
      await voice.leave(channelId)
    } else {
      await supabase
        .from('voice_sessions')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId)
    }

    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    setLocalVideoStream(null)
    setIsVideoOn(false)
    setIsScreenSharing(false)

    peerConnectionsRef.current.forEach((pc) => pc.close())
    peerConnectionsRef.current.clear()
    pendingIceRef.current.clear()
    setRemoteStreams(new Map())

    currentChannelIdRef.current = null
    setCurrentChannelId(null)
    setIsInVoice(false)
    setVoiceUsers([])
    setSpeakingUserIds(new Set())
  }, [currentChannelId, userId, backend])

  useEffect(() => {
    currentChannelIdRef.current = currentChannelId
  }, [currentChannelId])

  const renegotiateAll = useCallback(async () => {
    const ch = channelRef.current
    if (!ch || !userId) return
    for (const [remoteUserId, pc] of peerConnectionsRef.current) {
      if (pc.signalingState !== 'stable') continue
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        ch.send({
          type: 'broadcast',
          event: 'webrtc-offer',
          payload: { fromUserId: userId, toUserId: remoteUserId, sdp: offer },
        })
      } catch (err) {
        console.error('Renegotiate failed:', err)
      }
    }
  }, [userId])

  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current || !currentChannelId || !userId) return
    const newVideo = !isVideoOn
    if (newVideo) {
      try {
        const vs = getVoiceSettings()
        const videoConstraints: MediaTrackConstraints = vs.cameraDeviceId && vs.cameraDeviceId !== 'default'
          ? { deviceId: vs.cameraDeviceId }
          : true
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints })
        stream.getVideoTracks().forEach((t) => localStreamRef.current?.addTrack(t))
        setLocalVideoStream(stream)
        setIsVideoOn(true)
        for (const pc of peerConnectionsRef.current.values()) {
          stream.getVideoTracks().forEach((track) => pc.addTrack(track, stream))
        }
        await renegotiateAll()
      } catch (err) {
        console.error('Video failed:', err)
        return
      }
    } else {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.stop()
        localStreamRef.current?.removeTrack(t)
      })
      setLocalVideoStream(null)
      setIsVideoOn(false)
    }
    if (backend) {
      await voice.video(currentChannelId, newVideo)
    } else {
      await supabase
        .from('voice_sessions')
        .update({ has_video: newVideo })
        .eq('channel_id', currentChannelId)
        .eq('user_id', userId)
    }
    channelRef.current?.send({
      type: 'broadcast',
      event: 'voice-video-update',
      payload: { userId, hasVideo: newVideo },
    })
    setVoiceUsers((prev) =>
      prev.map((u) => (u.userId === userId ? { ...u, hasVideo: newVideo } : u))
    )
  }, [isVideoOn, renegotiateAll, currentChannelId, userId, backend])

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.stop()
      localStreamRef.current?.removeTrack(t)
    })
    setLocalVideoStream(null)
    setIsScreenSharing(false)
    setIsVideoOn(false)
    if (currentChannelId && userId) {
      if (backend) {
        voice.screen(currentChannelId, false).catch(() => {})
      } else {
        supabase
          .from('voice_sessions')
          .update({ is_screen_sharing: false })
          .eq('channel_id', currentChannelId)
          .eq('user_id', userId)
          .then(() => {})
      }
      channelRef.current?.send({
        type: 'broadcast',
        event: 'voice-screen-update',
        payload: { userId, isScreenSharing: false },
      })
      setVoiceUsers((prev) =>
        prev.map((u) => (u.userId === userId ? { ...u, isScreenSharing: false } : u))
      )
    }
  }, [currentChannelId, userId, backend])

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      stopScreenShare()
    } else {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        console.warn('Bildschirm teilen wird in dieser Umgebung nicht unterstützt (z.B. Electron ohne Berechtigung).')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        screenStreamRef.current = stream
        stream.getVideoTracks().forEach((t) => {
          t.onended = () => stopScreenShare()
          localStreamRef.current?.addTrack(t)
        })
        setLocalVideoStream(stream)
        setIsScreenSharing(true)
        setIsVideoOn(true)
        for (const pc of peerConnectionsRef.current.values()) {
          stream.getVideoTracks().forEach((track) => pc.addTrack(track, stream))
        }
        await renegotiateAll()
        if (currentChannelId && userId) {
          if (backend) {
            await voice.screen(currentChannelId, true)
          } else {
            await supabase
              .from('voice_sessions')
              .update({ is_screen_sharing: true })
              .eq('channel_id', currentChannelId)
              .eq('user_id', userId)
          }
          channelRef.current?.send({
            type: 'broadcast',
            event: 'voice-screen-update',
            payload: { userId, isScreenSharing: true },
          })
          setVoiceUsers((prev) =>
            prev.map((u) => (u.userId === userId ? { ...u, isScreenSharing: true } : u))
          )
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('NotSupported') || msg.includes('not supported')) {
          console.warn('Bildschirm teilen: In dieser Umgebung nicht verfügbar (z.B. Electron, unsicherer Kontext).')
        } else {
          console.error('Screen share failed:', err)
        }
      }
    }
  }, [isScreenSharing, stopScreenShare, renegotiateAll, currentChannelId, userId, backend])

  const toggleMute = useCallback(async () => {
    if (!currentChannelId || !userId) return

    const newMuted = !isMuted
    setIsMuted(newMuted)
    if (newMuted) playSoundMute()
    else playSoundUnmute()

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !newMuted
      })
    }

    if (backend) {
      await voice.mute(currentChannelId, newMuted)
    } else {
      await supabase
        .from('voice_sessions')
        .update({ is_muted: newMuted })
        .eq('channel_id', currentChannelId)
        .eq('user_id', userId)
    }
  }, [currentChannelId, userId, isMuted, backend])

  return {
    isInVoice,
    isMuted,
    isVideoOn,
    isScreenSharing,
    localVideoStream,
    remoteStreams,
    currentChannelId,
    voiceUsers,
    speakingUserIds,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  }
}

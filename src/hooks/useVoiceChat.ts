/**
 * useVoiceChat - WebRTC Voice/Video Chat
 * Peer-to-Peer Audio/Video über Supabase Realtime Signaling (Offer/Answer/ICE)
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

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
  const channelRef = useRef<RealtimeChannel | null>(null)
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
          channelRef.current.send({
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
                channelRef.current?.send({ type: 'broadcast', event: 'voice-stopped', payload: { userId } })
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
              channelRef.current?.send({ type: 'broadcast', event: 'voice-speaking', payload: { userId } })
            }
          }
          animationRef.current = requestAnimationFrame(checkSpeaking)
        }
        checkSpeaking()

        await supabase.from('voice_sessions').upsert(
          { channel_id: channelId, user_id: userId, is_muted: false, has_video: false, is_screen_sharing: false },
          { onConflict: 'channel_id,user_id' }
        )

        currentChannelIdRef.current = channelId
        setCurrentChannelId(channelId)
        setIsInVoice(true)
        setIsMuted(false)

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
    [userId, username, avatarUrl, createPeerConnection, removeRemoteStream]
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

    channelRef.current?.send({ type: 'broadcast', event: 'voice-leave', payload: { userId } })
    channelRef.current?.unsubscribe()
    channelRef.current = null

    await supabase
      .from('voice_sessions')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', userId)

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
  }, [currentChannelId, userId])

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
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
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
    await supabase
      .from('voice_sessions')
      .update({ has_video: newVideo })
      .eq('channel_id', currentChannelId)
      .eq('user_id', userId)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'voice-video-update',
      payload: { userId, hasVideo: newVideo },
    })
    setVoiceUsers((prev) =>
      prev.map((u) => (u.userId === userId ? { ...u, hasVideo: newVideo } : u))
    )
  }, [isVideoOn, renegotiateAll, currentChannelId, userId])

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
      supabase
        .from('voice_sessions')
        .update({ is_screen_sharing: false })
        .eq('channel_id', currentChannelId)
        .eq('user_id', userId)
        .then(() => {})
      channelRef.current?.send({
        type: 'broadcast',
        event: 'voice-screen-update',
        payload: { userId, isScreenSharing: false },
      })
      setVoiceUsers((prev) =>
        prev.map((u) => (u.userId === userId ? { ...u, isScreenSharing: false } : u))
      )
    }
  }, [currentChannelId, userId])

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
          await supabase
            .from('voice_sessions')
            .update({ is_screen_sharing: true })
            .eq('channel_id', currentChannelId)
            .eq('user_id', userId)
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
  }, [isScreenSharing, stopScreenShare, renegotiateAll, currentChannelId, userId])

  const toggleMute = useCallback(async () => {
    if (!currentChannelId || !userId) return

    const newMuted = !isMuted
    setIsMuted(newMuted)

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !newMuted
      })
    }

    await supabase
      .from('voice_sessions')
      .update({ is_muted: newMuted })
      .eq('channel_id', currentChannelId)
      .eq('user_id', userId)
  }, [currentChannelId, userId, isMuted])

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

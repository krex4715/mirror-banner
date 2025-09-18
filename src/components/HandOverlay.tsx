import { useEffect, useRef, useState } from 'react'
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision'

type Props = {
  onPinch?: (phase: 'start' | 'move' | 'end', x: number, y: number) => void
  onHandMove?: (x: number, y: number) => void
  pinchOn?: number   // 핀치 시작 임계값(정규화 거리)
  pinchOff?: number  // 핀치 해제 임계값(정규화 거리)
}

export default function HandOverlay({ onPinch, onHandMove, pinchOn = 0.045, pinchOff = 0.06 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let landmarker: HandLandmarker | null = null
    let raf = 0
    let stopped = false
    let firstStream: MediaStream | null = null
    let finalStream: MediaStream | null = null
    let timeoutId: any = null
    let videoInputs: MediaDeviceInfo[] = []
    let currentCamIndex = 1
    let pinching = false // 내부 상태(히스테리시스 후)

    const stopStream = (s: MediaStream | null) => {
      if (!s) return
      for (const t of s.getTracks()) t.stop()
    }

    const fitCanvas = (videoEl: HTMLVideoElement, canvas: HTMLCanvasElement) => {
      const { videoWidth: w, videoHeight: h } = videoEl
      if (!w || !h) return
      canvas.width = w
      canvas.height = h
    }

    const openStreamByIndex = async (idx: number) => {
      const videoEl = videoRef.current!
      const chosen = videoInputs[idx] ?? videoInputs[0]
      if (!chosen) throw new Error('카메라 장치를 찾을 수 없습니다.')

      stopStream(finalStream)
      finalStream = null

      finalStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: chosen.deviceId },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      })
      videoEl.srcObject = finalStream
      await new Promise<void>((res) => {
        if (videoEl.readyState >= 2) res()
        else videoEl.addEventListener('loadedmetadata', () => res(), { once: true })
      })
      await videoEl.play().catch(() => {})
      fitCanvas(videoEl, canvasRef.current!)
      currentCamIndex = idx
      console.log('[cam] using index', currentCamIndex, chosen.label || chosen.deviceId)
    }

    const start = async () => {
      try {
        const params = new URLSearchParams(location.search)
        const camIndexFromQuery = params.get('cam')
        if (Number.isFinite(Number(camIndexFromQuery))) {
          currentCamIndex = Number(camIndexFromQuery)
        }

        const videoEl = videoRef.current!
        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')!

        // 1) 권한 요청(초기 아무 카메라)
        firstStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        videoEl.srcObject = firstStream

        timeoutId = setTimeout(() => {
          if (!ready) setError('카메라 초기화가 지연됩니다. 권한/연결 상태를 확인해주세요.')
        }, 8000)

        await new Promise<void>((res) => {
          if (videoEl.readyState >= 2) res()
          else videoEl.addEventListener('loadedmetadata', () => res(), { once: true })
        })
        await videoEl.play().catch(() => {})
        fitCanvas(videoEl, canvas)
        window.addEventListener('resize', () => fitCanvas(videoEl, canvas))

        // 2) 장치 나열
        const devices = await navigator.mediaDevices.enumerateDevices()
        videoInputs = devices.filter((d) => d.kind === 'videoinput')
        if (videoInputs.length === 0) throw new Error('카메라 장치를 찾을 수 없습니다.')

        // 원하는 인덱스로 재연결
        const firstTrack = firstStream.getVideoTracks()[0]
        const firstId = firstTrack.getSettings().deviceId
        const chosen = videoInputs[currentCamIndex] ?? videoInputs[0]
        if (!firstId || firstId !== chosen.deviceId) {
          stopStream(firstStream)
          firstStream = null
          await openStreamByIndex(currentCamIndex)
        } else {
          finalStream = firstStream
        }

        // 3) MediaPipe — 로컬(오프라인) 경로
        const vision = await FilesetResolver.forVisionTasks('./mediapipe/wasm')
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: './mediapipe/hand_landmarker.task' },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })

        setReady(true)
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }

        // 4) 렌더 루프 + 핀치 감지
        const pairs: [number, number][] = [
          [0,1],[1,2],[2,3],[3,4],
          [0,5],[5,6],[6,7],[7,8],
          [5,9],[9,10],[10,11],[11,12],
          [9,13],[13,14],[14,15],[15,16],
          [13,17],[17,18],[18,19],[19,20],
          [0,17],
        ]

        const draw = () => {
          if (!landmarker || stopped) return
          const w = videoEl.videoWidth
          const h = videoEl.videoHeight
          if (w && h) {
            // 캔버스는 시각화를 위해 좌우 반전
            ctx.setTransform(-1, 0, 0, 1, w, 0)
            ctx.clearRect(0, 0, w, h)

            const result: HandLandmarkerResult | undefined =
              landmarker.detectForVideo(videoEl, performance.now())

            let nowPinching = pinching
            let cx = 0, cy = 0 // 정규화(0..1)

            if (result?.landmarks?.length) {
              const hand = result.landmarks[0]
              const thumb = hand[4]
              const index = hand[8]

              const dx = thumb.x - index.x
              const dy = thumb.y - index.y
              const d = Math.hypot(dx, dy)

              if (!pinching && d <= pinchOn) nowPinching = true
              else if (pinching && d >= pinchOff) nowPinching = false

              // 중심(정규화)
              cx = (thumb.x + index.x) / 2
              cy = (thumb.y + index.y) / 2

              // 뼈대 & 점 시각화
              ctx.lineWidth = 2
              ctx.strokeStyle = nowPinching ? '#34d399' : '#ffffff'
              ctx.fillStyle = nowPinching ? '#34d399' : '#ffffff'
              for (const p of hand) {
                ctx.beginPath()
                ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2)
                ctx.fill()
              }
              for (const [a, b] of pairs) {
                const A = hand[a], B = hand[b]
                ctx.beginPath()
                ctx.moveTo(A.x * w, A.y * h)
                ctx.lineTo(B.x * w, B.y * h)
                ctx.stroke()
              }

              // 중심 강조(캔버스 좌표 — 이미 좌우 반전 상태라 그대로 그림)
              ctx.beginPath()
              ctx.arc(cx * w, cy * h, nowPinching ? 10 : 6, 0, Math.PI * 2)
              ctx.stroke()
            }

            // 좌표계 복구
            ctx.setTransform(1, 0, 0, 1, 0, 0)

            // === 콜백: 항상 "뷰포트 CSS 픽셀" 좌표로 변환해 전달 ===
            // 정규화(cx,cy)는 원본 비디오 좌표(좌->우 증가).
            // 화면은 거울처럼 보이도록 반전시켜 그렸다. 사용자가 느끼는 좌표계에 맞추려면 X를 뒤집자.
            // 뷰포트 좌표:
           const viewportX = (1.0 - cx) * window.innerWidth
           const viewportY = cy * window.innerHeight

           // ★ 손 보일 때마다 안개에 현재 좌표 공급
           if (onHandMove && result?.landmarks?.length) {
             onHandMove(viewportX, viewportY)
           }

            if (onPinch) {
              if (!pinching && nowPinching) {
                onPinch('start', viewportX, viewportY)
              } else if (pinching && nowPinching) {
                onPinch('move', viewportX, viewportY)
              } else if (pinching && !nowPinching) {
                onPinch('end', viewportX, viewportY)
              }
            }

            pinching = nowPinching
          }
          raf = requestAnimationFrame(draw)
        }

        draw()

        // 카메라 전환(C)
        const onKey = (e: KeyboardEvent) => {
          if (e.key.toLowerCase() === 'c' && videoInputs.length > 1) {
            const next = (currentCamIndex + 1) % videoInputs.length
            openStreamByIndex(next).catch(err => {
              console.error('카메라 전환 실패:', err)
              setError('카메라 전환 실패: ' + (err?.message ?? String(err)))
            })
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      } catch (e: any) {
        console.error(e)
        setError(e?.message ?? String(e))
      }
    }

    const cleanupExtra = start()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stopStream(finalStream)
      if (firstStream && firstStream !== finalStream) stopStream(firstStream)
      landmarker?.close && landmarker.close()
      if (timeoutId) clearTimeout(timeoutId)
      cleanupExtra?.then?.((fn) => typeof fn === 'function' && fn())
    }
  }, [onPinch, pinchOn, pinchOff])

  return (
    <>
      <video ref={videoRef} playsInline muted autoPlay style={{ display: 'none' }} />
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
      {!ready && !error && (
        <div
          style={{
            position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
            color: '#888', fontSize: 14, zIndex: 3, pointerEvents: 'none'
          }}
        >
          카메라 로딩 중…
        </div>
      )}
      {error && (
        <div
          style={{
            position: 'fixed', top: 20, left: 20, color: '#f66',
            background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderRadius: 8, zIndex: 4
          }}
        >
          {error}
        </div>
      )}
    </>
  )
}

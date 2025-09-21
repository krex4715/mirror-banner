import { useEffect, useRef, useState } from 'react'
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision'

const LINE_PX = 2                 // 화면에서 보일 선 두께(px)
const POINT_RADIUS_PX = 3         // 화면에서 보일 점 반지름(px)

export default function HandOverlay() {
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
    let currentCamIndex = 1 // 기본 1번

    const stopStream = (s: MediaStream | null) => {
      if (!s) return
      for (const t of s.getTracks()) t.stop()
    }

    // 캔버스를 "표시 크기 × DPR"로 맞추기 (lineWidth가 CSS 스케일에 영향받지 않게)
    const resizeCanvasToDisplay = (canvas: HTMLCanvasElement) => {
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas.clientWidth || window.innerWidth
      const cssH = canvas.clientHeight || window.innerHeight
      const needW = Math.round(cssW * dpr)
      const needH = Math.round(cssH * dpr)
      if (canvas.width !== needW) canvas.width = needW
      if (canvas.height !== needH) canvas.height = needH
    }

    // src(w,h)을 dst(W,H)에 "cover"로 투영할 때 scale/offset 계산
    const computeCover = (srcW: number, srcH: number, dstW: number, dstH: number) => {
      const scale = Math.max(dstW / srcW, dstH / srcH)
      const drawW = srcW * scale
      const drawH = srcH * scale
      const offX = (dstW - drawW) / 2
      const offY = (dstH - drawH) / 2
      return { scale, offX, offY }
    }

    // 표시 크기 기준으로만 캔버스 내부 해상도(DPR) 갱신
    const fitCanvas = (canvas: HTMLCanvasElement) => {
      resizeCanvasToDisplay(canvas)
    }

    const openStreamByIndex = async (idx: number) => {
      const videoEl = videoRef.current!
      const chosen = videoInputs[idx] ?? videoInputs[0]
      if (!chosen) throw new Error('카메라 장치를 찾을 수 없습니다.')

      stopStream(finalStream)
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
      fitCanvas(canvasRef.current!)
      currentCamIndex = idx
      console.log('[cam] using index', currentCamIndex, chosen.label || chosen.deviceId)
    }

    const start = async () => {
      try {
        // ?cam=로 오버라이드
        const params = new URLSearchParams(location.search)
        const camIndexFromQuery = params.get('cam')
        if (Number.isFinite(Number(camIndexFromQuery))) {
          currentCamIndex = Number(camIndexFromQuery)
        }

        const videoEl = videoRef.current!
        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')!

        // 1) 권한 팝업 유도
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
        fitCanvas(canvas)
        window.addEventListener('resize', () => fitCanvas(canvas))

        // 2) 장치 나열
        const devices = await navigator.mediaDevices.enumerateDevices()
        videoInputs = devices.filter((d) => d.kind === 'videoinput')
        console.log('[cams]', videoInputs.map((d, i) => ({ i, label: d.label, deviceId: d.deviceId })))
        if (videoInputs.length === 0) throw new Error('카메라 장치를 찾을 수 없습니다.')

        // 첫 스트림 장치 vs 원하는 인덱스 비교
        const firstTrack = firstStream.getVideoTracks()[0]
        const firstId = firstTrack.getSettings().deviceId
        const chosen = videoInputs[currentCamIndex] ?? videoInputs[0]
        if (!firstId || firstId !== chosen.deviceId) {
          stopStream(firstStream); firstStream = null
          await openStreamByIndex(currentCamIndex)
        } else {
          finalStream = firstStream
        }

        // 3) MediaPipe 로컬 로드 (오프라인 OK)
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

        // 4) 랜더 루프 (cover 투영 + 절대 px 두께)
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
          const vW = videoEl.videoWidth
          const vH = videoEl.videoHeight
          if (vW && vH) {
            // 캔버스 내부 해상도(DPR 반영된 픽셀)
            const cW = canvas.width
            const cH = canvas.height

            // 비디오를 캔버스에 cover로 투영 + 좌우 반전
            const { scale, offX, offY } = computeCover(vW, vH, cW, cH)

            // 배경 클리어
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.clearRect(0, 0, cW, cH)

            // 좌우반전 + cover 오프셋/스케일 적용
            // (x는 0~vW, y는 0~vH 좌표계로 그린다고 가정)
            ctx.setTransform(-scale, 0, 0, scale, cW - offX, offY)

            const ts = performance.now()
            const result: HandLandmarkerResult | undefined =
              landmarker.detectForVideo(videoEl, ts)

            if (result?.landmarks) {
              // 선/점 두께를 "화면 px"로 고정하기 위해 scale 보정
              const dpr = window.devicePixelRatio || 1
              const fixedLine = (LINE_PX * dpr) / scale
              const fixedR = (POINT_RADIUS_PX * dpr) / scale

              ctx.lineWidth = fixedLine
              ctx.strokeStyle = '#ffffff'
              ctx.fillStyle = '#ffffff'

              for (const hand of result.landmarks) {
                // MediaPipe 좌표는 0~1 정규화 → 영상 픽셀 좌표로 변환
                for (const p of hand) {
                  const x = p.x * vW
                  const y = p.y * vH
                  ctx.beginPath()
                  ctx.arc(x, y, fixedR, 0, Math.PI * 2)
                  ctx.fill()
                }
                for (const [a, b] of pairs) {
                  const A = hand[a], B = hand[b]
                  const Ax = A.x * vW, Ay = A.y * vH
                  const Bx = B.x * vW, By = B.y * vH
                  ctx.beginPath()
                  ctx.moveTo(Ax, Ay)
                  ctx.lineTo(Bx, By)
                  ctx.stroke()
                }
              }
            }

            // 좌표계 복구
            ctx.setTransform(1, 0, 0, 1, 0, 0)
          }
          raf = requestAnimationFrame(draw)
        }

        draw()

        // 5) 카메라 전환 키 (C)
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
  }, [])

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

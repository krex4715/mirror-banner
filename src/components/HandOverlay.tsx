import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision'

import { resizeCanvasToDisplay, computeCover, centroid } from '../utils/geom'
import { isFist, updateFistState } from '../gesture/fist'
import { NeonSmoke } from '../effects/neonSmoke'

type Prompt = { visible: boolean; x: number; y: number }

export default function HandOverlay() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const skelRef  = useRef<HTMLCanvasElement>(null) // 좌표 변환용(그림은 안 그림)
  const fxRef    = useRef<HTMLCanvasElement>(null) // 연기

  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ▽▽ 손별 안내 배지 상태(최대 2손) ▽▽
  const [prompts, setPrompts] = useState<Prompt[]>([
    { visible: false, x: 0, y: 0 },
    { visible: false, x: 0, y: 0 },
  ])

  // 손 2개까지 제스처 상태
  const fistEma = useRef<number[]>([0, 0])
  const fistOn  = useRef<boolean[]>([false, false])

  // 손별 위치 EMA(안내 원 떨림 방지, CSS px)
  const posEma  = useRef<{x:number;y:number}[]>([{x:0,y:0},{x:0,y:0}])

  // 손별 안내 안정화(최근 open 손의 마지막 시각/좌표)
  const lastOpenTsRef  = useRef<number[]>([0,0])
  const lastOpenPosRef = useRef<{x:number;y:number}[]>([{x:0,y:0},{x:0,y:0}])
  const GUIDE_GRACE_MS = 160 // 오픈 손이 잠깐 사라져도 유지할 시간(ms)

  useEffect(() => {
    let landmarker: HandLandmarker | null = null
    let stream: MediaStream | null = null
    let smoke: NeonSmoke | null = null
    let raf = 0
    let stopped = false

    const fitAll = () => {
      if (skelRef.current) resizeCanvasToDisplay(skelRef.current)
      if (fxRef.current && skelRef.current) {
        fxRef.current.width  = skelRef.current.width
        fxRef.current.height = skelRef.current.height
      }
      if (smoke && skelRef.current) {
        smoke.setPixelSize(skelRef.current.width, skelRef.current.height)
      }
    }

    const onResize = () => fitAll()

    const start = async () => {
      try {
        const v  = videoRef.current!
        const cS = skelRef.current!
        const cF = fxRef.current!
        const ctxS = cS.getContext('2d')!

        // 1) 카메라
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        v.srcObject = stream
        await new Promise<void>((res) => {
          if (v.readyState >= 2) res()
          else v.addEventListener('loadedmetadata', () => res(), { once: true })
        })
        await v.play().catch(() => {})

        fitAll()
        window.addEventListener('resize', onResize, { passive: true })

        // 2) 모델
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

        // 3) 연기
        smoke = new NeonSmoke(cF)
        smoke.setPixelSize(cS.width, cS.height)

        // 4) 루프
        const draw = () => {
          if (!landmarker || stopped) return
          const vW = v.videoWidth
          const vH = v.videoHeight

          if (vW && vH) {
            const cW = cS.width
            const cH = cS.height
            const { scale, offX, offY } = computeCover(vW, vH, cW, cH)

            // 좌표계만 맞춤(그리진 않음)
            ctxS.setTransform(1, 0, 0, 1, 0, 0)
            ctxS.clearRect(0, 0, cW, cH)
            ctxS.setTransform(-scale, 0, 0, scale, cW - offX, offY)

            const ts = performance.now()
            const result: HandLandmarkerResult | undefined = landmarker.detectForVideo(v, ts)

            // 이 프레임에서 관측된 손 인덱스 플래그
            const seen: boolean[] = [false, false]

            if (result?.landmarks?.length) {
              const dpr = window.devicePixelRatio || 1

              for (let i = 0; i < Math.min(2, result.landmarks.length); i++) {
                const hand = result.landmarks[i]
                seen[i] = true

                // 제스처
                const s = updateFistState(
                  fistOn.current[i] || false,
                  fistEma.current[i] || 0,
                  isFist(hand),
                )
                fistEma.current[i] = s.ema
                fistOn.current[i]  = s.on

                // 손 중심(비디오 px) → 스켈레톤 캔버스 내부 '디바이스 픽셀'
                const { x, y } = centroid(hand, vW, vH)
                const sx = (cW - offX) + (-scale * x)
                const sy = offY + (scale * y)

                // CSS px (안내 배지 배치용)
                const cssX = sx / dpr
                const cssY = sy / dpr

                // 위치 EMA(안내 UI 흔들림 방지)
                const alpha = 0.35
                const prev = posEma.current[i]
                posEma.current[i] = {
                  x: prev.x ? prev.x*(1-alpha) + cssX*alpha : cssX,
                  y: prev.y ? prev.y*(1-alpha) + cssY*alpha : cssY,
                }

                if (s.on) {
                  // 주먹이면 안내 숨김 + 연기
                  smoke!.simmer(sx, sy - 12, { hue: 305, density: 0.20 })
                  if (s.ema > 0.85) smoke!.burst(sx, sy - 16, { hue: 305, count: 10 })
                  
                  // ✅ 주먹 상태에서만 '연기 커서' 이벤트 발행 (CSS 좌표로)
                  window.dispatchEvent(new CustomEvent('smokePoint', {
                    detail: { x: cssX, y: cssY, fist: true }
                  }))

                } 
                
                else {
                  // 주먹이 아니면 이 손의 안내 위치/시각 갱신
                  lastOpenTsRef.current[i]  = ts
                  lastOpenPosRef.current[i] = { x: posEma.current[i].x, y: posEma.current[i].y }
                  
                  window.dispatchEvent(new CustomEvent('smokePoint', {
                    detail: { x: cssX, y: cssY, fist: false }
                  }))
                }
              }
            }

            // === 프레임 말미: 손별 안내 표시/숨김 결정(안정화) ===
            const now = performance.now()
            setPrompts((prev) => {
              const next: Prompt[] = [{...prev[0]}, {...prev[1]}]

              for (let i = 0; i < 2; i++) {
                const isSeen = seen[i]
                const isFistNow = fistOn.current[i]

                // 기본: 숨김
                let visible = false
                let x = next[i].x
                let y = next[i].y

                if (isSeen && !isFistNow) {
                  // 지금 프레임에 주먹 아님 → 즉시 표시
                  visible = true
                  x = lastOpenPosRef.current[i].x
                  y = lastOpenPosRef.current[i].y
                } else if (!isSeen && (now - lastOpenTsRef.current[i] < GUIDE_GRACE_MS)) {
                  // 잠깐 손이 끊겨도 그레이스 타임 동안 유지
                  visible = true
                  x = lastOpenPosRef.current[i].x
                  y = lastOpenPosRef.current[i].y
                } else {
                  // 손이 없거나 주먹이면 숨김
                  visible = false
                }

                if (visible !== next[i].visible || x !== next[i].x || y !== next[i].y) {
                  next[i] = { visible, x, y }
                }
              }

              // 변경이 있으면 새 배열 반환(리렌더), 없으면 prev 유지
              if (
                next[0].visible !== prev[0].visible || next[0].x !== prev[0].x || next[0].y !== prev[0].y ||
                next[1].visible !== prev[1].visible || next[1].x !== prev[1].x || next[1].y !== prev[1].y
              ) {
                return next
              }
              return prev
            })

            // 좌표계 복구
            ctxS.setTransform(1, 0, 0, 1, 0, 0)
          }

          // FX 틱
          smoke?.tick()
          raf = requestAnimationFrame(draw)
        }

        draw()
      } catch (e: any) {
        console.error(e)
        setError(e?.message ?? String(e))
      }
    }

    start()

    return () => {
      stopped = true
      cancelAnimationFrame(raf || 0)
      stream?.getTracks().forEach((t) => t.stop())
      landmarker?.close?.()
      smoke?.stop()
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <>
      <video ref={videoRef} playsInline muted autoPlay style={{ display: 'none' }} />

      {/* 그림은 안 그리지만 좌표 변환 기준으로 사용 */}
      <canvas
        ref={skelRef}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          background: 'transparent',
          zIndex: 2,
        }}
      />

      {/* 네온 연기(투명 배경) */}
      <canvas
        ref={fxRef}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          background: 'transparent',
          zIndex: 3,
        }}
      />

      {/* ▽▽ 안내 UI: 손별로 최대 2개 표시 ▽▽ */}
      {prompts.map((p, idx) => p.visible && (
        <div
          key={idx}
          style={{
            position: 'fixed',
            left: `${p.x}px`,
            top: `${p.y}px`,
            transform: 'translate(-50%, -50%)',
            width: '140px',
            height: '140px',
            borderRadius: '999px',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(0,0,0,0.25)',
            boxShadow: `
              0 0 22px 8px rgba(255,61,246,0.18),
              0 0 60px 6px rgba(135,206,255,0.12)
            `,
            border: '2px solid rgba(255,255,255,0.6)',
            backdropFilter: 'blur(2px)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: '0.2px',
            textAlign: 'center',
            lineHeight: 1.2,
            userSelect: 'none',
            pointerEvents: 'none',
            zIndex: 6,
          }}
        >
          <div style={{opacity:.9}}>주먹을 쥐세요!</div>
          <div style={{ position:'absolute', inset:0, borderRadius:'999px', pointerEvents:'none' }}>
            <span style={{
              position:'absolute', inset:6, borderRadius:'999px',
              border:'2px dashed rgba(255,255,255,0.45)',
              animation:'ringSpin 3.2s linear infinite'
            }}/>
            <span style={{
              position:'absolute', inset:18, borderRadius:'999px',
              border:'2px solid rgba(255,61,246,0.45)',
              boxShadow:'0 0 18px 6px rgba(255,61,246,0.25)',
              animation:'ringPulse 1.8s ease-in-out infinite'
            }}/>
          </div>
          <style>
            {`
              @keyframes ringSpin { to { transform: rotate(360deg); } }
              @keyframes ringPulse {
                0%,100% { transform: scale(1); opacity: .9; }
                50%     { transform: scale(1.06); opacity: .65; }
              }
            `}
          </style>
        </div>
      ))}

      {!ready && !error && (
        <div style={{ position:'fixed', inset:0, display:'grid', placeItems:'center', color:'#888', fontSize:14, zIndex:5, pointerEvents:'none' }}>
          카메라 로딩 중…
        </div>
      )}
      {error && (
        <div style={{ position:'fixed', top:20, left:20, color:'#f66', background:'transparent', padding:'8px 12px', borderRadius:8, zIndex:6 }}>
          {error}
        </div>
      )}
    </>
  )
}

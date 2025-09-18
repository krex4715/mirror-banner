// src/App.tsx
import { useEffect, useRef, useState } from 'react'
import HandOverlay from './components/HandOverlay'
import FogFX from './components/FogFX'
import logoUrl from './assets/logo.svg'
import './index.css'

export default function App() {
  const [pos, setPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const [pinching, setPinching] = useState(false)
  const [hand, setHand] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })
  const imgRef = useRef<HTMLImageElement>(null)

  // 창 크기 바뀌면 현재 위치를 화면 안으로 보정
  useEffect(() => {
    const onResize = () => {
      setPos(p => ({
        x: Math.min(Math.max(0, p.x), window.innerWidth),
        y: Math.min(Math.max(0, p.y), window.innerHeight),
      }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 포인트가 이미지 내부인가?
  const isInsideImage = (x: number, y: number) => {
    const el = imgRef.current
    if (!el) return false
    const rect = el.getBoundingClientRect()
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  }

  // 화면 안으로 클램프
  const clampToViewport = (x: number, y: number) => ({
    x: Math.min(Math.max(0, x), window.innerWidth),
    y: Math.min(Math.max(0, y), window.innerHeight),
  })

  return (
    <main>
      {/* 배경 안개 효과 (가장 아래 z-index) */}
      <FogFX hand={hand} strength={pinching ? 1 : 0.4} opacity={0.33} />

      {/* 로고 */}
      <img
        ref={imgRef}
        src={logoUrl}
        alt="Logo"
        className="fade-in"
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          transform: 'translate(-50%, -50%)',
          width: 'min(40vw, 420px)',
          height: 'auto',
          zIndex: 1,
          filter: pinching
            ? 'saturate(1.8) hue-rotate(30deg) drop-shadow(0 0 16px rgba(255,255,255,0.35))'
            : 'none',
          transition: 'filter 120ms ease',
          pointerEvents: 'none',
        }}
      />

      {/* 핸드 오버레이 */}
      <HandOverlay
        onPinch={(phase, x, y) => {
          // phase: 'start' | 'move' | 'end'  /  x,y: 뷰포트 CSS 픽셀
          if (phase === 'start') {
            setPinching(true)
            if (isInsideImage(x, y)) {
              // 드래그 시작: 점프 방지를 위해 오프셋 고정
              dragOffsetRef.current = { dx: pos.x - x, dy: pos.y - y }
              setDragging(true)
            } else {
              setDragging(false)
            }
          } else if (phase === 'move') {
            if (dragging) {
              const { dx, dy } = dragOffsetRef.current
              const next = clampToViewport(x + dx, y + dy)
              setPos(next)
            }
          } else if (phase === 'end') {
            setPinching(false)
            setDragging(false)
          }
        }}
        onHandMove={(x, y) => setHand({ x, y })} // ★ 안개 셰이더용 손 좌표
        // pinchOn={0.045}
        // pinchOff={0.06}
      />
    </main>
  )
}

import { useEffect, useRef } from 'react'

type Props = {
  src?: string
  className?: string   // ✅ 전용 클래스 주입
}

export default function BackgroundVideo({ src = './media/bg_video_v3.mp4', className }: Props) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    v.volume = 0
    const tryPlay = () => v.play().catch(() => {})
    const autoUnmute = async () => {
      try {
        await tryPlay()
        setTimeout(async () => {
          v.muted = false
          const target = 1.0, step = 0.1
          const tick = () => {
            v.volume = Math.min(target, (v.volume ?? 0) + step)
            if (v.volume < target && !v.muted) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
          await v.play().catch(() => {})
        }, 150)
      } catch {}
    }
    const onGesture = () => {
      v.muted = false; v.volume = 1.0; v.play().catch(() => {})
      window.removeEventListener('pointerdown', onGesture, true)
      window.removeEventListener('keydown', onGesture, true)
    }
    const onCanPlay = () => { tryPlay().then(autoUnmute) }
    v.addEventListener('canplay', onCanPlay)
    window.addEventListener('pointerdown', onGesture, true)
    window.addEventListener('keydown', onGesture, true)
    const onVisibility = () => { if (!document.hidden) tryPlay() }
    document.addEventListener('visibilitychange', onVisibility)
    tryPlay().then(autoUnmute)
    return () => {
      v.removeEventListener('canplay', onCanPlay)
      window.removeEventListener('pointerdown', onGesture, true)
      window.removeEventListener('keydown', onGesture, true)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <video
      ref={ref}
      className={className}   // ✅ 전역 bg-video 안 씀
      src={src}
      autoPlay
      loop
      playsInline
      preload="auto"
    />
  )
}

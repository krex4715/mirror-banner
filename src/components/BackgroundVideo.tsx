import { useEffect, useRef } from 'react'

type Props = {
  src: string
}

export default function BackgroundVideo({ src }: Props) {
  const ref = useRef<HTMLVideoElement>(null)

  // 탭 전환/일시 정지 등 자동 복구
  useEffect(() => {
    const v = ref.current
    if (!v) return

    const tryPlay = () => v.play().catch(() => {})
    tryPlay()

    const onVisibility = () => {
      if (!document.hidden) tryPlay()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return (
    <video
      ref={ref}
      className="bg-video"
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      // poster="/some-poster.png"  // 필요하면 포스터 이미지 추가
    />
  )
}

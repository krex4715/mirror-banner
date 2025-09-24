import { useEffect, useMemo, useRef, useState } from 'react'
import { PRODUCTS, type ProductMeta } from '../data/products'

type Rect = { left:number; top:number; right:number; bottom:number; width:number; height:number }
type ActiveMap = Record<number, { meta: ProductMeta; lastSeen: number }>

/** ===== 유틸: 제품별 네온 테마 ===== */
function themeFor(id: number) {
  // id: 1 아쌉보이(보라), 2 파인애플(라임), 3 망고(옐로), 4 베리(핑크), 5 제로콜라(시안)
  const t = {
    1: { hue: 285, hex: '#C58CFF' },
    2: { hue: 95,  hex: '#9DFF57' },
    3: { hue: 42,  hex: '#FFD44D' },
    4: { hue: 330, hex: '#FF61D2' },
    5: { hue: 195, hex: '#61E4FF' },
  } as const
  return t[id as 1|2|3|4|5] ?? t[4]
}

/** ===== 그리드 셀 Rect 측정 (안정화) ===== */
function useGridRects() {
  const [rects, setRects] = useState<Rect[]>([])
  const lastRef = useRef<Rect[] | null>(null)
  const sameCountRef = useRef(0)
  const RAF = useRef<number | null>(null)
  const fallbackTimer = useRef<number | null>(null)

  const roughlySame = (a: Rect[], b: Rect[]) => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      const A = a[i], B = b[i]
      const wDelta = Math.abs(A.width - B.width) / (B.width || 1)
      const hDelta = Math.abs(A.height - B.height) / (B.height || 1)
      const lDelta = Math.abs(A.left - B.left)
      const tDelta = Math.abs(A.top - B.top)
      if (wDelta > 0.03 || hDelta > 0.03 || lDelta > 2 || tDelta > 2) return false // 🔧 살짝 관대하게
    }
    return true
  }

  useEffect(() => {
    const read = () => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.grid5-fixed .cell'))
      return nodes.map(el => {
        const r = el.getBoundingClientRect()
        return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height }
      })
    }

    const schedule = () => {
      if (RAF.current) cancelAnimationFrame(RAF.current)
      RAF.current = requestAnimationFrame(() => {
        const nowRects = read()
        const last = lastRef.current

        // ✅ 최초 한 번은 바로 확정 (패키징 환경 rAF/RO 타이밍 이슈 회피)
        if (!last || last.length === 0) {
          lastRef.current = nowRects
          setRects(nowRects)
          sameCountRef.current = 0
          return
        }

        if (roughlySame(nowRects, last)) sameCountRef.current += 1
        else sameCountRef.current = 0

        lastRef.current = nowRects
        if (sameCountRef.current >= 2) setRects(nowRects)
      })
    }

    // 처음 측정 + 폴백 타이머
    schedule()

    // ✅ 500ms 지났는데도 rects가 비어있으면 “그냥 지금 값”으로 확정
    fallbackTimer.current = window.setTimeout(() => {
      if (!lastRef.current || lastRef.current.length === 0) {
        const nowRects = (document.readyState === 'complete') ? read() : []
        if (nowRects.length > 0) {
          lastRef.current = nowRects
          setRects(nowRects)
        }
      }
    }, 500) as unknown as number

    // 업데이트 트리거
    const ro = new ResizeObserver(() => schedule())
    const root = document.querySelector('.grid5-fixed') as HTMLElement | null
    if (root) ro.observe(root)
    window.addEventListener('resize', schedule)
    window.addEventListener('load', schedule)

    return () => {
      if (RAF.current) cancelAnimationFrame(RAF.current)
      ro.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('load', schedule)
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current)
    }
  }, [])

  return rects
}


/** ===== 네온 게이지(4칸) ===== */
function NeonGauge({
  value, label, barH = 28, gap = 10, radius = 10, thickness = 2, color = '#FF61D2'
}: {
  value: 0|1|2|3|4,
  label: string,
  barH?: number,
  gap?: number,
  radius?: number,
  thickness?: number,
  color?: string
}) {
  return (
    <div style={{ display:'grid', gap }}>
      <div style={{ fontSize: 22, fontWeight: 750, letterSpacing:.2, opacity:.98 }}>{label}</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap }}>
        {Array.from({length:4}).map((_,i) => {
          const active = i < value
          return (
            <span
              key={i}
              style={{
                height: barH,
                borderRadius: radius,
                border: `${thickness}px solid ${active ? color : 'rgba(255,255,255,.35)'}`,
                background: active
                  ? `linear-gradient(180deg, rgba(255,255,255,.98), ${color})`
                  : 'rgba(255,255,255,.1)',
                boxShadow: active
                  ? `0 0 10px ${color}, 0 0 28px ${color}99, inset 0 0 10px ${color}AA`
                  : 'inset 0 0 6px rgba(255,255,255,.12)',
                transition:'filter .15s ease, box-shadow .15s ease',
                filter: active ? 'saturate(1.2)' : 'none'
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

/** ===== 카드 컴포넌트 ===== */
function ProductCard({ rect, meta }: { rect: Rect, meta: ProductMeta }) {
  const theme = themeFor(meta.id)

  // 절대 픽셀 스케일 (현재보다 정확히 2배 시도, 셀 한계로 클램프)
  const BASE = 640
  const pad = Math.min(rect.width, rect.height) * 0.05
  const avail = Math.min(rect.width, rect.height) - pad * 2
  const scaleRaw = avail / BASE
  const scale = Math.max(0.6, Math.min(2.6, scaleRaw * 2))

  // 치수/폰트/패딩
  const W = Math.round(BASE * scale)
  const H = Math.round(BASE * scale)
  const radius = Math.round(26 * scale)
  const padX = Math.round(22 * scale)
  const padY = Math.round(18 * scale)
  const nameFs = Math.round(48 * scale)   // 타이틀 더 큼
  const descFs = Math.round(25 * scale)

  // 중앙 배치
  const left = Math.round(rect.left + (rect.width - W) / 2)
  const top  = Math.round(rect.top  + (rect.height - H) / 2)

  // 첫 페인트 제어
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // 네온 보더 레이어 2겹(blur 없이 glow)
  const borderPad = Math.max(2, Math.round(2 * scale))

  return (
    <div
      style={{
        position: 'fixed',
        left, top,
        width: W, height: H,
        zIndex: 7,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity .12s ease-out',
        contain: 'layout paint size',
        willChange: 'opacity',
      }}
      aria-hidden
    >
      {/* 외곽 네온 링(그라데이션) */}
      <div
        style={{
          position:'absolute', inset:0,
          borderRadius: radius + borderPad,
          padding: borderPad,
          background: `linear-gradient(135deg,
            ${theme.hex} 0%,
            rgba(255,255,255,.35) 35%,
            ${theme.hex} 70%,
            rgba(255,255,255,.2) 100%)`,
          boxShadow: `
            0 0 ${Math.round(24*scale)}px ${theme.hex}66,
            0 0 ${Math.round(64*scale)}px ${theme.hex}33
          `
        }}
      >
        {/* 실제 카드 바디 */}
        <div
          className="product-info-card"
          style={{
            position: 'relative',
            width:'100%', height:'100%',
            borderRadius: radius,
            overflow: 'hidden',
            // 유리 느낌(블러 없이): 레이어 믹스 + 그라데이션
            background: 'linear-gradient(180deg, rgba(8,8,12,.72), rgba(8,8,12,.66))',
            border: '1px solid rgba(255,255,255,.18)',
            boxShadow: `
              inset 0 0 0 1px rgba(255,255,255,.06),
              0 10px 30px rgba(0,0,0,.55)
            `,
            fontFamily: 'var(--ui-font-body, Pretendard, Inter, "Segoe UI", system-ui, -apple-system)',
            isolation: 'isolate',
          }}
        >
          {/* 스캔라인/노이즈 살짝 */}
          <div style={{
            position:'absolute', inset:0, pointerEvents:'none',
            background: `repeating-linear-gradient(
              0deg, rgba(255,255,255,.04), rgba(255,255,255,.04) 2px,
              transparent 2px, transparent 4px
            )`,
            mixBlendMode:'overlay',
            opacity:.35
          }}/>

          {/* 상단 썸네일 */}
          <div style={{ position:'relative', height: Math.round(H * 0.64), background:'#08080c' }}>
            <img
              src={meta.img}
              alt=""
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
              decoding="async"
            />
            {/* 상단 네온 림라이트 */}
            <div style={{
              position:'absolute', inset:0,
              background:`linear-gradient(180deg, rgba(${theme.hue}, 100%, 70%, 0) 45%, rgba(0,0,0,.55) 100%)`
            }}/>
            {/* 제품명 */}
            <div style={{
            position:'absolute',
            left: '50%',                         // ✅ 가운데 기준
            transform: 'translateX(-50%)',       // ✅ 정확히 중앙 정렬
            bottom: Math.round(10 * scale),
            width: `calc(100% - ${padX*2}px)`,   // 좌우 여백 유지
            textAlign: 'center',                 // ✅ 텍스트 가운데
            fontFamily: 'var(--ui-font-title, "Rajdhani", "Orbitron", system-ui)',
            fontWeight: 800, letterSpacing: .4, lineHeight: 1,
            fontSize: nameFs,
            color: '#fff',
            textShadow: `
                0 0 ${Math.round(8*scale)}px ${theme.hex},
                0 0 ${Math.round(18*scale)}px ${theme.hex}AA,
                0 2px ${Math.round(20*scale)}px rgba(0,0,0,.65)
            `,
            filter: 'saturate(1.15)',

            }}>
            {meta.name}
            </div>
          </div>

          {/* 하단 설명 + 게이지 */}
          <div style={{
            position:'absolute',
            left: padX, right: padX,
            top: Math.round(H * 0.64) + padY,
            bottom: padY,
            display:'grid',
            gridTemplateRows:'auto 1fr',
            gap: Math.round(16 * scale),
            whiteSpace: 'pre-line',
            textAlign:'center',        // ✅ 중앙 정렬
          }}>
            <div style={{
              fontSize: descFs, lineHeight: 1.32, color:'#EDEDED',
              textShadow: '0 1px 0 rgba(0,0,0,.45)'
            }}>
              {meta.description}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: Math.round(22 * scale), alignItems:'end' }}>
              <NeonGauge value={meta.sweet} label="당도"
                barH={Math.round(30*scale)} gap={Math.round(12*scale)}
                radius={Math.round(12*scale)} thickness={Math.max(2, Math.round(2*scale))}
                color={theme.hex}
              />
              <NeonGauge value={meta.cool} label="쿨링"
                barH={Math.round(30*scale)} gap={Math.round(12*scale)}
                radius={Math.round(12*scale)} thickness={Math.max(2, Math.round(2*scale))}
                color={theme.hex}
              />
              <NeonGauge value={meta.hit} label="타격감"
                barH={Math.round(30*scale)} gap={Math.round(12*scale)}
                radius={Math.round(12*scale)} thickness={Math.max(2, Math.round(2*scale))}
                color={theme.hex}
              />
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes pfade {
            from { transform: translateY(10px); opacity: 0 }
            to   { transform: translateY(0);   opacity: 1 }
          }
        `}
      </style>
    </div>
  )
}

export default function ProductInfoOverlay() {
  const rects = useGridRects()
  const metas = useMemo(() => PRODUCTS, [])

  const [actives, setActives] = useState<ActiveMap>({})
  const pruneTimer = useRef<number | null>(null)
  const PRUNE_MS = 1000

  useEffect(() => {
    pruneTimer.current = window.setInterval(() => {
      setActives(prev => {
        const now = performance.now()
        const next: ActiveMap = {}
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.lastSeen < PRUNE_MS) next[Number(k)] = v
        }
        return next
      })
    }, 120) as unknown as number
    return () => { if (pruneTimer.current) clearInterval(pruneTimer.current) }
  }, [])

  useEffect(() => {
    const onPoint = (e: Event) => {
      const { x, y, fist } = (e as CustomEvent).detail as { x:number; y:number; fist:boolean }
      if (!fist || rects.length < 5) return
      const idx = rects.findIndex(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
      if (idx >= 0) {
        setActives(prev => ({
          ...prev,
          [idx]: { meta: metas[idx], lastSeen: performance.now() }
        }))
      }
    }
    window.addEventListener('smokePoint', onPoint as any)
    return () => window.removeEventListener('smokePoint', onPoint as any)
  }, [rects, metas])

  return (
    <>
      {Object.keys(actives).map(k => {
        const idx = Number(k)
        const r = rects[idx]
        if (!r) return null
        return <ProductCard key={idx} rect={r} meta={actives[idx].meta} />
      })}
    </>
  )
}

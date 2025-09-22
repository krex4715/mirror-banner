// 네온 튜브 스타일 스켈레톤 렌더러
import type { Hand } from '../utils/geom'

const PAIRS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
]

/**
 * 네온 튜브 스켈레톤 (항상 보임, intensity로 밝기/굵기 조절)
 * - fistOn: 주먹 여부 (색상 전환)
 * - intensity: 0.0~1.0 (밝기/굵기/글로우 강도). 최소 0.25 보장.
 */
export function drawNeonSkeleton(
  ctx: CanvasRenderingContext2D,
  hand: Hand,
  opts: { vW:number; vH:number; width:number; fistOn:boolean; intensity:number }
){
  const { vW, vH, width, fistOn } = opts
  const t = Math.max(0.25, Math.min(1, opts.intensity)) // 최소 가시성 확보

  // 색상: 주먹이면 핑크, 아니면 청록
  const hue = fistOn ? 305 : 190
  const core  = `hsla(${hue},100%,85%,${0.90*t})`
  const inner = `hsla(${hue},100%,70%,${0.75*t})`
  const glow  = `hsla(${hue},100%,60%,${0.45*t})`

  // 굵기 스케일: 너무 얇아지지 않게 바닥값
  const base = Math.max(0.5, width * (0.55 + 0.8*t))

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // 바깥 글로우
  ctx.shadowColor = glow
  ctx.shadowBlur  = base * 6
  ctx.strokeStyle = glow
  ctx.lineWidth   = base * 1.6
  for (const [a, b] of PAIRS){
    const A = hand[a], B = hand[b]
    ctx.beginPath(); ctx.moveTo(A.x*vW, A.y*vH); ctx.lineTo(B.x*vW, B.y*vH); ctx.stroke()
  }

  // 내부 채광
  ctx.shadowBlur  = base * 2.5
  ctx.strokeStyle = inner
  ctx.lineWidth   = base * 1.1
  for (const [a, b] of PAIRS){
    const A = hand[a], B = hand[b]
    ctx.beginPath(); ctx.moveTo(A.x*vW, A.y*vH); ctx.lineTo(B.x*vW, B.y*vH); ctx.stroke()
  }

  // 중앙 코어
  ctx.shadowBlur  = 0
  ctx.strokeStyle = core
  ctx.lineWidth   = Math.max(0.45, base * 0.55)
  for (const [a, b] of PAIRS){
    const A = hand[a], B = hand[b]
    ctx.beginPath(); ctx.moveTo(A.x*vW, A.y*vH); ctx.lineTo(B.x*vW, B.y*vH); ctx.stroke()
  }

  // 관절 도트
  const dotOuter = `hsla(${hue},100%,70%,${0.55*t})`
  const dotCore  = `hsla(${hue},100%,90%,${0.90*t})`
  for (const p of hand){
    const x = p.x*vW, y = p.y*vH
    ctx.shadowColor = dotOuter
    ctx.shadowBlur  = base * 3
    ctx.fillStyle   = dotOuter; ctx.beginPath(); ctx.arc(x,y, base*1.25, 0, Math.PI*2); ctx.fill()
    ctx.shadowBlur  = base * 1.2
    ctx.fillStyle   = dotCore;  ctx.beginPath(); ctx.arc(x,y, Math.max(0.35, base*0.7), 0, Math.PI*2); ctx.fill()
  }

  ctx.restore()
}

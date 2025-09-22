// 거리/각도/캔버스 헬퍼
export type LM = { x:number; y:number; z:number }
export type Hand = LM[] // len 21

export function dist(a: LM, b: LM){
  const dx=a.x-b.x, dy=a.y-b.y, dz=a.z-b.z
  return Math.hypot(dx,dy,dz)
}

export function angleAt(pivot: LM, a: LM, b: LM){
  const v1 = { x:a.x-pivot.x, y:a.y-pivot.y, z:a.z-pivot.z }
  const v2 = { x:b.x-pivot.x, y:b.y-pivot.y, z:b.z-pivot.z }
  const dot = v1.x*v2.x + v1.y*v2.y + v1.z*v2.z
  const n1 = Math.hypot(v1.x, v1.y, v1.z) || 1
  const n2 = Math.hypot(v2.x, v2.y, v2.z) || 1
  const c = Math.max(-1, Math.min(1, dot/(n1*n2)))
  return Math.acos(c) * 180 / Math.PI
}

export function centroid(hand: Hand, vW:number, vH:number){
  let sx=0, sy=0
  for(const p of hand){ sx += p.x*vW; sy += p.y*vH }
  return { x:sx/hand.length, y:sy/hand.length }
}

export function computeCover(srcW:number, srcH:number, dstW:number, dstH:number){
  const scale = Math.max(dstW/srcW, dstH/srcH)
  const drawW = srcW*scale, drawH = srcH*scale
  const offX = (dstW-drawW)/2, offY = (dstH-drawH)/2
  return { scale, offX, offY }
}

// 캔버스 표시 크기 × DPR로 맞추기 + rough 초기화는 외부에서
export function resizeCanvasToDisplay(canvas: HTMLCanvasElement){
  const dpr = window.devicePixelRatio || 1
  const cssW = canvas.clientWidth || window.innerWidth
  const cssH = canvas.clientHeight || window.innerHeight
  const needW = Math.round(cssW*dpr), needH = Math.round(cssH*dpr)
  if (canvas.width !== needW) canvas.width = needW
  if (canvas.height !== needH) canvas.height = needH
}

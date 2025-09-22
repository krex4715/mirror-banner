import rough from 'roughjs/bundled/rough.esm.js'
import type { Hand } from '../utils/geom'

const PAIRS: [number,number][]= [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
]

export type StyleParams = {
  fixedLine:number
  fixedR:number
  fistOn:boolean
  ctx: CanvasRenderingContext2D
  vW:number; vH:number
}

export function getRough(canvas: HTMLCanvasElement){
  return rough.canvas(canvas)
}

export function drawSkeleton(rc: ReturnType<typeof rough.canvas>, hand: Hand, p: StyleParams){
  const { fixedLine, fixedR, fistOn, ctx, vW, vH } = p

  const stroke = fistOn ? '#ff3df6' : '#cfe6ff'
  const pointFill = fistOn ? '#ffb3fe' : '#ffffff'
  const strokeWidth = fixedLine * (fistOn?2.0:1.0)
  const roughness = fistOn?0.8:1.2
  const bowing = fistOn?0.6:1.1

  if (fistOn){
    ctx.save()
    const dpr = window.devicePixelRatio || 1
    ctx.shadowColor = 'rgba(255,61,246,0.85)'
    ctx.shadowBlur  = (8*dpr)
  }

  // 선
  for (const [a,b] of PAIRS){
    const A = hand[a], B = hand[b]
    rc.line(A.x*vW, A.y*vH, B.x*vW, B.y*vH, {
      stroke, strokeWidth, roughness, bowing
    })
  }

  // 점
  for (const pt of hand){
    rc.circle(pt.x*vW, pt.y*vH, fixedR*2.2, {
      fill: pointFill, stroke: 'transparent', fillStyle: 'solid'
    })
  }

  if (fistOn) ctx.restore()
}

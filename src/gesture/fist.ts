import type { Hand } from '../utils/geom'
import { dist, angleAt } from '../utils/geom'

const F = {
  thumb:  [2,3,4],
  index:  [5,6,8],
  middle: [9,10,12],
  ring:   [13,14,16],
  pinky:  [17,18,20],
} as const

export function isFist(hand: Hand){
  const wrist = hand[0]
  const palm = dist(wrist, hand[9]) || 1e-6
  const nz = (v:number)=> v/palm

  let folded = 0
  ;(['index','middle','ring','pinky'] as const).forEach(name=>{
    const [mcp,pip,tip] = F[name]
    const dTipW = nz(dist(hand[tip], wrist))
    const dPipW = nz(dist(hand[pip], wrist))
    const dTipM = nz(dist(hand[tip], hand[mcp]))
    const ang = angleAt(hand[pip], hand[tip], hand[mcp])
    if ((dTipW<dPipW) || (dTipM<0.45) || (ang<55)) folded++
  })
  const thumbFolded = (dist(hand[4], hand[2]) / palm) < 0.55
  if (thumbFolded) folded++
  return folded >= 4
}

// 간단 EMA + 히스테리시스
export function updateFistState(prevOn:boolean, prevEma:number, raw:boolean){
  const ema = prevEma*(1-0.4) + (raw?1:0)*0.4
  const onTh = 0.65, offTh = 0.35
  let on = prevOn
  if (!prevOn && ema>=onTh) on = true
  if ( prevOn && ema<=offTh) on = false
  const edgeOn = !prevOn && on
  return { ema, on, edgeOn }
}

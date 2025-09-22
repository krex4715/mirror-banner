import { createNoise3D } from 'simplex-noise'

type Puff = { x:number; y:number; r:number; life:number; maxLife:number; hue:number; seed:number }

export class NeonSmoke {
  private puffs: Puff[] = []
  private noise3d = createNoise3D()
  private lastT = performance.now()
  private running = true
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    // 픽셀 크기는 외부(HandOverlay)에서 setPixelSize로 동기화
  }

  /** skeleton 캔버스와 '내부 픽셀 크기'를 1:1로 맞춤 */
  setPixelSize(widthPx: number, heightPx: number) {
    if (this.canvas.width !== widthPx)  this.canvas.width  = widthPx
    if (this.canvas.height !== heightPx) this.canvas.height = heightPx
  }

  stop(){ this.running = false }

  /** 디바이스 픽셀 좌표 기준 입력 */
  burst(x:number, y:number, options?:{ hue?:number; count?:number }){
    const count = options?.count ?? 18
    const hue = options?.hue ?? 208
    for (let i=0;i<count;i++){
      const r = 10 + Math.random()*18
      const life = 900 + Math.random()*700
      this.puffs.push({ x, y, r, life, maxLife: life, hue, seed: Math.random()*1000 })
    }
  }

  /** 주먹 유지 중 은은히 */
  simmer(x:number, y:number, options?:{ hue?:number; density?:number }){
    const density = options?.density ?? 0.25
    if (Math.random() < density){
      this.burst(x + (Math.random()-0.5)*6, y + (Math.random()-0.5)*6, {
        hue: options?.hue, count: 1,
      })
    }
  }

  tick(){
    if (!this.running) return
    const now = performance.now()
    const dt  = now - this.lastT
    this.lastT = now

    const ctx = this.canvas.getContext('2d')!
    const w = this.canvas.width
    const h = this.canvas.height

    // 투명 페이드(알파만 지움)
    ctx.setTransform(1,0,0,1,0,0)
    ctx.globalCompositeOperation = 'destination-out'
    const fade = Math.min(0.12, dt * 0.00035)
    ctx.fillStyle = `rgba(0,0,0,${fade})`
    ctx.fillRect(0,0,w,h)

    // 연기 합성
    ctx.globalCompositeOperation = 'screen'

    const gravity = -0.02  // 위로 떠오르는 속도 (더 마이너스 → 더 빨리 위로)
    const spread  = 0.1   // 좌우(방향) 퍼짐 강도 (↑ 하면 더 퍼짐)
    const curlAmt = 0.45   // 노이즈 곡률 (↑ 하면 더 굽이치며 퍼짐)

    const next:Puff[] = []
    for (const p of this.puffs){
      const age = 1 - p.life/p.maxLife
      const n = this.noise3d(p.x*0.002, p.y*0.002, p.seed)
      const ang = n * Math.PI * curlAmt
      const vx = Math.cos(ang) * spread * dt
      const vy = (Math.sin(ang) * spread + gravity) * dt

      // 디바이스 픽셀 공간 → DPR 곱 불필요
      p.x += vx
      p.y += vy
      p.r *= 1 + 0.0006 * dt
      p.life -= dt

      if (p.life > 0 && p.x > -50 && p.x < w+50 && p.y > -50 && p.y < h+50){
        next.push(p)

        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
        const alpha = Math.max(0, 0.65 - age)
        grd.addColorStop(0,    `hsla(${p.hue},100%,70%,${alpha})`)
        grd.addColorStop(0.35, `hsla(${p.hue},100%,60%,${alpha*0.35})`)
        grd.addColorStop(1,    `hsla(${p.hue},100%,50%,0)`)

        ctx.beginPath()
        ctx.fillStyle = grd
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2)
        ctx.fill()
      }
    }
    this.puffs = next
  }
}

// src/components/FogFX.tsx
import { useEffect, useRef } from 'react'

type Props = {
  hand?: { x: number; y: number } | null
  strength?: number // 0~1
  opacity?: number  // 0~1 (배경 안개 투명도)
}

const vert = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`

// 간단한 fbm + 손 근처 왜곡
const frag = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_hand;      // px
uniform float u_strength; // 0~1
uniform float u_opacity;  // 0~1

// hash & noise
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}

float fbm(vec2 p){
  float v=0.0; float a=0.5;
  for (int i=0;i<5;i++){
    v += a*noise(p);
    p *= 2.0; a *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;       // 0..1
  vec2 p  = uv * 3.0;                      // 스케일
  float t = u_time * 0.06;

  // 기본 흐름 (천천히 흘러가는 안개)
  vec2 flow = vec2(t*0.6, -t*0.4);
  float base = fbm(p + flow);

  // 손의 영향: 손 주위에서 노이즈 좌표를 휘어줌
  vec2 handUV = u_hand / u_res;           // px -> 0..1
  float r = distance(uv, handUV);

  // 손 주변 거리 기반 falloff
  float influence = smoothstep(0.45, 0.0, r) * u_strength; // 손 가까울수록 1

  // 소용돌이 느낌의 좌표 왜곡
  vec2 dir = normalize(uv - handUV + 1e-5);
  vec2 swirl = vec2(-dir.y, dir.x); // 90도 회전
  vec2 warp = swirl * influence * 0.25;

  float f = fbm(p + flow + warp);

  // 레벨 조정 + 안개층 알파
  float fog = smoothstep(0.2, 0.9, f);   // 콘트라스트
  float alpha = u_opacity * (0.55 + 0.45*fog); // 살짝 숨쉬듯 변화

  // 흑배경 위 연무색 (회백톤)
  vec3 col = mix(vec3(0.05), vec3(0.9), fog*0.8);
  outColor = vec4(col, alpha);
}`

export default function FogFX({ hand, strength = 0.5, opacity = 0.35 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const handRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const filtRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 }) // 저역통과(부드럽게)

  useEffect(() => {
    if (!ref.current) return
    const canvas = ref.current
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true })
    if (!gl) { console.warn('WebGL2 not supported'); return }

    // 캔버스 리사이즈
    const fit = () => {
      const w = (canvas.clientWidth || window.innerWidth)
      const h = (canvas.clientHeight || window.innerHeight)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }
    fit()
    const onResize = () => fit()
    window.addEventListener('resize', onResize)

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader err')
      return s
    }
    const link = (vs: WebGLShader, fs: WebGLShader) => {
      const p = gl.createProgram()!
      gl.attachShader(p, vs); gl.attachShader(p, fs)
      gl.linkProgram(p)
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link err')
      return p
    }

    const vs = compile(gl.VERTEX_SHADER, vert)
    const fs = compile(gl.FRAGMENT_SHADER, frag)
    const prog = link(vs, fs)
    gl.useProgram(prog)

    // 풀스크린 삼각형
    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,   3, -1,   -1, 3
    ]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    // uniforms
    const uRes = gl.getUniformLocation(prog, 'u_res')
    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uHand = gl.getUniformLocation(prog, 'u_hand')
    const uStr  = gl.getUniformLocation(prog, 'u_strength')
    const uOp   = gl.getUniformLocation(prog, 'u_opacity')

    let t0 = performance.now()
    let raf = 0

    // 렌더 루프
    const draw = () => {
      fit()
      const t = (performance.now() - t0) / 1000
      const w = canvas.width, h = canvas.height

      // 손 포지션 부드럽게(LPF)
      const target = handRef.current
      const filt = filtRef.current
      const k = 0.22 // 스무딩 계수(0~1)
      filt.x += (target.x - filt.x) * k
      filt.y += (target.y - filt.y) * k

      gl.useProgram(prog)
      gl.uniform2f(uRes, w, h)
      gl.uniform1f(uTime, t)
      gl.uniform2f(uHand, filt.x, filt.y)
      gl.uniform1f(uStr, Math.max(0, Math.min(1, strength)))
      gl.uniform1f(uOp, Math.max(0, Math.min(1, opacity)))

      gl.drawArrays(gl.TRIANGLES, 0, 3)
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      gl.deleteProgram(prog)
      gl.deleteShader(vs); gl.deleteShader(fs)
      gl.deleteBuffer(buf)
    }
  }, [strength, opacity])

  // 외부에서 최신 손좌표 주입
  useEffect(() => {
    if (hand) handRef.current = hand
  }, [hand])

  return (
    <canvas
      ref={ref}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,           // 로고/오버레이 뒤쪽
      }}
    />
  )
}

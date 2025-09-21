import PromoStage from './components/PromoStage'
import HandOverlay from './components/HandOverlay'
import TempoTicker from './components/TempoTicker'
import './index.css'

export default function App() {
  return (
    <main className="fullscreen-center">
      <img className="top-logo" src="./brand/asdf_logo_upper.png" alt="ASDF — ALL STARTS DIFFERENT" />

      {/* ✅ 배경영상 바로 위에 깔릴 풀폭 배경 이미지 */}
      <div className="tempo-bg" aria-hidden>
        <img src="./tempo_background.png" alt="" />
      </div>

      {/* 제품 5칸 그리드 (이미 만들어둔 고정 요소) */}
      <div className="grid5-fixed">
        <div className="cell"><video src="./product/1.mp4" autoPlay muted loop playsInline /></div>
        <div className="cell"><video src="./product/2.mp4" autoPlay muted loop playsInline /></div>
        <div className="cell"><video src="./product/3.mp4" autoPlay muted loop playsInline /></div>
        <div className="cell"><video src="./product/4.mp4" autoPlay muted loop playsInline /></div>
        <div className="cell"><video src="./product/5.mp4" autoPlay muted loop playsInline /></div>
      </div>

      <PromoStage />
      <HandOverlay />
      <TempoTicker />
    </main>
  )
}


import PromoStage from './components/PromoStage'
import HandOverlay from './components/HandOverlay'
import TempoTicker from './components/TempoTicker'
import ProductInfoOverlay from './components/ProductInfoOverlay'
import PoweredByNeon from './components/PoweredByNeon'
import './index.css'

export default function App() {
  return (
    <main className="fullscreen-center">
      <img className="top-logo" src="./brand/asdf_logo_upper.png" alt="ASDF — ALL STARTS DIFFERENT" />

      {/* ✅ 배경영상 바로 위에 깔릴 풀폭 배경 이미지 */}
      <div className="tempo-bg" aria-hidden>
        <img src="./tempo_background.png" alt="" />
      </div>

      {/* 제품 5칸 그리드 */}
      <div className="grid5-fixed">

        {/* 1~5번: 기존 mp4들 */}
        <div className="cell"><video src="./product/1.mp4" autoPlay muted loop playsInline /></div>
        <div className="cell"><video src="./product/2.mp4" autoPlay muted loop playsInline /></div>
        <div className="cell"><video src="./product/3.mp4" autoPlay muted loop playsInline /></div>
        <div className="cell"><video src="./product/4.mp4" autoPlay muted loop playsInline /></div>
        <div className="cell"><video src="./product/5.mp4" autoPlay muted loop playsInline /></div>
      </div>


      {/* ✅ 연기 커서가 셀과 교차하면 여기에 정보 카드가 뜬다(티커 위 레이어) */}
      <ProductInfoOverlay />

      <PromoStage />
      <HandOverlay />
      <TempoTicker />
      <PoweredByNeon />
    </main>
  )
}

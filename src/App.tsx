import BackgroundVideo from './components/BackgroundVideo'
import ProductWall from './components/ProductWall'
import HandOverlay from './components/HandOverlay'
import './index.css'

export default function App() {
  return (
    <main className="fullscreen-center">
      {/* 상단 중앙 로고 */}
      <img
        className="top-logo"
        src="./brand/asdf_logo_upper.png"
        alt="ASDF — ALL STARTS DIFFERENT"
      />

      {/* 전체화면 배경 비디오 */}
      <BackgroundVideo src="./media/bg_video_v1.mp4" />

      {/* 제품 쇼케이스 (정사각 미리보기 + 2×3 그리드) */}
      <ProductWall />

      {/* 손 랜드마크 오버레이 */}
      <HandOverlay />
    </main>
  )
}

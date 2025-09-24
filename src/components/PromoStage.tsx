import BackgroundVideo from './BackgroundVideo'

export default function PromoStage() {
  return (
    <section className="promo-stage">
      <div className="stage-frame">
        {/* ✅ 전용 클래스 사용 */}
        <BackgroundVideo src="./media/bg_video_v4.mp4" className="stage-video" />
      </div>
    </section>
  )
}

export default function TempoTicker() {
  const imgs = [
    './tempo_slide/1.png',
    './tempo_slide/2.png',
    './tempo_slide/3.png',
    './tempo_slide/4.png',
    './tempo_slide/5.png',
  ]
  return (
    <div className="tempo-wrap">
      <div className="qr-stack">
        <img className="qr-raw" src="./tempo_slide/QRCode.png" alt="QR Code" />
      </div>

      {/* 슬라이드 */}
      <div className="tempo-ticker">
        <div className="tempo-track">
          {imgs.concat(imgs).map((src, i) => (
            <div className="tempo-item" key={i}>
              <img src={src} alt={`tempo-${(i % imgs.length) + 1}`} />
            </div>
          ))}
        </div>
      </div>

      {/* ✅ 티커 슬라이드 ‘바로 왼쪽 위’ 네온 라벨 */}
      <div className="powered-by">
        <span className="pb-prefix">powered by</span>
        <span className="pb-brand">ADAM&nbsp;AI</span>
      </div>
    </div>
  )
}

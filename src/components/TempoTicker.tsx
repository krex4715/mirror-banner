const IMGS = [
  './tempo_slide/1.png',
  './tempo_slide/2.png',
  './tempo_slide/3.png',
  './tempo_slide/4.png',
  './tempo_slide/5.png',
]

export default function TempoTicker() {
  const loop = [...IMGS, ...IMGS]
  return (
    <div className="tempo-wrap" aria-hidden>
      <div className="tempo-ticker">
        <div className="tempo-track">
          {loop.map((src, i) => (
            <div className="tempo-item" key={i}>
              <img src={src} alt="" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

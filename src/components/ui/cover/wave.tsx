export default function WaveSvg() {
  return (
    <>
      {/* Translucent swell behind the opaque crest; it rises first when the cover scrolls away. */}
      <div className="wave-swell" aria-hidden="true">
        <svg
          className="swell-crest"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 24 150 28"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <use xlinkHref="#gentle-wave" x="50" y="2" />
        </svg>
        <div className="swell-body" />
      </div>
      <div className="wave-wrap">
        <svg
          className="wave"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 24 150 28"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <path
              id="gentle-wave"
              d="m -160,44.4 c 30,0 58,-18 87.7,-18 30.3,0 58.3,18 87.3,18 30,0 58,-18 88,-18 30,0 58,18 88,18 l 0,34.5 -351,0 z"
            />
          </defs>
          <g className="parallax">
            <use xlinkHref="#gentle-wave" x="50" y="0" fill="rgba(255, 255, 255, 0.48)" />
            <use xlinkHref="#gentle-wave" x="50" y="3" fill="rgba(255, 255, 255, 0.78)" />
            <use xlinkHref="#gentle-wave" x="50" y="6" fill="rgba(255, 255, 255, 0.8)" />
          </g>
        </svg>
        {/* Solid water below the crests; it rises into view as the cover scrolls away. */}
        <div className="wave-sea" aria-hidden="true" />
      </div>
    </>
  );
}

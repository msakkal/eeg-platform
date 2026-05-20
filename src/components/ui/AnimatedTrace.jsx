export default function AnimatedTrace() {
  return (
    <svg
      className="absolute bottom-0 left-0 w-full opacity-20"
      height="80"
      viewBox="0 0 1200 80"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points="0,40 60,40 80,10 100,70 120,40 200,40 220,20 240,60 260,40 340,40 360,5 380,75 400,40 500,40 520,25 540,55 560,40 640,40 660,15 680,65 700,40 800,40 820,30 840,50 860,40 1000,40 1020,20 1040,60 1060,40 1200,40"
        fill="none"
        stroke="#00FFB0"
        strokeWidth="2"
        style={{
          strokeDasharray: 2000,
          strokeDashoffset: 2000,
          animation: 'trace 4s linear infinite',
        }}
      />
    </svg>
  )
}

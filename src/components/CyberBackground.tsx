export function CyberBackground() {
  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none bg-[#030712]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 cyber-grid-bg opacity-90" />
      <div className="absolute inset-0 cyber-grid-fine opacity-60" />

      <div
        className="absolute -top-40 right-1/4 w-[560px] h-[560px] rounded-full opacity-25 blur-[120px]"
        style={{
          background:
            'radial-gradient(circle, rgba(0, 180, 255, 0.55) 0%, rgba(3, 7, 18, 0) 70%)',
        }}
      />

      <div
        className="absolute bottom-0 left-1/4 w-[480px] h-[480px] rounded-full opacity-20 blur-[120px]"
        style={{
          background:
            'radial-gradient(circle, rgba(37, 99, 235, 0.45) 0%, rgba(3, 7, 18, 0) 70%)',
        }}
      />

      <svg
        className="absolute top-20 left-8 w-64 h-64 text-sky-400/10 hidden lg:block"
        viewBox="0 0 200 200"
        fill="none"
      >
        <polygon
          points="100,10 185,55 185,145 100,190 15,145 15,55"
          stroke="currentColor"
          strokeWidth="1"
        />
        <polygon
          points="100,32 165,67 165,133 100,168 35,133 35,67"
          stroke="currentColor"
          strokeWidth="0.75"
        />
        <line x1="100" y1="10" x2="100" y2="190" stroke="currentColor" strokeWidth="0.6" />
        <line x1="15" y1="55" x2="185" y2="145" stroke="currentColor" strokeWidth="0.6" />
        <line x1="185" y1="55" x2="15" y2="145" stroke="currentColor" strokeWidth="0.6" />
      </svg>
    </div>
  );
}

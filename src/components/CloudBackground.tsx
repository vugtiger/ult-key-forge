const CloudBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.03]">
    {/* Repeating cloud pattern */}
    {Array.from({ length: 12 }).map((_, i) => {
      const row = Math.floor(i / 4);
      const col = i % 4;
      return (
        <svg
          key={i}
          width="160"
          height="100"
          viewBox="0 0 100 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute text-foreground"
          style={{
            top: `${row * 33 + (col % 2 === 0 ? 5 : 15)}%`,
            left: `${col * 25 + (row % 2 === 0 ? 2 : 10)}%`,
          }}
        >
          <path
            d="M75 45c0-11-9-20-20-20a20 20 0 00-19 14 15 15 0 00-16 15c0 8.3 6.7 15 15 15h38c7.2 0 13-5.8 13-13s-5.8-13-11-11z"
            fill="currentColor"
          />
        </svg>
      );
    })}
  </div>
);

export default CloudBackground;

const CloudLogo = ({ className = "", size = 40 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M75 45c0-11-9-20-20-20a20 20 0 00-19 14 15 15 0 00-16 15c0 8.3 6.7 15 15 15h38c7.2 0 13-5.8 13-13s-5.8-13-11-11z"
      fill="currentColor"
      opacity="0.9"
    />
    <path
      d="M30 54c-5.5 0-10-4.5-10-10s4.5-10 10-10c1 0 2 .15 3 .4A15 15 0 0148 25c8.3 0 15 6.7 15 15 0 .5 0 1-.05 1.5A10 10 0 0173 51c0 5.5-4.5 10-10 10H30z"
      fill="currentColor"
      opacity="0.15"
    />
  </svg>
);

export default CloudLogo;

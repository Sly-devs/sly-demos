/**
 * Product image. Renders a real photo when `src` is given (Hoka), else a
 * crisp inline running-shoe SVG (tote/flask keep the illustration).
 */
export function ProductShot({
  className,
  src,
  alt,
}: {
  className?: string;
  src?: string;
  alt?: string;
}) {
  if (src) {
    return (
      <div className={className}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? 'Product photo'}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }
  return (
    <div className={className}>
      <svg
        viewBox="0 0 320 320"
        fill="none"
        className="h-full w-full"
        role="img"
        aria-label="Hoka Clifton 10 running shoe"
      >
        <defs>
          <linearGradient id="shoeBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f0e9da" />
          </linearGradient>
          <linearGradient id="shoeSole" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d8714d" />
            <stop offset="100%" stopColor="#b8512f" />
          </linearGradient>
        </defs>

        {/* contact shadow */}
        <ellipse cx="162" cy="248" rx="118" ry="14" fill="#16130f" opacity="0.06" />

        {/* chunky max-cushion midsole */}
        <path
          d="M44 232c-9-2-12-14-6-26 10-21 30-40 58-52 30-13 64-18 96-12 30 6 54 18 64 36 7 13 4 27-8 33-14 7-44 11-78 12-58 2-110 4-126 1Z"
          fill="url(#shoeSole)"
        />
        <path
          d="M44 232c-9-2-12-14-6-26"
          stroke="#9c4527"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* upper */}
        <path
          d="M70 188c-4-30 8-58 38-76 24-15 52-20 78-15 22 4 38 16 44 36 5 17 3 33-6 44-8 9-22 13-44 14-46 2-86 1-104-3-4-1-6-1-6 0Z"
          fill="url(#shoeBody)"
          stroke="#e0d6c2"
          strokeWidth="1.5"
        />

        {/* toe cap seam */}
        <path
          d="M70 190c14-8 30-12 48-12"
          stroke="#d8714d"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.55"
        />

        {/* heel counter */}
        <path
          d="M214 122c14 6 24 18 28 36 3 14 1 26-5 35"
          stroke="#d8714d"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.55"
        />

        {/* laces */}
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1={128 + i * 20}
            y1={108 + i * 11}
            x2={150 + i * 20}
            y2={132 + i * 11}
            stroke="#16130f"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.28"
          />
        ))}

        {/* eyestay */}
        <path
          d="M120 100 165 178"
          stroke="#cbbfa7"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M192 96 175 180"
          stroke="#cbbfa7"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* swoosh-style brand mark */}
        <path
          d="M150 168c20-22 50-34 78-32-22 10-44 24-64 44-6-4-10-8-14-12Z"
          fill="#16130f"
          opacity="0.85"
        />
      </svg>
    </div>
  );
}

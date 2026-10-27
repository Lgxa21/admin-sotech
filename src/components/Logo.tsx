// Marca: tres tintas de proceso superpuestas (cian, magenta, amarillo).
export default function Logo({ size = 32, word = true, light = true }: { size?: number; word?: boolean; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="13" cy="13" r="10" fill="#00A3E0" opacity="0.92" />
        <circle cx="21" cy="13" r="10" fill="#E6007E" opacity="0.85" />
        <circle cx="17" cy="21" r="10" fill="#FFD400" opacity="0.85" />
      </svg>
      {word && <span className={`font-display text-xl font-extrabold tracking-[-0.01em] ${light ? "text-canvas" : "text-ink"}`} style={{ fontStretch: "125%" }}>sotech</span>}
    </span>
  );
}

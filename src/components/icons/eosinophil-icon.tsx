interface EosinophilIconProps {
  className?: string;
}

/**
 * Eosinophil mark used as the My Allergy logo icon: a pink cell with a large
 * violet bilobed nucleus and amber granules — the cell's defining features.
 */
export function EosinophilIcon({ className }: EosinophilIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label="Eosinophil"
    >
      {/* cell body */}
      <circle cx="12" cy="12" r="9.3" fill="#FBCFE8" />
      {/* bilobed nucleus */}
      <ellipse cx="9" cy="9.7" rx="3" ry="2.8" fill="#7C3AED" />
      <ellipse cx="9" cy="14.3" rx="3" ry="2.8" fill="#7C3AED" />
      {/* granules */}
      <g fill="#F59E0B">
        <circle cx="13.2" cy="7" r="1.15" />
        <circle cx="15.8" cy="8.7" r="1.15" />
        <circle cx="16.9" cy="11.8" r="1.15" />
        <circle cx="16" cy="14.8" r="1.15" />
        <circle cx="13.4" cy="16.6" r="1.15" />
        <circle cx="12.5" cy="10.7" r="1.15" />
        <circle cx="14" cy="13" r="1.15" />
        <circle cx="12.6" cy="13.9" r="1.15" />
      </g>
    </svg>
  );
}

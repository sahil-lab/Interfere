export function Arrow({ up = false }: { up?: boolean }) {
  return (
    <svg className="arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={up ? 'M12 20V4m-7 7 7-7 7 7' : 'M5 19 19 5M7 5h12v12'}
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 9h10V3h6v10h10v6H19v10h-6V19H3z" fill="currentColor" />
      <path className="brand-slash" d="m5 27 22-22" strokeWidth="3" />
    </svg>
  );
}

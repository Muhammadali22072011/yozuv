"use client";

import { useState } from "react";

// Logo <img> that falls back to a placeholder when the asset 404s. Business
// records can reference a logo file that's gone (deleted upload, lost blob),
// and a broken-image icon on the public page / profile / map reads as "this
// business is broken". Swap to the caller's fallback node instead.
export function BizLogo({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}

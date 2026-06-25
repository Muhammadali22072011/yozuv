import Image from "next/image";
import { cn } from "@/lib/utils";

export function YzLogo({
  size = 28,
  className,
  variant = "gradient",
}: {
  size?: number;
  className?: string;
  variant?: "gradient" | "dark" | "light";
}) {
  return (
    <span
      className={cn(
        "relative inline-block shrink-0 rounded-2xl",
        // Havodor — the logo PNG already carries its own white circle, so we
        // never put an opaque plate behind it (that would erase its edge).
        // The only refinement is the signature soft indigo glow on light
        // surfaces (gradient variant); on dark/branded tops (light/dark) the
        // white mark already pops, so we keep it clean.
        variant === "gradient" &&
          "shadow-[0_6px_18px_-8px_rgba(72,83,245,0.30)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label="Yozuv"
    >
      <Image
        src="/logo.png"
        alt="Yozuv"
        width={size}
        height={size}
        priority
        unoptimized
        className="h-full w-full object-contain"
        style={{
          // The light/gradient/dark hero backgrounds are dark — the logo's
          // own white circle stays visible without any extra plate.
          filter:
            variant === "dark"
              ? "drop-shadow(0 1px 2px rgba(0,0,0,0.45))"
              : undefined,
        }}
      />
    </span>
  );
}

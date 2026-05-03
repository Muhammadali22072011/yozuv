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
      className={cn("relative inline-block shrink-0", className)}
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

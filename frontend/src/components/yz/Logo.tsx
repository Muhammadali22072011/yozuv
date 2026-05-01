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
  const bg =
    variant === "gradient"
      ? "linear-gradient(135deg,#5B6BFF,#3640D4)"
      : variant === "dark"
      ? "#0B0F1F"
      : "#FFFFFF";
  const color = variant === "light" ? "#4853F5" : "#FFFFFF";
  return (
    <span
      className={cn("grid place-items-center font-display font-extrabold", className)}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: bg,
        color,
        fontSize: size * 0.5,
        boxShadow: variant === "gradient" ? "0 4px 12px rgba(72,83,245,0.4)" : undefined,
      }}
    >
      Y
    </span>
  );
}

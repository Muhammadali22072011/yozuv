import { cn } from "@/lib/utils";

export function Logo({
  size = 28,
  showWordmark = true,
  className,
  variant = "dark",
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  variant?: "dark" | "light";
}) {
  const fg = variant === "dark" ? "bg-ink text-white" : "bg-white text-ink";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn("grid place-items-center rounded-md font-bold", fg)}
        style={{ width: size, height: size, fontSize: size * 0.55 }}
      >
        Y
      </span>
      {showWordmark && (
        <span className="font-serif text-lg leading-none text-ink">yozuv</span>
      )}
    </span>
  );
}

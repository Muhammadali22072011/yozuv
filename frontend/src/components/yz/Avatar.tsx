import { cn } from "@/lib/utils";

const COLORS = ["#FF7A6B", "#22C8A8", "#FFC94A", "#B8A6FF", "#7BC6FF", "#FF9FB5", "#5B6BFF"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function colorFor(name: string) {
  if (!name) return COLORS[0];
  return COLORS[name.charCodeAt(0) % COLORS.length];
}

export function Avatar({
  name,
  size = 40,
  className,
  vip,
  isNew,
}: {
  name: string;
  size?: number;
  className?: string;
  vip?: boolean;
  isNew?: boolean;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <span
        className="grid place-items-center font-display font-bold text-white"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.32,
          background: colorFor(name),
          fontSize: size * 0.38,
        }}
      >
        {initials(name)}
      </span>
      {vip && (
        <span
          className="absolute -bottom-1 -right-1 grid place-items-center rounded-full border-2 border-white bg-lemon text-[10px] text-ink-900"
          style={{ width: size * 0.4, height: size * 0.4 }}
        >
          ★
        </span>
      )}
      {isNew && !vip && (
        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-coral" />
      )}
    </span>
  );
}

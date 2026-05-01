import { cn } from "@/lib/utils";

export function HeroGradient({
  className,
  children,
  decorations = true,
}: {
  className?: string;
  children?: React.ReactNode;
  decorations?: boolean;
}) {
  return (
    <div className={cn("yz-hero relative overflow-hidden rounded-b-[32px] px-5 pb-20 pt-14", className)}>
      {decorations && (
        <>
          <div className="pointer-events-none absolute -right-10 -top-8 h-48 w-48 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute right-20 top-20 h-24 w-24 rounded-full bg-lemon/25 blur-sm" />
          <div className="pointer-events-none absolute -left-5 bottom-14 h-28 w-28 rounded-full bg-lilac/25" />
        </>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

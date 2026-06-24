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
    <div className={cn("yz-hero relative overflow-hidden rounded-b-[34px] px-5 pb-20 pt-14", className)}>
      {decorations && (
        <>
          <div className="pointer-events-none absolute -right-12 -top-10 h-52 w-52 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute right-16 top-16 h-28 w-28 rounded-full bg-sky/30 blur-2xl" />
          <div className="pointer-events-none absolute -left-8 bottom-10 h-32 w-32 rounded-full bg-lilac/30 blur-2xl" />
        </>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

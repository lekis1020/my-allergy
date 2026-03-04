import { cn } from "@/lib/utils/cn";

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function Badge({ children, color, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
      style={
        color
          ? {
              backgroundColor: `${color}15`,
              color: color,
              border: `1px solid ${color}30`,
            }
          : undefined
      }
    >
      {children}
    </span>
  );
}

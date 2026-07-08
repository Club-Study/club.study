import { cn } from "@/lib/utils";

type BrandWordmarkProps = {
  className?: string;
};

export function BrandWordmark({ className }: BrandWordmarkProps) {
  return (
    <span className={cn("font-semibold tracking-normal", className)}>
      <span className="text-foreground">co</span>
      <span className="text-muted-foreground">search</span>
    </span>
  );
}

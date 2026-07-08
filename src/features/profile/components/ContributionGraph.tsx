import { contributionColor } from "@/features/profile/profileActivity";
import { cn } from "@/lib/utils";

export function ContributionGraph({
  cells,
  label,
  className,
}: {
  cells: number[];
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-full justify-start overflow-hidden", className)}>
      <div className="w-max max-w-full overflow-hidden">
        <div
          className="grid gap-[var(--activity-gap,0.25rem)] [grid-template-columns:repeat(49,var(--activity-cell,0.875rem))]"
          aria-label={label}
        >
          {cells.map((level, index) => (
            <span
              key={index}
              className="size-[var(--activity-cell,0.875rem)] rounded-[2px]"
              style={{ backgroundColor: contributionColor(level) }}
              aria-hidden="true"
            />
          ))}
        </div>

        <div className="mt-2 flex items-center justify-end gap-1 overflow-hidden text-[10px] leading-3 text-muted-foreground">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className="size-2.5 rounded-[2px]"
              style={{ backgroundColor: contributionColor(level) }}
              aria-hidden="true"
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

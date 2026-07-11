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
    <div
      className={cn("max-w-full overflow-x-auto pb-1", className)}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <div className="w-max min-w-full">
        <div
          data-slot="contribution-grid"
          className="grid justify-between gap-[var(--activity-gap,0.25rem)] [grid-template-columns:repeat(52,var(--activity-cell,0.875rem))]"
          aria-hidden="true"
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

        <div
          className="mt-2 flex items-center justify-end gap-1 text-[10px] leading-3 text-muted-foreground"
          aria-hidden="true"
        >
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

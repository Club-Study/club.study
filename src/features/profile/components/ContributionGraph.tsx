import { contributionColor } from "@/features/profile/profileActivity";

export function ContributionGraph({
  cells,
  label,
}: {
  cells: number[];
  label: string;
}) {
  return (
    <div className="max-w-full overflow-hidden rounded-md bg-muted/35 p-2.5 sm:p-3">
      <div
        className="grid w-full gap-px [grid-template-columns:repeat(49,minmax(0,1fr))] sm:gap-[3px]"
        aria-label={label}
      >
        {cells.map((level, index) => (
          <span
            key={index}
            className="aspect-square rounded-[2px]"
            style={{ backgroundColor: contributionColor(level) }}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 overflow-hidden text-[11px] leading-3 text-muted-foreground">
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
  );
}

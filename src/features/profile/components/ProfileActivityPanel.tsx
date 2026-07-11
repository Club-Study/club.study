import { ContributionGraph } from "@/features/profile/components/ContributionGraph";
import type { ProfileActivity } from "@/features/profile/profileActivity";

export function ProfileActivityPanel({
  activity,
}: {
  activity: ProfileActivity;
}) {
  return (
    <section className="min-w-0 space-y-3" aria-labelledby="reading-activity-heading">
      <h2 id="reading-activity-heading" className="text-sm font-semibold">
        Reading activity
      </h2>
      <ContributionGraph
        cells={activity.contributionCells}
        label="Reading activity over the past 52 weeks"
        className="[--activity-cell:0.625rem] [--activity-gap:0.1875rem] xl:[--activity-cell:0.6875rem] 2xl:[--activity-cell:0.75rem]"
      />
    </section>
  );
}

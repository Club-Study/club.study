import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { AddPersonalPaperDialog } from "@/features/profile/components/AddPersonalPaperDialog";
import { ProfilePaperRows } from "@/features/profile/components/ProfilePaperRows";
import {
  getViewCount,
  paperListViews,
  type PaperListView,
} from "@/features/profile/components/profilePaperList";
import type { ProfileOverview } from "@/features/profile/api";
import { buildProfilePaperBuckets } from "@/features/profile/profileActivity";

export function RecentReadsCard({
  overview,
  readOnly = false,
}: {
  overview: ProfileOverview;
  readOnly?: boolean;
}) {
  const [view, setView] = useState<PaperListView>("reading");
  const buckets = useMemo(() => buildProfilePaperBuckets(overview), [overview]);
  const activeView = paperListViews.find((item) => item.id === view);

  if (!activeView) {
    throw new Error(`Unknown profile paper list view: ${view}`);
  }

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium">Papers</h2>
            <span className="text-xs text-muted-foreground">
              {getViewCount(view, buckets)} total
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {readOnly ? null : <AddPersonalPaperDialog />}
          <div
            className="flex items-center gap-0.5 rounded-md border bg-muted/10 p-0.5"
            role="tablist"
            aria-label="Profile paper status"
          >
            {paperListViews.map(({ id, label, Icon }) => (
              <Button
                key={id}
                type="button"
                role="tab"
                aria-label={label}
                title={label}
                aria-selected={view === id}
                aria-controls="profile-paper-panel"
                id={`profile-paper-tab-${id}`}
                variant="ghost"
                size="xs"
                className="h-6 min-w-0 gap-1 rounded-sm px-1.5 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground aria-selected:bg-background aria-selected:text-foreground aria-selected:shadow-xs [&_svg:not([class*='size-'])]:size-3"
                onClick={() => setView(id)}
              >
                <Icon aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div
        id="profile-paper-panel"
        role="tabpanel"
        aria-labelledby={`profile-paper-tab-${view}`}
        className="mt-3 divide-y"
      >
        <ProfilePaperRows
          view={view}
          buckets={buckets}
          empty={activeView.empty}
          readOnly={readOnly}
        />
      </div>
    </section>
  );
}

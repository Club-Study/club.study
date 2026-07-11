import { ChevronDownIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const statusCounts = paperListViews.map((item) => ({
    ...item,
    count: getViewCount(item.id, buckets),
  }));
  const activeCount = getViewCount(view, buckets);
  const totalCount = statusCounts.reduce((total, item) => total + item.count, 0);
  const otherCounts = statusCounts.filter(
    (item) => item.id !== view && item.count > 0,
  );

  if (!activeView) {
    throw new Error(`Unknown profile paper list view: ${view}`);
  }

  return (
    <section className="min-w-0 space-y-3" aria-labelledby="papers-heading">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
          <h2 id="papers-heading" className="text-sm font-semibold">
            Papers
          </h2>
          <span className="text-xs text-muted-foreground">{totalCount} total</span>
        </div>
        {readOnly ? null : <AddPersonalPaperDialog />}
      </div>

      <div className="min-w-0 rounded-md border border-border/70 bg-card/20">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 min-w-36 justify-between rounded-sm bg-background shadow-none"
                aria-label={`${activeView.label} papers, ${activeCount} total`}
                aria-controls="profile-paper-panel"
              >
                <span className="truncate">
                  {activeView.label} ({activeCount})
                </span>
                <ChevronDownIcon aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-52">
              <DropdownMenuRadioGroup
                value={view}
                onValueChange={(value) => {
                  if (isPaperListView(value)) {
                    setView(value);
                  }
                }}
              >
                {statusCounts.map(({ id, label, Icon, count }) => (
                  <DropdownMenuRadioItem key={id} value={id}>
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                    <span className="ml-auto pl-4 text-xs tabular-nums text-muted-foreground">
                      {count}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {otherCounts.length > 0 ? (
            <p className="text-xs leading-5 text-muted-foreground">
              {otherCounts
                .map((item) => `${item.count} ${item.label.toLowerCase()}`)
                .join(" · ")}
            </p>
          ) : null}
        </div>

        <div id="profile-paper-panel" className="space-y-1 px-4 pb-3">
          <ProfilePaperRows
            view={view}
            buckets={buckets}
            empty={activeView.empty}
            readOnly={readOnly}
          />
        </div>
      </div>
    </section>
  );
}

function isPaperListView(value: string): value is PaperListView {
  return paperListViews.some((item) => item.id === value);
}

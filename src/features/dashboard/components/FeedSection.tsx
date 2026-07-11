import type { ReactNode } from "react";

import { ItemGroup } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { FeedPaperItem } from "@/features/dashboard/components/FeedPaperItem";
import type { FeedDensity } from "@/features/dashboard/feed";
import type { DashboardFeedItem } from "@/features/schedule/api";

export function FeedSection({
  id,
  title,
  items,
  density,
  isLoading,
  emptyMessage,
  actions,
}: {
  id: string;
  title: string;
  items: DashboardFeedItem[];
  density: FeedDensity;
  isLoading: boolean;
  emptyMessage: string;
  actions?: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      aria-busy={isLoading}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <h2 id={id} className="text-sm font-medium">
            {title}
          </h2>
          {!isLoading ? (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {items.length} shown
            </span>
          ) : null}
        </div>
        {actions}
      </div>

      {isLoading ? (
        <FeedSectionSkeleton density={density} />
      ) : items.length > 0 ? (
        <ItemGroup className="gap-2">
          {items.map((item, index) => (
            <div key={item.id} role="listitem" className="min-w-0">
              <FeedPaperItem
                item={item}
                index={index}
                density={density}
              />
            </div>
          ))}
        </ItemGroup>
      ) : (
        <p className="rounded-sm bg-muted/20 px-4 py-5 text-sm leading-6 text-muted-foreground">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

function FeedSectionSkeleton({ density }: { density: FeedDensity }) {
  return (
    <div role="status">
      <span className="sr-only">Loading papers</span>
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className={`grid gap-3 rounded-sm px-4 ${
              density === "compact" ? "py-3" : "py-5"
            } md:grid-cols-[10rem_minmax(0,1fr)] md:gap-6`}
          >
            <div className="space-y-2">
              <Skeleton className="h-3 w-6" />
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-3 w-2/5" />
              {density === "comfortable" ? (
                <Skeleton className="h-10 w-full" />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

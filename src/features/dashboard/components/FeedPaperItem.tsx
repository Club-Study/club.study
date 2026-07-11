import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import type { FeedDensity } from "@/features/dashboard/feed";
import type { DashboardFeedItem } from "@/features/schedule/api";
import { formatOptionalDateLabel } from "@/lib/dates/week";
import { cn } from "@/lib/utils";

export function FeedPaperItem({
  item,
  index,
  density,
}: {
  item: DashboardFeedItem;
  index: number;
  density: FeedDensity;
}) {
  const compact = density === "compact";

  return (
    <Item
      asChild
      size={compact ? "sm" : "default"}
      className={cn(
        "relative grid w-full min-w-0 gap-3 rounded-sm border-0 pr-10 hover:bg-accent/70 focus-visible:bg-accent/70 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-6 md:pr-12",
        compact ? "py-3" : "py-5",
      )}
    >
      <Link
        to="/app/papers/$scheduleId"
        params={{ scheduleId: item.id }}
      >
        <ItemContent
          className={cn(
            "min-w-0 text-[11px] leading-5 text-muted-foreground",
            compact
              ? "flex-row flex-wrap items-center gap-x-3 gap-y-0 md:flex-col md:items-start md:gap-1"
              : "gap-1.5",
          )}
        >
          <span className="font-medium tabular-nums text-foreground/80">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="line-clamp-2">{item.clubs?.name ?? "Club"}</span>
          <span>{formatScheduleDate(item.week_start)}</span>
        </ItemContent>

        <ItemContent className={cn("min-w-0", compact ? "gap-0.5" : "gap-2")}>
          <ItemTitle className="block w-full">
            <h3
              className={cn(
                "line-clamp-2 font-semibold text-foreground",
                compact
                  ? "text-sm leading-6 md:text-base"
                  : "text-lg leading-7 md:text-xl",
              )}
            >
              {item.papers?.title ?? "Untitled paper"}
            </h3>
          </ItemTitle>
          {item.papers?.authors.length ? (
            <p
              className={cn(
                "line-clamp-2 text-muted-foreground",
                compact ? "text-xs leading-5" : "text-sm leading-6",
              )}
            >
              {formatAuthors(item.papers.authors)}
            </p>
          ) : null}
          {!compact && item.papers?.abstract?.trim() ? (
            <ItemDescription className="line-clamp-2 text-sm leading-6 text-pretty md:text-base md:leading-7">
              {item.papers.abstract.trim().replace(/\s+/g, " ")}
            </ItemDescription>
          ) : null}
        </ItemContent>

        <ItemActions className="absolute right-3 top-1/2 -translate-y-1/2 md:right-4">
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground opacity-0 group-hover/item:opacity-100 group-focus-visible/item:opacity-100"
          />
        </ItemActions>
      </Link>
    </Item>
  );
}

function formatScheduleDate(value: string | null) {
  if (!value) {
    return "Unscheduled";
  }

  return formatOptionalDateLabel(value);
}

function formatAuthors(authors: string[]) {
  const visibleAuthors = authors.slice(0, 4).join(", ");

  if (authors.length <= 4) {
    return visibleAuthors;
  }

  return `${visibleAuthors}, et al.`;
}

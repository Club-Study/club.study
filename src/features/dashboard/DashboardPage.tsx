import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { useCurrentUser } from "@/features/auth/queries";
import { clubsQueryOptions } from "@/features/clubs/queries";
import { FeedSection } from "@/features/dashboard/components/FeedSection";
import { FeedToolbar } from "@/features/dashboard/components/FeedToolbar";
import {
  getPastPaperState,
  normalizeFeedSearch,
  type FeedDensity,
  type PastPaperFilter,
} from "@/features/dashboard/feed";
import { dashboardFeedQueryOptions } from "@/features/schedule/queries";
import { getCurrentWeekStart } from "@/lib/dates/week";

const densityStorageKey = "club.study.feedDensity";

export function DashboardPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [pastFilter, setPastFilter] = useState<PastPaperFilter>("all");
  const [density, setDensity] = useState<FeedDensity>(getInitialDensity);
  const currentWeekStart = getCurrentWeekStart();
  const user = useCurrentUser();
  const userId = user.data?.id ?? "";
  const clubs = useQuery({
    ...clubsQueryOptions(userId),
    enabled: Boolean(userId),
  });
  const filters = useMemo(
    () => ({
      clubId: selectedClubId,
      search: normalizeFeedSearch(deferredSearch),
    }),
    [deferredSearch, selectedClubId],
  );
  const upcoming = useQuery({
    ...dashboardFeedQueryOptions({
      userId,
      scope: "upcoming",
      currentWeekStart,
      filters,
    }),
    enabled: Boolean(userId),
  });
  const past = useQuery({
    ...dashboardFeedQueryOptions({
      userId,
      scope: "past",
      currentWeekStart,
      filters,
    }),
    enabled: showPast && Boolean(userId),
  });

  useEffect(() => {
    window.localStorage.setItem(densityStorageKey, density);
  }, [density]);

  if (clubs.error) {
    throw clubs.error;
  }

  if (user.error) {
    throw user.error;
  }

  if (!user.isPending && !user.data) {
    throw new Error("Feed route requires a signed-in user.");
  }

  if (upcoming.error) {
    throw upcoming.error;
  }

  if (showPast && past.error) {
    throw past.error;
  }

  const visiblePastItems = (past.data ?? []).filter((item) => {
    if (pastFilter === "all") {
      return true;
    }

    return getPastPaperState(item.currentStatus) === pastFilter;
  });
  const hasActiveFilters = Boolean(filters.clubId || filters.search);

  return (
    <section className="mx-auto w-full max-w-5xl space-y-8">
      <header className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Feed</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Upcoming papers across your reading clubs.
          </p>
        </div>

        <FeedToolbar
          search={search}
          onSearchChange={setSearch}
          clubs={clubs.data ?? []}
          selectedClubId={selectedClubId}
          onClubChange={setSelectedClubId}
          showPast={showPast}
          onShowPastChange={setShowPast}
          density={density}
          onDensityChange={setDensity}
        />
      </header>

      {clubs.data?.length === 0 ? (
        <div className="rounded-sm bg-muted/30 px-4 py-4">
          <h2 className="text-sm font-medium text-foreground">No clubs yet</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Create a private club to schedule the first paper.
          </p>
        </div>
      ) : null}

      <FeedSection
        id="upcoming-papers"
        title="Upcoming"
        items={upcoming.data ?? []}
        density={density}
        isLoading={upcoming.isPending}
        emptyMessage={
          hasActiveFilters
            ? "No upcoming papers match the current filters."
            : "No upcoming papers are scheduled."
        }
      />

      {showPast ? (
        <FeedSection
          id="past-papers"
          title="Past"
          items={visiblePastItems}
          density={density}
          isLoading={past.isPending}
          emptyMessage={pastEmptyMessage(pastFilter, hasActiveFilters)}
          actions={
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={pastFilter}
              onValueChange={(value) => {
                if (
                  value === "all" ||
                  value === "read" ||
                  value === "missed"
                ) {
                  setPastFilter(value);
                }
              }}
              aria-label="Past paper status"
            >
              <ToggleGroupItem value="all">All</ToggleGroupItem>
              <ToggleGroupItem value="read">Read</ToggleGroupItem>
              <ToggleGroupItem value="missed">Missed</ToggleGroupItem>
            </ToggleGroup>
          }
        />
      ) : null}
    </section>
  );
}

function getInitialDensity(): FeedDensity {
  if (typeof window === "undefined") {
    return "comfortable";
  }

  const storedDensity = window.localStorage.getItem(densityStorageKey);
  return storedDensity === "compact" ? "compact" : "comfortable";
}

function pastEmptyMessage(
  filter: PastPaperFilter,
  hasActiveFilters: boolean,
) {
  if (filter === "read") {
    return "No read papers match the current filters.";
  }

  if (filter === "missed") {
    return "No missed papers match the current filters.";
  }

  return hasActiveFilters
    ? "No past papers match the current filters."
    : "No past papers yet.";
}

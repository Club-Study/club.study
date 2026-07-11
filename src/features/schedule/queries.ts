import { queryOptions } from "@tanstack/react-query";

import { normalizeFeedSearch } from "@/features/dashboard/feed";
import {
  getClubProgress,
  getSchedule,
  getScheduleById,
  listDashboardFeed,
  listClubSchedule,
  type FeedFilters,
  type FeedScope,
} from "@/features/schedule/api";
import { queryKeys } from "@/lib/queryKeys";

export function dashboardFeedQueryOptions({
  userId,
  scope,
  currentWeekStart,
  filters,
}: {
  userId: string;
  scope: FeedScope;
  currentWeekStart: string;
  filters: FeedFilters;
}) {
  const normalizedFilters = {
    ...filters,
    search: normalizeFeedSearch(filters.search),
  };

  return queryOptions({
    queryKey: queryKeys.schedule.dashboard(
      userId,
      scope,
      currentWeekStart,
      normalizedFilters,
    ),
    queryFn: () =>
      listDashboardFeed({
        userId,
        scope,
        currentWeekStart,
        filters: normalizedFilters,
      }),
  });
}

export function scheduleListQueryOptions(clubId: string) {
  return queryOptions({
    queryKey: queryKeys.schedule.list(clubId),
    queryFn: () => listClubSchedule(clubId),
  });
}

export function scheduleDetailQueryOptions(clubId: string, scheduleId: string) {
  return queryOptions({
    queryKey: queryKeys.schedule.detail(clubId, scheduleId),
    queryFn: () => getSchedule(clubId, scheduleId),
  });
}

export function scheduleDetailByIdQueryOptions(scheduleId: string) {
  return queryOptions({
    queryKey: queryKeys.schedule.detailById(scheduleId),
    queryFn: () => getScheduleById(scheduleId),
  });
}

export function scheduleProgressQueryOptions(clubId: string) {
  return queryOptions({
    queryKey: queryKeys.schedule.progress(clubId),
    queryFn: () => getClubProgress(clubId),
  });
}

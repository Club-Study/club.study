import { queryOptions } from "@tanstack/react-query";

import {
  getClubProgress,
  getSchedule,
  getScheduleById,
  listClubSchedule,
  listDashboardSchedule,
} from "@/features/schedule/api";
import { queryKeys } from "@/lib/queryKeys";

export function dashboardScheduleQueryOptions(currentWeekStart: string) {
  return queryOptions({
    queryKey: queryKeys.schedule.dashboard(currentWeekStart),
    queryFn: () => listDashboardSchedule(currentWeekStart),
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

import { queryOptions } from "@tanstack/react-query";

import {
  getClubProgress,
  getSchedule,
  getScheduleById,
  listClubSchedule,
  listDashboardSchedule,
} from "@/features/schedule/api";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/lib/supabase/client";

export function dashboardScheduleQueryOptions(currentWeekStart: string) {
  return queryOptions({
    queryKey: queryKeys.schedule.dashboard(currentWeekStart),
    queryFn: () => listDashboardSchedule(supabase, currentWeekStart),
  });
}

export function scheduleListQueryOptions(clubId: string) {
  return queryOptions({
    queryKey: queryKeys.schedule.list(clubId),
    queryFn: () => listClubSchedule(supabase, clubId),
  });
}

export function scheduleDetailQueryOptions(clubId: string, scheduleId: string) {
  return queryOptions({
    queryKey: queryKeys.schedule.detail(clubId, scheduleId),
    queryFn: () => getSchedule(supabase, clubId, scheduleId),
  });
}

export function scheduleDetailByIdQueryOptions(scheduleId: string) {
  return queryOptions({
    queryKey: queryKeys.schedule.detailById(scheduleId),
    queryFn: () => getScheduleById(supabase, scheduleId),
  });
}

export function scheduleProgressQueryOptions(clubId: string) {
  return queryOptions({
    queryKey: queryKeys.schedule.progress(clubId),
    queryFn: () => getClubProgress(supabase, clubId),
  });
}

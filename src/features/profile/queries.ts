import { queryOptions } from "@tanstack/react-query";

import { getProfile, getProfileOverview } from "@/features/profile/api";
import { queryKeys } from "@/lib/queryKeys";

export function profileQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.profile.current(userId),
    queryFn: getProfile,
  });
}

export function profileOverviewQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.profile.overview(userId),
    queryFn: getProfileOverview,
  });
}

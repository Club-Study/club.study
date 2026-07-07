import { queryOptions } from "@tanstack/react-query";

import {
  getProfile,
  getProfileMemberships,
  getProfileOverview,
} from "@/features/profile/api";
import { queryKeys } from "@/lib/queryKeys";

export function profileQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.profile.current(userId),
    queryFn: () => getProfile(userId),
  });
}

export function profileOverviewQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.profile.overview(userId),
    queryFn: () => getProfileOverview(userId),
  });
}

export function profileMembershipsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.profile.memberships(userId),
    queryFn: () => getProfileMemberships(userId),
  });
}

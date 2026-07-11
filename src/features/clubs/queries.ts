import { queryOptions } from "@tanstack/react-query";

import {
  getClub,
  listClubs,
  listInvites,
  listMembers,
} from "@/features/clubs/api";
import { queryKeys } from "@/lib/queryKeys";

export function clubsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.clubs.list(userId),
    queryFn: () => listClubs(userId),
  });
}

export function clubQueryOptions(clubId: string) {
  return queryOptions({
    queryKey: queryKeys.clubs.detail(clubId),
    queryFn: () => getClub(clubId),
  });
}

export function membersQueryOptions(clubId: string) {
  return queryOptions({
    queryKey: queryKeys.clubs.members(clubId),
    queryFn: () => listMembers(clubId),
  });
}

export function invitesQueryOptions(clubId: string) {
  return queryOptions({
    queryKey: queryKeys.clubs.invites(clubId),
    queryFn: () => listInvites(clubId),
  });
}

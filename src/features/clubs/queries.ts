import { queryOptions } from "@tanstack/react-query";

import {
  getClub,
  listClubJoinRequests,
  listClubs,
  listDiscoverableClubs,
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

export function clubDirectoryQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.clubs.directory(userId),
    queryFn: listDiscoverableClubs,
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

export function joinRequestsQueryOptions(clubId: string) {
  return queryOptions({
    queryKey: queryKeys.clubs.applications(clubId),
    queryFn: () => listClubJoinRequests(clubId),
  });
}

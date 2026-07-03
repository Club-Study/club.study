import { queryOptions } from "@tanstack/react-query";

import {
  getClub,
  listClubs,
  listInvites,
  listMembers,
} from "@/features/clubs/api";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/lib/supabase/client";

export const clubsQueryOptions = queryOptions({
  queryKey: queryKeys.clubs.all,
  queryFn: () => listClubs(supabase),
});

export function clubQueryOptions(clubId: string) {
  return queryOptions({
    queryKey: queryKeys.clubs.detail(clubId),
    queryFn: () => getClub(supabase, clubId),
  });
}

export function membersQueryOptions(clubId: string) {
  return queryOptions({
    queryKey: queryKeys.clubs.members(clubId),
    queryFn: () => listMembers(supabase, clubId),
  });
}

export function invitesQueryOptions(clubId: string) {
  return queryOptions({
    queryKey: queryKeys.clubs.invites(clubId),
    queryFn: () => listInvites(supabase, clubId),
  });
}

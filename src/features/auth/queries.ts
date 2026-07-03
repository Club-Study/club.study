import { useQuery } from "@tanstack/react-query";

import { getCurrentUser } from "@/features/auth/api";
import { queryKeys } from "@/lib/queryKeys";

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.user,
    queryFn: getCurrentUser,
    staleTime: 60_000,
  });
}

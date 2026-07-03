import { useQuery } from "@tanstack/react-query";

import { getCurrentUser } from "@/features/auth/api";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/lib/supabase/client";

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.user,
    queryFn: () => getCurrentUser(supabase),
    staleTime: 60_000,
  });
}

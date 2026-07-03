import type { SupabaseClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";

import { getProfile } from "@/features/profile/api";
import { queryKeys } from "@/lib/queryKeys";
import type { Database } from "@/lib/supabase/database.types";

export function profileQueryOptions(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  return queryOptions({
    queryKey: queryKeys.profile.current(userId),
    queryFn: () => getProfile(supabase, userId),
  });
}

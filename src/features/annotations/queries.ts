import { queryOptions } from "@tanstack/react-query";

import { listPaperAnnotations } from "@/features/annotations/api";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/lib/supabase/client";

export function paperAnnotationsQueryOptions(
  scheduleId: string,
  paperId: string,
) {
  return queryOptions({
    queryKey: queryKeys.annotations.list(scheduleId, paperId),
    queryFn: () => listPaperAnnotations(supabase, { scheduleId, paperId }),
  });
}

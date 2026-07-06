import { queryOptions } from "@tanstack/react-query";

import { listPaperAnnotations } from "@/features/annotations/api";
import { queryKeys } from "@/lib/queryKeys";

export function paperAnnotationsQueryOptions(
  scheduleId: string,
  paperId: string,
) {
  return queryOptions({
    queryKey: queryKeys.annotations.list(scheduleId, paperId),
    queryFn: () => listPaperAnnotations({ scheduleId, paperId }),
  });
}

import { queryOptions } from "@tanstack/react-query";

import { listComments } from "@/features/comments/api";
import { queryKeys } from "@/lib/queryKeys";

export function commentsQueryOptions(scheduleId: string) {
  return queryOptions({
    queryKey: queryKeys.comments.list(scheduleId),
    queryFn: () => listComments(scheduleId),
  });
}

import { createFileRoute } from "@tanstack/react-router";

import { ScheduledPaperPage } from "@/features/schedule/ScheduledPaperPage";

export const Route = createFileRoute(
  "/app/clubs/$clubId/schedule/$scheduleId",
)({
  component: ScheduledPaperRoute,
});

function ScheduledPaperRoute() {
  const { clubId, scheduleId } = Route.useParams();
  return <ScheduledPaperPage clubId={clubId} scheduleId={scheduleId} />;
}

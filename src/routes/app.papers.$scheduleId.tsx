import { createFileRoute } from "@tanstack/react-router";

import { ScheduledPaperPage } from "@/features/schedule/ScheduledPaperPage";

export const Route = createFileRoute("/app/papers/$scheduleId")({
  component: PaperRoute,
});

function PaperRoute() {
  const { scheduleId } = Route.useParams();
  return <ScheduledPaperPage scheduleId={scheduleId} />;
}

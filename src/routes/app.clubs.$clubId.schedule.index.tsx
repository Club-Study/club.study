import { createFileRoute } from "@tanstack/react-router";

import { SchedulePage } from "@/features/schedule/SchedulePage";

export const Route = createFileRoute("/app/clubs/$clubId/schedule/")({
  component: ClubScheduleRoute,
});

function ClubScheduleRoute() {
  const { clubId } = Route.useParams();
  return <SchedulePage clubId={clubId} />;
}

import { createFileRoute } from "@tanstack/react-router";

import { ClubShell } from "@/features/clubs/ClubShell";

export const Route = createFileRoute("/app/clubs/$clubId")({
  component: ClubRoute,
});

function ClubRoute() {
  const { clubId } = Route.useParams();
  return <ClubShell clubId={clubId} />;
}

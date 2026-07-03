import { createFileRoute } from "@tanstack/react-router";

import { MembersPage } from "@/features/clubs/MembersPage";

export const Route = createFileRoute("/app/clubs/$clubId/members")({
  component: MembersRoute,
});

function MembersRoute() {
  const { clubId } = Route.useParams();
  return <MembersPage clubId={clubId} />;
}

import { createFileRoute } from "@tanstack/react-router";

import { InvitePage } from "@/features/auth/InvitePage";

export const Route = createFileRoute("/invites/$token")({
  component: InviteRoute,
});

function InviteRoute() {
  const { token } = Route.useParams();
  return <InvitePage token={token} />;
}

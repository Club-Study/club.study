import { createFileRoute } from "@tanstack/react-router";

import { PublicProfilePage } from "@/features/profile/PublicProfilePage";

export const Route = createFileRoute("/app/profiles/$userId")({
  component: PublicProfileRoute,
});

function PublicProfileRoute() {
  const { userId } = Route.useParams();
  return <PublicProfilePage userId={userId} />;
}

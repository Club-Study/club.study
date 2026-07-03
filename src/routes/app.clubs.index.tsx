import { createFileRoute } from "@tanstack/react-router";

import { ClubsPage } from "@/features/clubs/ClubsPage";

export const Route = createFileRoute("/app/clubs/")({
  component: ClubsPage,
});

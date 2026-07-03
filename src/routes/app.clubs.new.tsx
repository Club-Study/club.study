import { createFileRoute } from "@tanstack/react-router";

import { NewClubPage } from "@/features/clubs/NewClubPage";

export const Route = createFileRoute("/app/clubs/new")({
  component: NewClubPage,
});

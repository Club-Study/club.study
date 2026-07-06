import { createFileRoute } from "@tanstack/react-router";

import { PersonalPaperPage } from "@/features/profile/PersonalPaperPage";

export const Route = createFileRoute("/app/personal-papers/$personalPaperId")({
  component: PersonalPaperRoute,
});

function PersonalPaperRoute() {
  const { personalPaperId } = Route.useParams();
  return <PersonalPaperPage personalPaperId={personalPaperId} />;
}

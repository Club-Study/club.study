import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/clubs/$clubId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/app/clubs/$clubId/schedule",
      params: { clubId: params.clubId },
    });
  },
});

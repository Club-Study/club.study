import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AuthCallbackPage } from "@/features/auth/AuthCallbackPage";

const callbackSearchSchema = z.object({
  code: z.string().optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search) => callbackSearchSchema.parse(search),
  component: AuthCallbackPage,
});

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SignInPage } from "@/features/auth/SignInPage";

const signInSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search) => signInSearchSchema.parse(search),
  component: SignInPage,
});

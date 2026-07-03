import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { BookOpenText } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { signInWithEmail } from "@/features/auth/api";
import { useCurrentUser } from "@/features/auth/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryKeys } from "@/lib/queryKeys";

const redirectStorageKey = "club.study.redirectAfterSignIn";

export function SignInPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ from: "/sign-in" });
  const redirect = safeRedirect(search.redirect);
  const currentUser = useCurrentUser();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const signIn = useMutation({
    mutationFn: () =>
      signInWithEmail({
        email: email.trim(),
        displayName: displayName.trim(),
      }),
    onSuccess: async () => {
      window.localStorage.setItem(redirectStorageKey, redirect);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.user });
      await navigate({ to: redirect, replace: true });
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (currentUser.data) {
      void navigate({ to: redirect, replace: true });
    }
  }, [currentUser.data, navigate, redirect]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signIn.mutate();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-xs">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <BookOpenText className="size-4" />
          <span>club.study</span>
        </div>
        <h1 className="mt-5 text-xl font-semibold">Sign in</h1>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={signIn.isPending || !email.trim() || !displayName.trim()}
          >
            Sign in
          </Button>
        </form>
      </section>
    </main>
  );
}

export function getStoredRedirect() {
  return safeRedirect(window.localStorage.getItem(redirectStorageKey));
}

export function clearStoredRedirect() {
  window.localStorage.removeItem(redirectStorageKey);
}

function safeRedirect(value: unknown) {
  return typeof value === "string" && value.startsWith("/") ? value : "/app";
}

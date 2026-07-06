import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { BookOpenText } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/features/auth/api";
import { useCurrentUser } from "@/features/auth/queries";

const redirectStorageKey = "club.study.redirectAfterSignIn";

export function SignInPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/sign-in" });
  const redirect = safeRedirect(search.redirect);
  const currentUser = useCurrentUser();
  const signIn = useMutation({
    mutationFn: async () => {
      window.localStorage.setItem(redirectStorageKey, redirect);
      await signInWithGoogle(`${window.location.origin}/auth/callback`);
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (currentUser.data) {
      void navigate({ to: redirect, replace: true });
    }
  }, [currentUser.data, navigate, redirect]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-xs">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <BookOpenText className="size-4" />
          <span>club.study</span>
        </div>
        <h1 className="mt-5 text-xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Continue with Google to join or create a private reading club.
        </p>
        <Button
          type="button"
          className="mt-6 w-full"
          disabled={signIn.isPending}
          onClick={() => signIn.mutate()}
        >
          Continue with Google
        </Button>
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

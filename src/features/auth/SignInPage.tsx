import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { BookOpenText } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { BrandWordmark } from "@/components/brand-wordmark";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/features/auth/api";
import { useCurrentUser } from "@/features/auth/queries";
import { safeAppRedirect } from "@/lib/safe-redirect";
import { toUserMessage } from "@/lib/user-facing-error";

const redirectStorageKey = "club.study.redirectAfterSignIn";

export function SignInPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/sign-in" });
  const redirect = safeAppRedirect(search.redirect);
  const currentUser = useCurrentUser();
  const signIn = useMutation({
    mutationFn: async () => {
      window.localStorage.setItem(redirectStorageKey, redirect);
      await signInWithGoogle(`${window.location.origin}/auth/callback`);
    },
    onError: (error) =>
      toast.error(toUserMessage(error, "auth", "Could not start sign in.")),
  });

  useEffect(() => {
    if (currentUser.data) {
      void navigate({ to: redirect, replace: true });
    }
  }, [currentUser.data, navigate, redirect]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-[26rem] rounded-sm border bg-card/70 p-6 shadow-none">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <BookOpenText className="size-4 text-foreground" />
          <BrandWordmark className="text-[18px]" />
        </div>
        <h1 className="mt-6 text-lg font-semibold">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Continue with Google to join or create a private reading club.
        </p>
        <Button
          type="button"
          className="mt-6 w-full rounded-sm"
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
  return safeAppRedirect(window.localStorage.getItem(redirectStorageKey));
}

export function clearStoredRedirect() {
  window.localStorage.removeItem(redirectStorageKey);
}

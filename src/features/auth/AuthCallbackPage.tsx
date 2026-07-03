import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";

import { clearStoredRedirect, getStoredRedirect } from "@/features/auth/SignInPage";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/callback" });

  useEffect(() => {
    const redirect =
      typeof search.redirect === "string" && search.redirect.startsWith("/")
        ? search.redirect
        : getStoredRedirect();
    clearStoredRedirect();
    void navigate({ to: redirect, replace: true });
  }, [navigate, search.redirect]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">Redirecting...</p>
    </main>
  );
}

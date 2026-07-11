import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  clearStoredRedirect,
  getStoredRedirect,
} from "@/features/auth/SignInPage";
import { ensureProfileFromUser } from "@/features/profile/api";
import { safeAppRedirect } from "@/lib/safe-redirect";
import { supabase } from "@/lib/supabase/client";
import { toUserMessage } from "@/lib/user-facing-error";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/callback" });
  const [message, setMessage] = useState("Completing sign in...");

  useEffect(() => {
    let active = true;

    async function completeSignIn() {
      try {
        await completeOAuthRedirect();

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          throw error;
        }

        if (!user) {
          throw new Error("No signed-in user was returned.");
        }

        await ensureProfileFromUser(user);
        const redirect =
          typeof search.redirect === "string"
            ? safeAppRedirect(search.redirect)
            : getStoredRedirect();
        clearStoredRedirect();

        if (active) {
          await navigate({ to: redirect, replace: true });
        }
      } catch (error) {
        if (active) {
          setMessage(
            toUserMessage(error, "auth", "Sign in failed. Please try again."),
          );
        }
      }
    }

    void completeSignIn();

    return () => {
      active = false;
    };
  }, [navigate, search.redirect]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">{message}</p>
    </main>
  );
}

async function completeOAuthRedirect() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const providerError =
    searchParams.get("error_description") ??
    hashParams.get("error_description") ??
    searchParams.get("error") ??
    hashParams.get("error");

  if (providerError) {
    throw new Error(providerError);
  }

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw error;
    }
    return;
  }

  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      throw error;
    }
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    return;
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session) {
    throw new Error("No OAuth session was returned.");
  }
}

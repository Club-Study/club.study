import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";

export type CurrentUser = {
  id: string;
  email: string | undefined;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }

  if (!data.user) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email,
  };
}

export async function signInWithGoogle(redirectTo: string) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error) {
    throw error;
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export function profileValuesFromUser(user: User) {
  const metadata = user.user_metadata;
  const displayName =
    stringOrNull(metadata.full_name) ??
    stringOrNull(metadata.name) ??
    user.email?.split("@")[0] ??
    "Reader";

  return {
    id: user.id,
    display_name: displayName,
    avatar_id: "bookworm",
    avatar_color: "#65a30d",
  };
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

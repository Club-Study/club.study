import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export async function getCurrentUser(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }

  return data.user;
}

export async function signInWithGoogle(
  supabase: SupabaseClient<Database>,
  redirectTo: string,
) {
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

export async function signOut(supabase: SupabaseClient<Database>) {
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

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { profileValuesFromUser } from "@/features/auth/api";
import type { Database } from "@/lib/supabase/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function upsertProfileFromUser(
  supabase: SupabaseClient<Database>,
  user: User,
) {
  const values = profileValuesFromUser(user);
  const { data, error } = await supabase
    .from("profiles")
    .upsert(values, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensureProfileFromUser(
  supabase: SupabaseClient<Database>,
  user: User,
) {
  const values = profileValuesFromUser(user);
  const { data, error } = await supabase
    .from("profiles")
    .upsert(values, { onConflict: "id", ignoreDuplicates: true })
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? getProfile(supabase, user.id);
}

export async function getProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  values: Pick<Profile, "display_name" | "avatar_id" | "avatar_color" | "bio">,
) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...values }, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

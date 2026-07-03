import type { SupabaseClient } from "@supabase/supabase-js";

import { generatedClubSlug } from "@/features/clubs/schemas";
import type { Database } from "@/lib/supabase/database.types";

export type Club = Database["public"]["Tables"]["clubs"]["Row"];
export type ClubMember = Database["public"]["Tables"]["club_members"]["Row"];
export type ClubInvite = Database["public"]["Tables"]["club_invites"]["Row"];
export type MemberWithProfile = ClubMember & {
  profiles: {
    id: string;
    display_name: string;
    avatar_id: string;
    avatar_color: string;
    bio: string | null;
  } | null;
};

export async function listClubs(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function getClub(supabase: SupabaseClient<Database>, clubId: string) {
  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .eq("id", clubId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createClub(
  supabase: SupabaseClient<Database>,
  values: { name: string; description: string | null },
) {
  const { data, error } = await supabase.rpc("create_club", {
    p_name: values.name,
    p_slug: generatedClubSlug(values.name),
    p_description: values.description ?? undefined,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function listMembers(
  supabase: SupabaseClient<Database>,
  clubId: string,
) {
  const { data, error } = await supabase
    .from("club_members")
    .select("*, profiles(id, display_name, avatar_id, avatar_color, bio)")
    .eq("club_id", clubId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data as MemberWithProfile[];
}

export async function listInvites(
  supabase: SupabaseClient<Database>,
  clubId: string,
) {
  const { data, error } = await supabase
    .from("club_invites")
    .select("*")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function createInviteLink(
  supabase: SupabaseClient<Database>,
  clubId: string,
) {
  const { data, error } = await supabase.rpc("create_invite_link", {
    p_club_id: clubId,
  });

  if (error) {
    throw error;
  }

  const invite = data.at(0);
  if (!invite) {
    throw new Error("Invite link was not created.");
  }

  return invite;
}

export async function revokeInviteLink(
  supabase: SupabaseClient<Database>,
  inviteId: string,
) {
  const { data, error } = await supabase.rpc("revoke_invite_link", {
    p_invite_id: inviteId,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function acceptInvite(
  supabase: SupabaseClient<Database>,
  token: string,
) {
  const { data, error } = await supabase.rpc("accept_invite", {
    p_token: token,
  });

  if (error) {
    throw error;
  }

  return data;
}

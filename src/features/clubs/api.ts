import { generatedClubSlug } from "@/features/clubs/schemas";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

export type Club = Database["public"]["Tables"]["clubs"]["Row"];
export type ClubMember = Database["public"]["Tables"]["club_members"]["Row"];
export type ClubInvite = Database["public"]["Tables"]["club_invites"]["Row"];
export type ClubRole = Database["public"]["Enums"]["club_role"];

export type ClubListItem = Club & {
  viewerRole: ClubRole;
  memberCount: number;
};

type ClubListQueryRow = Club & {
  viewer_membership: unknown;
  member_count: unknown;
};

export type MemberWithProfile = ClubMember & {
  profiles: {
    id: string;
    display_name: string;
    avatar_id: string;
    avatar_color: string;
    bio: string | null;
  } | null;
};

export async function listClubs(userId: string): Promise<ClubListItem[]> {
  const { data, error } = await supabase
    .from("clubs")
    .select(
      "*, viewer_membership:club_members!inner(user_id, role), member_count:club_members(count)",
    )
    .eq("viewer_membership.user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Clubs query returned no data.");
  }

  return (data as unknown as ClubListQueryRow[]).map(normalizeClubListRow);
}

export function normalizeClubListRow(row: ClubListQueryRow): ClubListItem {
  const viewerMembership = normalizeViewerMembership(row.viewer_membership);
  const memberCount = normalizeMemberCount(row.member_count);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    viewerRole: viewerMembership.role,
    memberCount,
  };
}

function normalizeViewerMembership(value: unknown): { role: ClubRole } {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error(
      "Club query must return exactly one viewer membership per club.",
    );
  }

  const membership = value[0];
  if (
    !membership ||
    typeof membership !== "object" ||
    !("role" in membership) ||
    !isClubRole(membership.role)
  ) {
    throw new Error("Club query returned an invalid viewer role.");
  }

  return { role: membership.role };
}

function normalizeMemberCount(value: unknown): number {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error(
      "Club query must return exactly one member-count aggregate per club.",
    );
  }

  const aggregate = value[0];
  if (
    !aggregate ||
    typeof aggregate !== "object" ||
    !("count" in aggregate) ||
    typeof aggregate.count !== "number" ||
    !Number.isFinite(aggregate.count) ||
    !Number.isInteger(aggregate.count) ||
    aggregate.count < 0
  ) {
    throw new Error("Club query returned an invalid member count.");
  }

  return aggregate.count;
}

function isClubRole(value: unknown): value is ClubRole {
  return value === "owner" || value === "admin" || value === "member";
}

export async function getClub(clubId: string) {
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

export async function createClub(values: {
  name: string;
  description: string | null;
}) {
  const { data, error } = await supabase.rpc("create_club", {
    p_name: values.name,
    p_slug: generatedClubSlug(values.name),
    p_description: values.description ?? undefined,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Club was not created.");
  }

  return data;
}

export async function updateClub(values: {
  clubId: string;
  name: string;
  description: string | null;
}) {
  const { data, error } = await supabase
    .from("clubs")
    .update({
      name: values.name,
      description: values.description,
    })
    .eq("id", values.clubId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Club was not updated.");
  }

  return data;
}

export async function listMembers(clubId: string) {
  const { data, error } = await supabase
    .from("club_members")
    .select("*, profiles(id, display_name, avatar_id, avatar_color, bio)")
    .eq("club_id", clubId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Club members query returned no data.");
  }

  return data as unknown as MemberWithProfile[];
}

export async function listInvites(clubId: string) {
  const { data, error } = await supabase
    .from("club_invites")
    .select(
      "id, club_id, status, created_by, expires_at, created_at, accepted_by, accepted_at",
    )
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Club invites query returned no data.");
  }

  return data;
}

export async function createInviteLink(clubId: string) {
  const { data, error } = await supabase.rpc("create_invite_link", {
    p_club_id: clubId,
  });

  if (error) {
    throw error;
  }

  const invite = data?.at(0);
  if (!invite) {
    throw new Error("Invite link was not created.");
  }

  return invite;
}

export async function revokeInviteLink(inviteId: string) {
  const { data, error } = await supabase.rpc("revoke_invite_link", {
    p_invite_id: inviteId,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Invite link was not revoked.");
  }

  return data;
}

export async function acceptInvite(token: string) {
  const { data, error } = await supabase.rpc("accept_invite", {
    p_token: token,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Invite was not accepted.");
  }

  return data;
}

export async function setClubMemberRole(values: {
  clubId: string;
  userId: string;
  role: Exclude<ClubRole, "owner">;
}) {
  const { data, error } = await supabase.rpc("set_club_member_role", {
    p_club_id: values.clubId,
    p_user_id: values.userId,
    p_role: values.role,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Club member role was not updated.");
  }

  return data;
}

export async function transferClubOwnership(values: {
  clubId: string;
  newOwnerId: string;
}) {
  const { data, error } = await supabase.rpc("transfer_club_ownership", {
    p_club_id: values.clubId,
    p_new_owner_id: values.newOwnerId,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Club ownership was not transferred.");
  }

  return data;
}

export async function leaveClub(clubId: string) {
  const { data, error } = await supabase.rpc("leave_club", {
    p_club_id: clubId,
  });

  if (error) {
    throw error;
  }

  const result = data?.at(0);

  if (!result) {
    throw new Error("Club was not left.");
  }

  return result;
}

export function isClubManagerRole(role: ClubRole | null | undefined) {
  return role === "owner" || role === "admin";
}

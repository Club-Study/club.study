import { generatedClubSlug } from "@/features/clubs/schemas";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

export type Club = Database["public"]["Tables"]["clubs"]["Row"];
export type ClubMember = Database["public"]["Tables"]["club_members"]["Row"];
export type ClubInvite = Database["public"]["Tables"]["club_invites"]["Row"];
export type ClubEmailSubscription =
  Database["public"]["Tables"]["club_email_subscriptions"]["Row"];
export type ClubRole = Database["public"]["Enums"]["club_role"];
export type ClubJoinRequest =
  Database["public"]["Tables"]["club_join_requests"]["Row"];
export type ClubJoinRequestStatus =
  Database["public"]["Enums"]["club_join_request_status"];
export type ClubJoinRequestDecision = Extract<
  ClubJoinRequestStatus,
  "approved" | "rejected"
>;

export type ClubListItem = Club & {
  viewerRole: ClubRole;
  memberCount: number;
};

type ClubListQueryRow = Club & {
  viewer_membership: unknown;
  member_count: unknown;
};

export type ClubDirectoryItem = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  viewerRole: ClubRole | null;
  applicationStatus: ClubJoinRequestStatus | null;
  applicationCreatedAt: string | null;
};

export type DiscoverableClubRow = {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  viewer_role: ClubRole | null;
  application_status: ClubJoinRequestStatus | null;
  application_created_at: string | null;
};

export type ClubJoinRequestListItem = {
  request_id: string;
  user_id: string;
  display_name: string;
  avatar_id: string;
  avatar_color: string;
  bio: string | null;
  created_at: string;
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

export async function listDiscoverableClubs(): Promise<ClubDirectoryItem[]> {
  const { data, error } = await supabase.rpc("list_discoverable_clubs");

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Club directory query returned no data.");
  }

  return (data as unknown as DiscoverableClubRow[]).map(
    normalizeDiscoverableClubRow,
  );
}

export function normalizeDiscoverableClubRow(
  row: DiscoverableClubRow,
): ClubDirectoryItem {
  if (
    !Number.isFinite(row.member_count) ||
    !Number.isInteger(row.member_count) ||
    row.member_count < 0
  ) {
    throw new Error("Club directory returned an invalid member count.");
  }

  if (row.viewer_role !== null && !isClubRole(row.viewer_role)) {
    throw new Error("Club directory returned an invalid viewer role.");
  }

  if (
    row.application_status !== null &&
    !isClubJoinRequestStatus(row.application_status)
  ) {
    throw new Error("Club directory returned an invalid application status.");
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    memberCount: row.member_count,
    viewerRole: row.viewer_role,
    applicationStatus: row.application_status,
    applicationCreatedAt: row.application_created_at,
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

function isClubJoinRequestStatus(
  value: unknown,
): value is ClubJoinRequestStatus {
  return value === "pending" || value === "approved" || value === "rejected";
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

export async function getClubEmailSubscription(
  clubId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("club_email_subscriptions")
    .select("club_id, user_id")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeClubEmailSubscription(data, { clubId, userId });
}

export async function setClubEmailSubscription(values: {
  clubId: string;
  userId: string;
  enabled: boolean;
}) {
  if (values.enabled) {
    const { data, error } = await supabase
      .from("club_email_subscriptions")
      .insert({
        club_id: values.clubId,
        user_id: values.userId,
      })
      .select("club_id, user_id")
      .single();

    if (error) {
      throw error;
    }

    return normalizeClubEmailSubscription(data, values);
  }

  const { error } = await supabase
    .from("club_email_subscriptions")
    .delete()
    .eq("club_id", values.clubId)
    .eq("user_id", values.userId);

  if (error) {
    throw error;
  }

  return false;
}

export function normalizeClubEmailSubscription(
  row: Pick<ClubEmailSubscription, "club_id" | "user_id"> | null,
  expected: { clubId: string; userId: string },
) {
  if (!row) {
    return false;
  }

  if (row.club_id !== expected.clubId || row.user_id !== expected.userId) {
    throw new Error("Club email subscription query returned an unexpected row.");
  }

  return true;
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

export async function applyToClub(clubId: string) {
  const { data, error } = await supabase.rpc("apply_to_club", {
    p_club_id: clubId,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Club application was not created.");
  }

  return data;
}

export async function listClubJoinRequests(
  clubId: string,
): Promise<ClubJoinRequestListItem[]> {
  const { data, error } = await supabase.rpc("list_club_join_requests", {
    p_club_id: clubId,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Club applications query returned no data.");
  }

  return data as unknown as ClubJoinRequestListItem[];
}

export async function reviewClubJoinRequest(values: {
  requestId: string;
  decision: ClubJoinRequestDecision;
}) {
  const { data, error } = await supabase.rpc("review_club_join_request", {
    p_request_id: values.requestId,
    p_decision: values.decision,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Club application was not reviewed.");
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

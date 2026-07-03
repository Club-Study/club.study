import { apiRequest } from "@/lib/api/client";

export type Club = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ClubMember = {
  club_id: string;
  user_id: string;
  role: "owner" | "member";
  created_at: string;
};

export type ClubInvite = {
  id: string;
  club_id: string;
  token_hash: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  created_by: string;
  expires_at: string | null;
  created_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  token?: string;
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

export async function listClubs() {
  return apiRequest<Club[]>("api/clubs/");
}

export async function getClub(clubId: string) {
  return apiRequest<Club>(`api/clubs/${clubId}/`);
}

export async function createClub(values: {
  name: string;
  description: string | null;
}) {
  return apiRequest<Club>("api/clubs/", {
    method: "POST",
    body: values,
  });
}

export async function listMembers(clubId: string) {
  return apiRequest<MemberWithProfile[]>(`api/clubs/${clubId}/members/`);
}

export async function listInvites(clubId: string) {
  return apiRequest<ClubInvite[]>(`api/clubs/${clubId}/invites/`);
}

export async function createInviteLink(clubId: string) {
  const invite = await apiRequest<ClubInvite>(`api/clubs/${clubId}/invites/`, {
    method: "POST",
  });

  if (!invite.token) {
    throw new Error("Invite link was not created.");
  }

  return invite as ClubInvite & { token: string };
}

export async function revokeInviteLink(inviteId: string) {
  return apiRequest<ClubInvite>(`api/invites/${inviteId}/revoke/`, {
    method: "POST",
  });
}

export async function acceptInvite(token: string) {
  return apiRequest<MemberWithProfile>("api/invites/accept/", {
    method: "POST",
    body: { token },
  });
}
